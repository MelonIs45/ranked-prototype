// Qualified-period supervision: BN flags, player reports, flag cases, NAT outcomes, abuse strikes.
import { assertCheck, emit, fail, nextId, OK, run, type Check, type Ctx } from './core';
import { openRemovalVoteInternal } from './membership';
import { disqualifyMap, mapLabel, name } from './pipeline';
import { activeNominations, isNominator, openCase, openFlags } from './selectors';
import { DAY, HOUR } from './time';
import type { Action, Beatmapset, CaseOutcome, Flag, FlagSource, Id, State } from './types';

type S = State;

export const FLAG_REASONS = ['Unrankable issue', 'Metadata', 'Timing / offset', 'Gameplay quality', 'Wrong category', 'Other'];

function checkFlagCommon(s: S, actorId: Id, map: Beatmapset | undefined, reasonText: string | null): Check {
  if (!map) return fail('no_map', 'That beatmap does not exist.');
  if (map.status !== 'qualified') return fail('not_qualified', 'Only Qualified maps can be flagged or reported.');
  if (map.mapperId === actorId || map.guestMapperIds.includes(actorId)) return fail('own_map', "You can't flag or report a map you mapped on.");
  if (reasonText !== null && !reasonText.trim()) return fail('reason_required', 'A written reason is required.');
  return OK;
}

export function canBnFlag(s: S, actorId: Id, mapId: Id, reasonText: string | null = null): Check {
  const map = s.maps[mapId];
  if (!isNominator(s.users[actorId])) return fail('not_bn', 'Only BNs and NAT members can raise a BN flag.');
  const c = checkFlagCommon(s, actorId, map, reasonText);
  if (!c.ok) return c;
  if (activeNominations(s, mapId).some((n) => n.userId === actorId)) return fail('own_nomination', "You nominated this map, so you can't flag it.");
  if (openFlags(s, mapId).some((f) => f.source === 'bn' && f.userId === actorId)) return fail('already_flagged', 'You have already flagged this map.');
  return OK;
}

export function canReport(s: S, actorId: Id, mapId: Id, reasonText: string | null = null): Check {
  const map = s.maps[mapId];
  if (!s.users[actorId]) return fail('no_user', 'Unknown user.');
  if (s.users[actorId].isAdmin) return fail('admin', 'The admin persona does not report maps; use the crowd simulator instead.');
  const c = checkFlagCommon(s, actorId, map, reasonText);
  if (!c.ok) return c;
  if (openFlags(s, mapId).some((f) => f.source === 'player' && f.userId === actorId)) return fail('already_reported', 'You have already reported this map.');
  return OK;
}

export function canDecideCase(s: S, actorId: Id, caseId: Id): Check {
  if (!s.users[actorId]?.isNAT) return fail('not_nat', 'Only NAT members can review flag cases.');
  const c = s.cases[caseId];
  if (!c) return fail('no_case', 'That case does not exist.');
  if (c.outcome !== null) return fail('decided', 'This case has already been decided.');
  return OK;
}

export function canMarkAbusive(s: S, actorId: Id, flagId: Id): Check {
  if (!s.users[actorId]?.isNAT) return fail('not_nat', 'Only NAT members can mark flags as abusive.');
  const f = s.flags[flagId];
  if (!f) return fail('no_flag', 'That flag does not exist.');
  if (f.markedAbusive) return fail('already', 'This flag is already marked abusive.');
  const c = f.caseId ? s.cases[f.caseId] : undefined;
  if (!c || c.outcome !== 'dismissed') return fail('not_dismissed', 'Flags can only be marked abusive on a dismissed case.');
  return OK;
}

// ---------------------------------------------------------------------------

function openCaseIfNeeded(ctx: Ctx, mapId: Id, source: FlagSource) {
  const s = ctx.s;
  const map = s.maps[mapId];
  const existing = openCase(s, mapId);
  const unreviewed = openFlags(s, mapId).filter((f) => f.caseId === null);
  if (existing) {
    for (const f of unreviewed) f.caseId = existing.id;
    return;
  }
  const bnCount = new Set(unreviewed.filter((f) => f.source === 'bn').map((f) => f.userId)).size;
  const playerCount = new Set(unreviewed.filter((f) => f.source === 'player').map((f) => f.userId)).size;
  const p = s.params;
  const trigger: FlagSource | null = bnCount >= p.bnFlagsToOpenCase ? 'bn' : playerCount >= p.playerFlagsToOpenCase ? 'player' : null;
  if (!trigger) return;
  const id = nextId(ctx, 'fc');
  s.cases[id] = { id, mapId, openedAt: ctx.now, deadlineAt: ctx.now + p.natReviewDays * DAY, trigger, outcome: null, reviewerId: null, note: null, decidedAt: null, overdue: false };
  for (const f of unreviewed) f.caseId = id;
  map.frozen = true;
  const why = trigger === 'bn' ? `${bnCount} BN flags` : `${playerCount} player reports`;
  emit(ctx, 'case_opened', `${why} opened a NAT case on ${mapLabel(map)}. The map is frozen; NAT have ${p.natReviewDays} days to decide.`, { mapId });
  void source;
}

function addFlag(ctx: Ctx, mapId: Id, userId: Id, source: FlagSource, reasonCategory: string, reasonText: string): Flag {
  const id = nextId(ctx, 'f');
  const f: Flag = { id, mapId, source, userId, reasonCategory, reasonText: reasonText.trim(), at: ctx.now, caseId: null, markedAbusive: false, closedAt: null };
  ctx.s.flags[id] = f;
  return ctx.s.flags[id];
}

export function addPlayerReport(ctx: Ctx, mapId: Id, userId: Id, reasonCategory: string, reasonText: string, quiet = false) {
  addFlag(ctx, mapId, userId, 'player', reasonCategory, reasonText);
  const count = openFlags(ctx.s, mapId).filter((f) => f.source === 'player' && f.caseId === null).length;
  if (!quiet)
    emit(ctx, 'flag_player', `${name(ctx.s, userId)} reported ${mapLabel(ctx.s.maps[mapId])} (${count}/${ctx.s.params.playerFlagsToOpenCase} reports): ${reasonCategory}.`, {
      mapId,
      actorId: userId,
    });
  openCaseIfNeeded(ctx, mapId, 'player');
}

export function applyStrike(ctx: Ctx, flag: Flag, by: Id) {
  const s = ctx.s;
  const p = s.params;
  if (flag.source === 'player') {
    const u = s.users[flag.userId];
    u.playerStrikes += 1;
    const n = u.playerStrikes;
    const hours = p.playerStrikeBanHours[Math.min(n, p.playerStrikeBanHours.length) - 1] ?? 0;
    let what = 'warning';
    if (hours > 0) {
      u.chatBanUntil = Math.max(u.chatBanUntil ?? 0, ctx.now + hours * HOUR);
      what = hours >= 48 ? `${Math.round(hours / 24)}-day chat ban` : `${hours} h chat ban`;
    }
    if (n >= p.playerTournamentBanStrike) {
      u.tournamentBanned = true;
      what += ' + tournament ban flag';
    }
    emit(ctx, 'strike', `${u.username} received player strike ${n} for flag abuse: ${what}.`, { targetUserId: u.id, actorId: by, mapId: flag.mapId });
    return;
  }
  const ns = s.nominators[flag.userId];
  if (!ns) return;
  ns.flagStrikes += 1;
  const n = ns.flagStrikes;
  const slow = p.bnStrikeSlow[n - 1];
  let what = 'warning';
  if (slow && slow.levels > 0) {
    ns.abuseSlowLevels = slow.levels;
    ns.abuseSlowUntil = ctx.now + slow.days * DAY;
    what = `allowance accrual slowed ${slow.levels} level(s) for ${slow.days} days`;
  }
  if (n >= p.bnRemovalStrike) {
    what = 'removal vote opened automatically';
    openRemovalVoteInternal(ctx, flag.userId, 'flag_abuse', `Automatic: BN flag-abuse strike ${n}.`, by);
  }
  emit(ctx, 'strike', `${name(s, flag.userId)} received BN strike ${n} for flag abuse: ${what}.`, { targetUserId: flag.userId, actorId: by, mapId: flag.mapId });
}

function markAbusiveInternal(ctx: Ctx, flagId: Id, by: Id) {
  const f = ctx.s.flags[flagId];
  f.markedAbusive = true;
  emit(ctx, 'flag_abusive', `${name(ctx.s, by)} marked ${name(ctx.s, f.userId)}'s flag on ${mapLabel(ctx.s.maps[f.mapId])} as abusive.`, {
    mapId: f.mapId,
    actorId: by,
    targetUserId: f.userId,
  });
  applyStrike(ctx, f, by);
}

export function dismissCase(ctx: Ctx, caseId: Id, by: Id | null, note: string | null) {
  const c = ctx.s.cases[caseId];
  const map = ctx.s.maps[c.mapId];
  c.outcome = 'dismissed';
  c.reviewerId = by;
  c.note = note;
  c.decidedAt = ctx.now;
  map.frozen = false;
  const remaining = Math.max(0, ctx.s.params.qualifiedDays - map.qualifiedElapsedMs / DAY);
  emit(ctx, 'case_dismissed', `Case on ${mapLabel(map)} dismissed${by ? ` by ${name(ctx.s, by)}` : ' automatically'}. Clock resumes with ${remaining.toFixed(1)} qualified days left.`, {
    mapId: map.id,
    actorId: by,
  });
}

// ---------------------------------------------------------------------------
// Actions

export const bnFlag: Action<{ mapId: Id; reasonCategory: string; reasonText: string }> = (state, actorId, args, now) => {
  assertCheck(canBnFlag(state, actorId, args.mapId, args.reasonText));
  return run(state, now, (ctx) => {
    addFlag(ctx, args.mapId, actorId, 'bn', args.reasonCategory, args.reasonText);
    const count = new Set(openFlags(ctx.s, args.mapId).filter((f) => f.source === 'bn' && f.caseId === null).map((f) => f.userId)).size;
    emit(ctx, 'flag_bn', `${name(ctx.s, actorId)} flagged ${mapLabel(ctx.s.maps[args.mapId])} (${args.reasonCategory}): ${args.reasonText.trim()}`, {
      mapId: args.mapId,
      actorId,
    });
    void count;
    openCaseIfNeeded(ctx, args.mapId, 'bn');
  });
};

export const report: Action<{ mapId: Id; reasonCategory: string; reasonText: string }> = (state, actorId, args, now) => {
  assertCheck(canReport(state, actorId, args.mapId, args.reasonText));
  return run(state, now, (ctx) => addPlayerReport(ctx, args.mapId, actorId, args.reasonCategory, args.reasonText));
};

export const decideCase: Action<{ caseId: Id; outcome: CaseOutcome; note: string; abusiveFlagIds?: Id[] }> = (state, actorId, args, now) => {
  assertCheck(canDecideCase(state, actorId, args.caseId));
  const abusive = args.abusiveFlagIds ?? [];
  if (abusive.length && args.outcome !== 'dismissed') assertCheck(fail('not_dismissed', 'Flags can only be marked abusive when dismissing a case.'));
  if (args.outcome !== 'dismissed' && !args.note.trim()) assertCheck(fail('reason_required', 'A reason is required to disqualify a map.'));
  return run(state, now, (ctx) => {
    const c = ctx.s.cases[args.caseId];
    const map = ctx.s.maps[c.mapId];
    if (args.outcome === 'dismissed') {
      dismissCase(ctx, c.id, actorId, args.note || null);
      for (const fid of abusive) {
        if (ctx.s.flags[fid]?.caseId === c.id && !ctx.s.flags[fid].markedAbusive) markAbusiveInternal(ctx, fid, actorId);
      }
    } else {
      c.note = args.note.trim();
      disqualifyMap(ctx, map, actorId, args.note.trim(), args.outcome === 'dq_category' ? 'category' : 'criteria');
    }
  });
};

export const markFlagAbusive: Action<{ flagId: Id }> = (state, actorId, { flagId }, now) => {
  assertCheck(canMarkAbusive(state, actorId, flagId));
  return run(state, now, (ctx) => markAbusiveInternal(ctx, flagId, actorId));
};
