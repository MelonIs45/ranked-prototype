// Nomination pipeline: allowance, nominate, verifier/override petitions, qualify, rank, DQ, cooldowns.
import { assertCheck, emit, fail, nextId, OK, run, type Check, type Ctx } from './core';
import {
  activeNominations,
  activeSignatures,
  isNominator,
  nextAccrualAt,
  openCase,
  openFlags,
  openPetition,
  runVerifier,
} from './selectors';
import { DAY, fmtDuration } from './time';
import type { Action, Beatmapset, Id, Ms, NominatorState, OverridePetition, State } from './types';

type S = State;

export function newNominatorState(userId: Id, now: Ms, allowance: number): NominatorState {
  return {
    userId,
    allowanceAvailable: allowance,
    lastAccrualAt: now,
    cooldownLevel: 0,
    cooldownUntil: null,
    cooldownTriggeredAt: null,
    flagStrikes: 0,
    abuseSlowLevels: 0,
    abuseSlowUntil: null,
  };
}

export const name = (s: S, id: Id) => s.users[id]?.username ?? 'Unknown';
export const mapLabel = (m: Beatmapset) => `${m.artist} — ${m.title}`;

// ---------------------------------------------------------------------------
// Checks shared by engine and UI

function checkNominatorOnMap(s: S, actorId: Id, map: Beatmapset | undefined, verb: string): Check {
  const u = s.users[actorId];
  if (!map) return fail('no_map', 'That beatmap does not exist.');
  if (!isNominator(u)) return fail('not_bn', `Only Beatmap Nominators and NAT members can ${verb}.`);
  if (map.mapperId === actorId) return fail('own_map', `You can't ${verb} your own map.`);
  if (map.guestMapperIds.includes(actorId)) return fail('guest_map', `You guested on this map, so you can't ${verb} it.`);
  return OK;
}

export function allowanceMessage(s: S, ns: NominatorState, now: Ms): string {
  const next = nextAccrualAt(s.params, ns, now);
  return `You have 0 nominations available. Next one in ${fmtDuration(next - now)}.`;
}

function checkAllowance(s: S, actorId: Id, now: Ms): Check {
  const ns = s.nominators[actorId];
  if (!ns) return fail('no_allowance', 'You have no nomination allowance.');
  if (ns.allowanceAvailable < 1) return fail('no_allowance', allowanceMessage(s, ns, now));
  return OK;
}

export function canNominate(s: S, actorId: Id, mapId: Id, now: Ms = s.now): Check {
  const map = s.maps[mapId];
  const base = checkNominatorOnMap(s, actorId, map, 'nominate');
  if (!base.ok) return base;
  if (map.status !== 'pending') return fail('not_pending', `This map is ${map.status}; only Pending maps can be nominated.`);
  if (activeNominations(s, mapId).some((n) => n.userId === actorId)) return fail('already_nominated', 'You have already nominated this map.');
  const pet = openPetition(s, mapId);
  if (pet && activeSignatures(pet).some((x) => x.userId === actorId))
    return fail('already_signed', 'You already signed the override petition for this map.');
  return checkAllowance(s, actorId, now);
}

export function canSignOverride(s: S, actorId: Id, mapId: Id, reason: string | null, now: Ms = s.now): Check {
  const map = s.maps[mapId];
  const base = checkNominatorOnMap(s, actorId, map, 'sign an override for');
  if (!base.ok) return base;
  if (map.status !== 'pending') return fail('not_pending', `This map is ${map.status}; only Pending maps can be petitioned.`);
  if (runVerifier(map).ok) return fail('verifier_ok', 'This map passes the Mapset Verifier, so nominate it normally.');
  if (activeNominations(s, mapId).some((n) => n.userId === actorId)) return fail('already_nominated', 'You have already nominated this map.');
  const pet = openPetition(s, mapId);
  if (pet && activeSignatures(pet).some((x) => x.userId === actorId)) return fail('already_signed', 'You already signed this override petition.');
  if (pet && pet.status === 'awaiting_nat')
    return fail('awaiting_nat', 'This petition already has enough signatures and is waiting for a NAT decision.');
  if (reason !== null && !reason.trim()) return fail('reason_required', 'A written reason is required to sign an override petition.');
  if (s.params.interp.overrideSignatureSpendsNomination) return checkAllowance(s, actorId, now);
  return OK;
}

export function canDecidePetition(s: S, actorId: Id, petitionId: Id): Check {
  const pet = s.petitions[petitionId];
  if (!s.users[actorId]?.isNAT) return fail('not_nat', 'Only NAT members can decide override petitions.');
  if (!pet) return fail('no_petition', 'That petition does not exist.');
  if (pet.status !== 'awaiting_nat') return fail('not_awaiting', `This petition is ${pet.status.replace('_', ' ')}, not awaiting a decision.`);
  if (pet.signatures.some((x) => x.userId === actorId && !x.voided))
    return fail('signed_own', 'You signed this petition, so another NAT member must decide it.');
  return OK;
}

export function canDisqualify(s: S, actorId: Id, mapId: Id, reason: string | null): Check {
  const map = s.maps[mapId];
  if (!s.users[actorId]?.isNAT) return fail('not_nat', 'Only NAT members can disqualify maps.');
  if (!map) return fail('no_map', 'That beatmap does not exist.');
  if (map.status !== 'qualified') return fail('not_qualified', 'Only Qualified maps can be disqualified.');
  if (reason !== null && !reason.trim()) return fail('reason_required', 'A reason is required to disqualify a map.');
  return OK;
}

// ---------------------------------------------------------------------------
// Internal mutators (reused by tick and other domains)

function spendNomination(ctx: Ctx, userId: Id) {
  const ns = ctx.s.nominators[userId];
  // Spending from a full allowance restarts the accrual timer, so a capped nominator doesn't get an instant refill.
  if (ns.allowanceAvailable >= ctx.s.params.allowanceCap) ns.lastAccrualAt = ctx.now;
  ns.allowanceAvailable -= 1;
}

export function qualifyMap(ctx: Ctx, map: Beatmapset, opts: { qualifiedAt?: Ms; via?: string } = {}) {
  map.status = 'qualified';
  map.qualifiedAt = opts.qualifiedAt ?? ctx.now;
  map.qualifiedElapsedMs = Math.max(0, ctx.now - map.qualifiedAt);
  map.frozen = false;
  map.lastActivityAt = ctx.now;
  emit(ctx, 'qualified', `${mapLabel(map)} is Qualified${opts.via ? ` (${opts.via})` : ''}. Ranks in ${ctx.s.params.qualifiedDays} qualified days.`, {
    mapId: map.id,
  });
}

function addNomination(ctx: Ctx, map: Beatmapset, userId: Id, viaOverride: boolean, at: Ms = ctx.now) {
  const id = nextId(ctx, 'n');
  ctx.s.nominations[id] = { id, mapId: map.id, userId, at, viaOverride, voidedAt: null };
}

export function rankMap(ctx: Ctx, map: Beatmapset, at: Ms) {
  const p = ctx.s.params;
  map.status = 'ranked';
  map.rankedAt = at;
  map.frozen = false;
  map.lastActivityAt = at;
  for (const f of openFlags(ctx.s, map.id)) f.closedAt = at;
  emit(ctx, 'ranked', `${mapLabel(map)} is Ranked after ${p.qualifiedDays} qualified days.`, { mapId: map.id, at });
  if (map.category !== 'level_design') return;
  const bonus = map.dqCount === 0 ? p.stars.bonusZeroDQ : map.dqCount === 1 ? p.stars.bonusOneDQ : 0;
  if (bonus <= 0) return;
  for (const n of activeNominations(ctx.s, map.id)) {
    if (!isNominator(ctx.s.users[n.userId])) continue;
    const id = nextId(ctx, 'bg');
    const expiresAt = p.interp.bonusStars === 'pool' ? at + p.stars.bonusLifetimeDays * DAY : null;
    ctx.s.bonusGrants[id] = { id, userId: n.userId, amount: bonus, remaining: bonus, grantedAt: at, expiresAt, sourceMapId: map.id, expiredNotified: false };
    emit(
      ctx,
      'bonus_granted',
      `${name(ctx.s, n.userId)} earned +${bonus} bonus stars (${map.dqCount} DQ) from ${mapLabel(map)}${expiresAt ? `, usable for ${p.stars.bonusLifetimeDays} days` : ''}.`,
      { mapId: map.id, targetUserId: n.userId, at },
    );
  }
}

function checkCooldownTrigger(ctx: Ctx, userId: Id) {
  const ns = ctx.s.nominators[userId];
  if (!ns) return;
  const p = ctx.s.params;
  const since = ns.cooldownTriggeredAt ?? -Infinity;
  const dqTimes = Object.values(ctx.s.dqs)
    .filter((d) => d.nominatorIds.includes(userId) && d.at > since)
    .map((d) => d.at);
  const hit = p.dqCooldownTriggers.find((t) => dqTimes.filter((at) => at > ctx.now - t.days * DAY).length >= t.count);
  if (!hit) return;
  const maxLevel = p.cooldownAccrualDays.length - 1;
  ns.cooldownLevel = Math.min(ns.cooldownLevel + 1, maxLevel);
  ns.cooldownTriggeredAt = ctx.now;
  ns.cooldownUntil = ctx.now + p.cooldownResetDays * DAY;
  emit(
    ctx,
    'cooldown',
    `${name(ctx.s, userId)} hit ${hit.count} DQs in ${hit.days} days: cooldown level ${ns.cooldownLevel} (allowance every ${p.cooldownAccrualDays[ns.cooldownLevel]} days).`,
    { targetUserId: userId },
  );
}

export function disqualifyMap(ctx: Ctx, map: Beatmapset, byUserId: Id, reason: string, kind: 'criteria' | 'category' | 'direct') {
  const noms = activeNominations(ctx.s, map.id);
  for (const n of noms) n.voidedAt = ctx.now;
  const nominatorIds = [...new Set(noms.map((n) => n.userId))];
  const id = nextId(ctx, 'dq');
  ctx.s.dqs[id] = { id, mapId: map.id, byUserId, reason, kind, at: ctx.now, nominatorIds };
  map.status = 'pending';
  map.qualifiedAt = null;
  map.qualifiedElapsedMs = 0;
  map.frozen = false;
  map.dqCount += 1;
  map.lastActivityAt = ctx.now;
  for (const f of openFlags(ctx.s, map.id)) f.closedAt = ctx.now;
  const c = openCase(ctx.s, map.id);
  if (c) {
    c.outcome = kind === 'category' ? 'dq_category' : 'dq_criteria';
    c.reviewerId = byUserId;
    c.decidedAt = ctx.now;
    c.note = c.note ?? reason;
  }
  const kindText = kind === 'category' ? 'misclassified category' : kind === 'criteria' ? 'criteria' : 'direct';
  emit(
    ctx,
    'disqualified',
    `${mapLabel(map)} was disqualified (${kindText}) by ${name(ctx.s, byUserId)}: ${reason}. ${noms.length} nominations voided${kind === 'category' ? '; category unlocked' : ''}.`,
    { mapId: map.id, actorId: byUserId },
  );
  for (const uid of nominatorIds) checkCooldownTrigger(ctx, uid);
}

function voidPetition(pet: OverridePetition, status: 'denied' | 'expired', ctx: Ctx, by: Id | null, note: string | null) {
  pet.status = status;
  pet.decidedBy = by;
  pet.decisionNote = note;
  for (const x of pet.signatures) x.voided = true;
  void ctx;
}

export function approvePetition(ctx: Ctx, pet: OverridePetition, by: Id | null, note: string | null) {
  const map = ctx.s.maps[pet.mapId];
  pet.status = 'approved';
  pet.decidedBy = by;
  pet.decisionNote = note;
  for (const sig of activeSignatures(pet)) addNomination(ctx, map, sig.userId, true, sig.at);
  emit(ctx, 'override_approved', `Override for ${mapLabel(map)} approved${by ? ` by ${name(ctx.s, by)}` : ' automatically'}.`, {
    mapId: map.id,
    actorId: by,
  });
  const startsNow = ctx.s.params.interp.overrideApprovalStartsClock;
  qualifyMap(ctx, map, { qualifiedAt: startsNow ? ctx.now : (pet.submittedAt ?? ctx.now), via: 'override approved' });
}

export function denyPetition(ctx: Ctx, pet: OverridePetition, by: Id | null, note: string | null, expired = false) {
  const map = ctx.s.maps[pet.mapId];
  voidPetition(pet, expired ? 'expired' : 'denied', ctx, by, note);
  if (expired) {
    pet.overdue = true;
    emit(ctx, 'override_expired', `Override petition for ${mapLabel(map)} passed its NAT deadline and expired (treated as denied).`, { mapId: map.id });
  } else {
    emit(ctx, 'override_denied', `Override for ${mapLabel(map)} denied by ${name(ctx.s, by ?? '')}${note ? `: ${note}` : ''}. Signatures voided; map stays Pending.`, {
      mapId: map.id,
      actorId: by,
    });
  }
}

// ---------------------------------------------------------------------------
// Actions

export const nominate: Action<{ mapId: Id }> = (state, actorId, { mapId }, now) => {
  assertCheck(canNominate(state, actorId, mapId, now));
  const map = state.maps[mapId];
  const v = runVerifier(map);
  if (!v.ok)
    assertCheck(
      fail('verifier_failed', `The Mapset Verifier found ${v.unrankable.length} unrankable issue(s). Sign an override petition instead.`),
    );
  return run(state, now, (ctx) => {
    const m = ctx.s.maps[mapId];
    spendNomination(ctx, actorId);
    addNomination(ctx, m, actorId, false);
    m.lastActivityAt = now;
    const count = activeNominations(ctx.s, mapId).length;
    const req = ctx.s.params.nominationsRequired;
    emit(ctx, 'nominated', `${name(ctx.s, actorId)} nominated ${mapLabel(m)} (${count}/${req}).`, { mapId, actorId });
    if (count >= req) qualifyMap(ctx, m);
  });
};

export const signOverride: Action<{ mapId: Id; reason: string }> = (state, actorId, { mapId, reason }, now) => {
  assertCheck(canSignOverride(state, actorId, mapId, reason, now));
  return run(state, now, (ctx) => {
    const p = ctx.s.params;
    const m = ctx.s.maps[mapId];
    let pet = openPetition(ctx.s, mapId);
    if (!pet) {
      const id = nextId(ctx, 'op');
      ctx.s.petitions[id] = { id, mapId, signatures: [], status: 'collecting', openedAt: now, submittedAt: null, deadlineAt: null, decidedBy: null, decisionNote: null, overdue: false };
      pet = ctx.s.petitions[id];
    }
    if (p.interp.overrideSignatureSpendsNomination) spendNomination(ctx, actorId);
    pet.signatures.push({ userId: actorId, reason: reason.trim(), at: now, voided: false });
    m.lastActivityAt = now;
    const count = activeSignatures(pet).length;
    emit(ctx, 'override_signed', `${name(ctx.s, actorId)} signed the override petition for ${mapLabel(m)} (${count}/${p.nominationsRequired}): ${reason.trim()}`, {
      mapId,
      actorId,
    });
    if (count >= p.nominationsRequired) {
      pet.status = 'awaiting_nat';
      pet.submittedAt = now;
      pet.deadlineAt = now + p.natReviewDays * DAY;
      emit(ctx, 'override_submitted', `Override petition for ${mapLabel(m)} has ${count} signatures and goes to NAT (deadline ${p.natReviewDays} days).`, { mapId });
    }
  });
};

export const decidePetition: Action<{ petitionId: Id; approve: boolean; note: string }> = (state, actorId, { petitionId, approve, note }, now) => {
  assertCheck(canDecidePetition(state, actorId, petitionId));
  return run(state, now, (ctx) => {
    const pet = ctx.s.petitions[petitionId];
    if (approve) approvePetition(ctx, pet, actorId, note || null);
    else denyPetition(ctx, pet, actorId, note || null);
  });
};

export const disqualify: Action<{ mapId: Id; reason: string; kind?: 'criteria' | 'category' }> = (state, actorId, { mapId, reason, kind }, now) => {
  assertCheck(canDisqualify(state, actorId, mapId, reason));
  return run(state, now, (ctx) => {
    disqualifyMap(ctx, ctx.s.maps[mapId], actorId, reason.trim(), kind ?? 'direct');
  });
};
