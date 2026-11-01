// The scheduler: advances the simulated clock one day at a time and runs every timed job.
import { emit, run, type Ctx } from './core';
import { resolveCandidacyFinal, resolveRemoval } from './membership';
import { approvePetition, denyPetition, mapLabel, name, rankMap } from './pipeline';
import { checkHomeTop, ldPackSnapshotAt, runFaPack, runInviteCycle, runMonthlyPack, seasonRollover } from './rewards';
import { accrualIntervalDays, activeNominations, isNominator, openPetition } from './selectors';
import { dismissCase } from './supervision';
import { addMonths, DAY, fmtDateTime, monthKey, seasonFor } from './time';
import type { ActionResult, Ms, State } from './types';

function step(ctx: Ctx, a: Ms, b: Ms) {
  const s = ctx.s;
  const p = s.params;
  ctx.now = b;
  s.now = b;

  // 1. Qualified clocks and ranking.
  for (const m of Object.values(s.maps)) {
    if (m.status !== 'qualified') continue;
    if (!(m.frozen && p.interp.pauseClockWhileFrozen)) m.qualifiedElapsedMs += b - a;
    const need = p.qualifiedDays * DAY;
    if (!m.frozen && m.qualifiedElapsedMs >= need) {
      const at = b - (m.qualifiedElapsedMs - need);
      m.qualifiedElapsedMs = need;
      rankMap(ctx, m, Math.max(a, at));
    }
  }

  // 2. Nomination allowance accrual, cooldown and abuse-slow expiry.
  let accrued = 0;
  for (const ns of Object.values(s.nominators)) {
    const u = s.users[ns.userId];
    if (!isNominator(u)) continue;
    if (ns.cooldownLevel > 0 && ns.cooldownUntil !== null && ns.cooldownUntil <= b) {
      emit(ctx, 'cooldown', `${u.username}'s cooldown reset to level 0 after ${p.cooldownResetDays} days without a new trigger.`, { targetUserId: u.id, at: ns.cooldownUntil });
      ns.cooldownLevel = 0;
      ns.cooldownUntil = null;
    }
    if (ns.abuseSlowUntil !== null && ns.abuseSlowUntil <= b) {
      emit(ctx, 'cooldown', `${u.username}'s flag-abuse slowdown ended.`, { targetUserId: u.id, at: ns.abuseSlowUntil });
      ns.abuseSlowUntil = null;
      ns.abuseSlowLevels = 0;
    }
    let guard = 0;
    while (guard++ < 1000) {
      const interval = accrualIntervalDays(p, ns, ns.lastAccrualAt) * DAY;
      if (ns.lastAccrualAt + interval > b) break;
      ns.lastAccrualAt += interval;
      if (ns.allowanceAvailable < p.allowanceCap) {
        ns.allowanceAvailable += 1;
        accrued++;
      }
    }
  }
  if (accrued) emit(ctx, 'allowance', `${accrued} nomination(s) accrued across BNs and NAT (cap ${p.allowanceCap}).`);

  // 3. Star returns and bonus expiry.
  const returned = new Map<string, number>();
  for (const st of Object.values(s.stars)) {
    if (st.replenishAt !== null && st.replenishAt > a && st.replenishAt <= b) returned.set(st.castorId, (returned.get(st.castorId) ?? 0) + 1);
  }
  if (returned.size) {
    const total = [...returned.values()].reduce((x, y) => x + y, 0);
    emit(ctx, 'star_returned', `${total} star(s) returned to ${returned.size} caster(s) ${p.stars.replenishDays} days after being cast.`);
  }
  for (const g of Object.values(s.bonusGrants)) {
    if (g.expiresAt !== null && g.expiresAt <= b && !g.expiredNotified) {
      g.expiredNotified = true;
      if (g.remaining > 0) emit(ctx, 'bonus_expired', `${g.remaining} unused bonus star(s) expired for ${name(s, g.userId)}.`, { targetUserId: g.userId, at: g.expiresAt });
    }
  }

  // 4. NAT deadlines: override petitions and flag cases.
  for (const pet of Object.values(s.petitions)) {
    if (pet.status !== 'awaiting_nat' || pet.deadlineAt === null || pet.deadlineAt > b) continue;
    if (p.interp.overrideDeadline === 'expire_as_denied') denyPetition(ctx, pet, null, 'NAT deadline passed', true);
    else if (p.interp.overrideDeadline === 'auto_approve') approvePetition(ctx, pet, null, 'NAT deadline passed: auto-approved');
    else if (!pet.overdue) {
      pet.overdue = true;
      emit(ctx, 'override_expired', `Override petition for ${mapLabel(s.maps[pet.mapId])} is overdue for a NAT decision.`, { mapId: pet.mapId });
    }
  }
  for (const c of Object.values(s.cases)) {
    if (c.outcome !== null || c.deadlineAt > b || c.overdue) continue;
    c.overdue = true;
    if (p.interp.flagCaseDeadline === 'auto_dismiss') {
      dismissCase(ctx, c.id, null, 'NAT deadline passed: auto-dismissed');
    } else {
      emit(ctx, 'case_overdue', `NAT case on ${mapLabel(s.maps[c.mapId])} is overdue; the map stays frozen until NAT decide.`, { mapId: c.mapId });
    }
  }

  // 5. Vote closures.
  for (const c of Object.values(s.candidacies)) if (c.status === 'open' && c.closesAt <= b) resolveCandidacyFinal(ctx, c);
  for (const r of Object.values(s.removalVotes)) if (r.status === 'open' && r.closesAt <= b) resolveRemoval(ctx, r, true);

  // 6. Graveyard for idle WIP/Pending maps.
  if (p.interp.graveyardEnabled) {
    for (const m of Object.values(s.maps)) {
      if ((m.status !== 'wip' && m.status !== 'pending') || m.lastActivityAt + p.graveyardDays * DAY > b) continue;
      for (const n of activeNominations(s, m.id)) n.voidedAt = b;
      const pet = openPetition(s, m.id);
      if (pet) denyPetition(ctx, pet, null, 'Map was graveyarded', false);
      m.status = 'graveyard';
      emit(ctx, 'map_graveyarded', `${mapLabel(m)} went to the graveyard after ${p.graveyardDays} days without activity.`, { mapId: m.id });
    }
  }

  // 7. Monthly Level Design packs.
  for (let back = 3; back >= 1; back--) {
    const key = monthKey(addMonths(b, -back));
    if (s.jobs.ldPacksDone[key]) continue;
    if (ldPackSnapshotAt(p, key) <= b) runMonthlyPack(ctx, key, b);
  }

  // 8. Featured Artist packs every N days.
  let guard = 0;
  while (s.jobs.lastFaPackAt + p.pack.faPackEveryDays * DAY <= b && guard++ < 100) {
    const from = s.jobs.lastFaPackAt;
    const to = from + p.pack.faPackEveryDays * DAY;
    runFaPack(ctx, from, to);
    s.jobs.lastFaPackAt = to;
  }

  // 9. Season rollover and NAT invite cycles.
  const before = seasonFor(a, p);
  const after = seasonFor(b, p);
  if (before.id !== after.id) {
    seasonRollover(ctx, before);
    if (p.interp.natInviteCadence === 'season') runInviteCycle(ctx, after.id);
  }
  if (p.interp.natInviteCadence === 'month' && monthKey(a) !== monthKey(b)) runInviteCycle(ctx, monthKey(b));

  // 10. Home top N entries (stars decay and new ranks shift it).
  checkHomeTop(ctx);
}

/** Advance the clock from `from` to `to`, processing jobs in time order one simulated day at a time. */
export function tick(state: State, from: Ms, to: Ms, actorId: string | null = null): ActionResult {
  return run(state, from, (ctx) => {
    if (to <= from) return;
    emit(ctx, 'clock', `Clock advanced from ${fmtDateTime(from)} to ${fmtDateTime(to)}.`, { actorId });
    let t = from;
    while (t < to) {
      const next = Math.min(t + DAY, to);
      step(ctx, t, next);
      t = next;
    }
  });
}

export function advance(state: State, ms: Ms, actorId: string | null = null): ActionResult {
  return tick(state, state.now, state.now + ms, actorId);
}
