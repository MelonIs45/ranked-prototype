// BN application, vouching, test, NAT invites/candidacies, removal votes.
import seedrandom from 'seedrandom';
import { assertCheck, emit, fail, nextId, OK, run, type Check, type Ctx } from './core';
import { newNominatorState } from './pipeline';
import { bnCriteriaStatus, bnMembers, isNominator, natMembers, removalYesNeeded, vouchesReceived } from './selectors';
import { DAY, fmtDuration } from './time';
import type { Action, BNProfile, BnCriterion, Id, Ms, NATCandidacy, RemovalVote, State } from './types';

type S = State;
const uname = (s: S, id: Id) => s.users[id]?.username ?? 'Unknown';

// ---------------------------------------------------------------------------
// Vouching

export function canVouch(s: S, actorId: Id, candidateId: Id, now: Ms = s.now): Check {
  const u = s.users[actorId];
  const cand = s.users[candidateId];
  if (!isNominator(u)) return fail('not_bn', 'Only current BNs and NAT members can vouch.');
  if (!cand) return fail('no_user', 'That user does not exist.');
  if (actorId === candidateId) return fail('self', "You can't vouch for yourself.");
  if (isNominator(cand)) return fail('already_bn', `${cand.username} is already a BN.`);
  if (Object.values(s.vouches).some((v) => v.voucherId === actorId && v.candidateId === candidateId))
    return fail('already_vouched', `You already vouched for ${cand.username}.`);
  const last = Object.values(s.vouches)
    .filter((v) => v.voucherId === actorId)
    .reduce((a, v) => Math.max(a, v.at), -Infinity);
  const nextAt = last + s.params.vouchCooldownDays * DAY;
  if (nextAt > now) return fail('vouch_cooldown', `You can vouch for one user per ${s.params.vouchCooldownDays} days. Next vouch in ${fmtDuration(nextAt - now)}.`);
  return OK;
}

export function nextVouchAt(s: S, userId: Id): Ms | null {
  const last = Object.values(s.vouches)
    .filter((v) => v.voucherId === userId)
    .reduce((a, v) => Math.max(a, v.at), -Infinity);
  return last === -Infinity ? null : last + s.params.vouchCooldownDays * DAY;
}

export const vouch: Action<{ candidateId: Id }> = (state, actorId, { candidateId }, now) => {
  assertCheck(canVouch(state, actorId, candidateId, now));
  return run(state, now, (ctx) => {
    const id = nextId(ctx, 'v');
    ctx.s.vouches[id] = { id, voucherId: actorId, candidateId, at: now };
    const n = vouchesReceived(ctx.s, candidateId).length;
    emit(ctx, 'vouch', `${uname(ctx.s, actorId)} vouched for ${uname(ctx.s, candidateId)} (${n}/${ctx.s.params.bnCriteria.vouches}).`, {
      actorId,
      targetUserId: candidateId,
    });
  });
};

// ---------------------------------------------------------------------------
// BN test

export function lastApplication(s: S, userId: Id) {
  return Object.values(s.applications)
    .filter((a) => a.userId === userId)
    .sort((a, b) => b.at - a.at)[0];
}

export function canStartTest(s: S, actorId: Id, now: Ms = s.now): Check {
  const u = s.users[actorId];
  if (!u) return fail('no_user', 'Unknown user.');
  if (u.isAdmin) return fail('admin', 'The admin persona cannot apply.');
  if (isNominator(u)) return fail('already_bn', 'You are already a BN.');
  if (!bnCriteriaStatus(s, actorId).some((c) => c.met)) return fail('no_criterion', 'You need to meet at least one criterion before taking the test.');
  const last = lastApplication(s, actorId);
  if (last?.status === 'in_test') return OK;
  if (last?.status === 'failed') {
    const retryAt = last.at + s.params.bnTest.retryDays * DAY;
    if (retryAt > now) return fail('retry_wait', `You can retry the test in ${fmtDuration(retryAt - now)}.`);
  }
  return OK;
}

export const startTest: Action<Record<string, never>> = (state, actorId, _args, now) => {
  assertCheck(canStartTest(state, actorId, now));
  const last = lastApplication(state, actorId);
  if (last?.status === 'in_test') return { state, events: [] };
  return run(state, now, (ctx) => {
    const id = nextId(ctx, 'app');
    const rng = seedrandom(`test:${id}`);
    const pool = [...ctx.s.testQuestions.map((q) => q.id)];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const met = bnCriteriaStatus(ctx.s, actorId).find((c) => c.met)!;
    ctx.s.applications[id] = {
      id,
      userId: actorId,
      criterionMet: met.key,
      questionIds: pool.slice(0, Math.min(ctx.s.params.bnTest.questions, pool.length)),
      answers: null,
      testScore: null,
      status: 'in_test',
      at: now,
    };
    emit(ctx, 'bn_test', `${uname(ctx.s, actorId)} started the BN test (qualified via ${met.label.toLowerCase()}).`, { actorId });
  });
};

export function becomeBN(ctx: Ctx, userId: Id, via: BnCriterion) {
  const u = ctx.s.users[userId];
  u.bnQualifiedVia = via;
  u.isBN = true;
  u.bnSince = ctx.now;
  ctx.s.nominators[userId] = newNominatorState(userId, ctx.now, ctx.s.params.newBnAllowance);
  ctx.s.bnProfiles[userId] ??= { userId, open: false, genres: [], skillsets: [], categories: [], requestInstructions: '' };
}

export const submitTest: Action<{ applicationId: Id; answers: number[] }> = (state, actorId, { applicationId, answers }, now) => {
  const app = state.applications[applicationId];
  if (!app || app.userId !== actorId) assertCheck(fail('no_app', 'That application does not exist.'));
  if (app.status !== 'in_test') assertCheck(fail('done', 'This test has already been submitted.'));
  if (answers.length !== app.questionIds.length || answers.some((a) => a === undefined || a === null || a < 0))
    assertCheck(fail('incomplete', 'Answer every question before submitting.'));
  return run(state, now, (ctx) => {
    const a = ctx.s.applications[applicationId];
    const qs = new Map(ctx.s.testQuestions.map((q) => [q.id, q]));
    const correct = a.questionIds.filter((qid, i) => qs.get(qid)?.correctIndex === answers[i]).length;
    const score = correct / a.questionIds.length;
    a.answers = answers;
    a.testScore = score;
    a.at = now;
    const passed = score >= ctx.s.params.bnTest.passMark - 1e-9;
    a.status = passed ? 'passed' : 'failed';
    emit(ctx, 'bn_test', `${uname(ctx.s, actorId)} ${passed ? 'passed' : 'failed'} the BN test with ${Math.round(score * 100)}%.`, { actorId });
    if (passed) {
      becomeBN(ctx, actorId, a.criterionMet);
      emit(ctx, 'bn_joined', `${uname(ctx.s, actorId)} is now a Beatmap Nominator.`, { targetUserId: actorId });
    }
  });
};

// ---------------------------------------------------------------------------
// BN directory profile

export const updateBNProfile: Action<Partial<Omit<BNProfile, 'userId'>>> = (state, actorId, patch, now) => {
  if (!isNominator(state.users[actorId])) assertCheck(fail('not_bn', 'Only BNs and NAT members have a directory profile.'));
  return run(state, now, (ctx) => {
    const cur = ctx.s.bnProfiles[actorId] ?? { userId: actorId, open: false, genres: [], skillsets: [], categories: [], requestInstructions: '' };
    ctx.s.bnProfiles[actorId] = { ...cur, ...patch, userId: actorId };
    emit(ctx, 'profile', `${uname(ctx.s, actorId)} updated their BN directory profile (${ctx.s.bnProfiles[actorId].open ? 'open' : 'closed'} for requests).`, { actorId });
  });
};

// ---------------------------------------------------------------------------
// NAT invitations and candidacies

export function inviteToNat(ctx: Ctx, userId: Id, cycle: string) {
  ctx.s.natInvites[userId] = { userId, invitedAt: ctx.now, cycle, status: 'pending' };
  emit(ctx, 'nat_invite', `${uname(ctx.s, userId)} was invited to join the NAT (${cycle === 'founding' ? 'founding cycle' : `cycle ${cycle}`}).`, {
    targetUserId: userId,
  });
}

export function canRespondInvite(s: S, actorId: Id): Check {
  const inv = s.natInvites[actorId];
  if (!inv || inv.status !== 'pending') return fail('no_invite', 'You have no pending NAT invitation.');
  if (s.users[actorId].isNAT) return fail('already_nat', 'You are already a NAT member.');
  return OK;
}

/**
 * Accepting a founding invite joins NAT directly (interpretation of the founding cycle);
 * accepting a regular invite moves on to the portfolio step.
 */
export const respondNatInvite: Action<{ accept: boolean }> = (state, actorId, { accept }, now) => {
  assertCheck(canRespondInvite(state, actorId));
  return run(state, now, (ctx) => {
    const inv = ctx.s.natInvites[actorId];
    const u = ctx.s.users[actorId];
    if (!accept) {
      inv.status = 'declined';
      emit(ctx, 'nat_invite_response', `${u.username} declined the NAT invitation.`, { actorId });
      return;
    }
    inv.status = 'accepted';
    if (inv.cycle === 'founding') {
      joinNat(ctx, actorId, 'accepted the founding invitation');
    } else {
      emit(ctx, 'nat_invite_response', `${u.username} accepted the NAT invitation and is preparing a modding portfolio.`, { actorId });
    }
  });
};

function joinNat(ctx: Ctx, userId: Id, how: string) {
  const u = ctx.s.users[userId];
  u.isNAT = true;
  u.isBN = true;
  u.natSince = ctx.now;
  ctx.s.nominators[userId] ??= newNominatorState(userId, ctx.now, ctx.s.params.newBnAllowance);
  emit(ctx, 'nat_joined', `${u.username} joined the NAT (${how}).`, { targetUserId: userId });
}

export function canSubmitPortfolio(s: S, actorId: Id, text: string | null, links: string[] | null): Check {
  const inv = s.natInvites[actorId];
  if (!inv || inv.status !== 'accepted' || inv.cycle === 'founding') return fail('no_invite', 'You need an accepted NAT invitation to submit a portfolio.');
  if (Object.values(s.candidacies).some((c) => c.userId === actorId && c.status === 'open')) return fail('open', 'Your candidacy vote is already open.');
  if (text !== null && !text.trim()) return fail('text_required', 'Describe your modding work in the portfolio text.');
  if (links && links.length > 10) return fail('too_many_links', 'A portfolio can include at most 10 map links.');
  return OK;
}

export const submitPortfolio: Action<{ text: string; links: string[] }> = (state, actorId, { text, links }, now) => {
  assertCheck(canSubmitPortfolio(state, actorId, text, links));
  return run(state, now, (ctx) => {
    const id = nextId(ctx, 'nc');
    const inv = ctx.s.natInvites[actorId];
    inv.status = 'submitted';
    ctx.s.candidacies[id] = {
      id,
      userId: actorId,
      invitedAt: inv.invitedAt,
      portfolioText: text.trim(),
      portfolioLinks: links.filter((l) => l.trim()).slice(0, 10),
      votes: [],
      opensAt: now,
      closesAt: now + ctx.s.params.natVoteDays * DAY,
      status: 'open',
    };
    emit(ctx, 'nat_candidacy', `${uname(ctx.s, actorId)} submitted a NAT portfolio. Voting is open for ${ctx.s.params.natVoteDays} days.`, { actorId });
  });
};

export function candidacyTally(s: S, c: NATCandidacy) {
  const p = s.params;
  const bnPool = bnMembers(s).filter((u) => u.id !== c.userId).length;
  const natPool = natMembers(s).filter((u) => u.id !== c.userId).length;
  const bnYes = c.votes.filter((v) => v.asRole === 'bn' && v.vote === 'yes').length;
  const bnNo = c.votes.filter((v) => v.asRole === 'bn' && v.vote === 'no').length;
  const natYes = c.votes.filter((v) => v.asRole === 'nat' && v.vote === 'yes').length;
  const natNo = c.votes.filter((v) => v.asRole === 'nat' && v.vote === 'no').length;
  const byMembership = p.interp.voteBasis === 'membership';
  const bnBase = byMembership ? bnPool : bnYes + bnNo;
  const natBase = byMembership ? natPool : natYes + natNo;
  const bnPass = bnBase > 0 && bnYes > p.natVoteThreshold * bnBase;
  const natPass = natBase > 0 && natYes > p.natVoteThreshold * natBase;
  const natVoted = new Set(c.votes.filter((v) => v.asRole === 'nat').map((v) => v.userId));
  const natMissing = natMembers(s)
    .filter((u) => u.id !== c.userId && !natVoted.has(u.id))
    .map((u) => u.id);
  return { bnPool, natPool, bnYes, bnNo, natYes, natNo, bnBase, natBase, bnPass, natPass, passes: bnPass || natPass, natMissing };
}

export function canVoteCandidacy(s: S, actorId: Id, candidacyId: Id): Check {
  const c = s.candidacies[candidacyId];
  const u = s.users[actorId];
  if (!isNominator(u)) return fail('not_bn', 'Only BNs and NAT members can vote on NAT candidates.');
  if (!c || c.status !== 'open') return fail('closed', 'This vote is closed.');
  if (c.userId === actorId) return fail('self', "You can't vote on your own candidacy.");
  if (c.votes.some((v) => v.userId === actorId)) return fail('voted', 'You have already voted on this candidacy.');
  return OK;
}

function resolveCandidacy(ctx: Ctx, c: NATCandidacy, final: boolean) {
  const t = candidacyTally(ctx.s, c);
  const earlyOk = ctx.s.params.interp.voteBasis === 'membership';
  if (t.passes && (final || earlyOk)) {
    c.status = 'accepted';
    c.closesAt = Math.min(c.closesAt, ctx.now);
    const via = t.bnPass && t.natPass ? 'BN and NAT majorities' : t.bnPass ? 'BN majority' : 'NAT majority';
    joinNat(ctx, c.userId, `candidacy accepted by ${via}`);
  } else if (final) {
    c.status = 'rejected';
    emit(ctx, 'nat_vote', `${uname(ctx.s, c.userId)}'s NAT candidacy closed without a majority (BN ${t.bnYes}/${t.bnBase}, NAT ${t.natYes}/${t.natBase}).`, {
      targetUserId: c.userId,
    });
  }
}

export const voteCandidacy: Action<{ candidacyId: Id; vote: 'yes' | 'no' }> = (state, actorId, { candidacyId, vote }, now) => {
  assertCheck(canVoteCandidacy(state, actorId, candidacyId));
  return run(state, now, (ctx) => {
    const c = ctx.s.candidacies[candidacyId];
    const asRole = ctx.s.users[actorId].isNAT ? 'nat' : 'bn';
    c.votes.push({ userId: actorId, asRole, vote, at: now });
    emit(ctx, 'nat_vote', `${uname(ctx.s, actorId)} voted on ${uname(ctx.s, c.userId)}'s NAT candidacy (as ${asRole.toUpperCase()}).`, {
      actorId,
      targetUserId: c.userId,
    });
    resolveCandidacy(ctx, c, false);
  });
};

// ---------------------------------------------------------------------------
// Removal votes

export const REMOVAL_REASONS: Record<RemovalVote['reason'], string> = {
  bad_faith_nominations: 'Bad-faith nominations',
  vouch_abuse: 'Vouch abuse',
  flag_abuse: 'Flag abuse (strike 4)',
};

export function openRemovalVoteInternal(ctx: Ctx, targetId: Id, reason: RemovalVote['reason'], note: string, by: Id) {
  if (Object.values(ctx.s.removalVotes).some((r) => r.targetUserId === targetId && r.status === 'open')) return;
  const id = nextId(ctx, 'rv');
  ctx.s.removalVotes[id] = {
    id,
    targetUserId: targetId,
    reason,
    note,
    openedBy: by,
    openedAt: ctx.now,
    votes: [],
    closesAt: ctx.now + ctx.s.params.removalVoteDays * DAY,
    status: 'open',
  };
  emit(ctx, 'removal_opened', `Removal vote opened for ${uname(ctx.s, targetId)} (${REMOVAL_REASONS[reason]}). Closes in ${ctx.s.params.removalVoteDays} days.`, {
    actorId: by,
    targetUserId: targetId,
  });
}

export function canOpenRemoval(s: S, actorId: Id, targetId: Id): Check {
  if (!s.users[actorId]?.isNAT) return fail('not_nat', 'Only NAT members can open removal votes.');
  const t = s.users[targetId];
  if (!t || !t.isBN || t.isNAT) return fail('not_bn', 'Removal votes apply to current BNs (not NAT members).');
  if (Object.values(s.removalVotes).some((r) => r.targetUserId === targetId && r.status === 'open'))
    return fail('open', `A removal vote for ${t.username} is already open.`);
  return OK;
}

export const openRemovalVote: Action<{ targetId: Id; reason: 'bad_faith_nominations' | 'vouch_abuse'; note: string }> = (state, actorId, args, now) => {
  assertCheck(canOpenRemoval(state, actorId, args.targetId));
  return run(state, now, (ctx) => openRemovalVoteInternal(ctx, args.targetId, args.reason, args.note, actorId));
};

export function canVoteRemoval(s: S, actorId: Id, voteId: Id): Check {
  const r = s.removalVotes[voteId];
  if (!s.users[actorId]?.isNAT) return fail('not_nat', 'Only NAT members vote on BN removals.');
  if (!r || r.status !== 'open') return fail('closed', 'This removal vote is closed.');
  if (r.votes.some((v) => v.userId === actorId)) return fail('voted', 'You have already voted.');
  return OK;
}

export function removalTally(s: S, r: RemovalVote) {
  const yes = r.votes.filter((v) => v.vote === 'yes').length;
  const no = r.votes.length - yes;
  const members = natMembers(s).length;
  const needed = s.params.interp.voteBasis === 'membership' ? removalYesNeeded(s) : Math.ceil(s.params.removalThreshold * Math.max(1, yes + no) - 1e-9);
  return { yes, no, members, needed, passes: yes >= needed && yes > 0 };
}

function removeBN(ctx: Ctx, userId: Id) {
  const u = ctx.s.users[userId];
  u.isBN = false;
  let voided = 0;
  for (const pet of Object.values(ctx.s.petitions)) {
    if (pet.status !== 'collecting' && pet.status !== 'awaiting_nat') continue;
    for (const sig of pet.signatures) {
      if (sig.userId === userId && !sig.voided) {
        sig.voided = true;
        voided++;
      }
    }
    const active = pet.signatures.filter((x) => !x.voided).length;
    if (pet.status === 'awaiting_nat' && active < ctx.s.params.nominationsRequired) {
      pet.status = 'collecting';
      pet.submittedAt = null;
      pet.deadlineAt = null;
    }
  }
  if (ctx.s.bnProfiles[userId]) ctx.s.bnProfiles[userId].open = false;
  emit(ctx, 'bn_removed', `${u.username} was removed as a BN. ${voided} pending override signature(s) voided; existing nominations stand.`, { targetUserId: userId });
}

export function resolveRemoval(ctx: Ctx, r: RemovalVote, final: boolean) {
  const t = removalTally(ctx.s, r);
  const earlyOk = ctx.s.params.interp.voteBasis === 'membership';
  if (t.passes && (final || earlyOk)) {
    r.status = 'passed';
    emit(ctx, 'removal_closed', `Removal vote for ${uname(ctx.s, r.targetUserId)} passed (${t.yes}/${t.members} NAT, needed ${t.needed}).`, { targetUserId: r.targetUserId });
    removeBN(ctx, r.targetUserId);
  } else if (final) {
    r.status = 'failed';
    emit(ctx, 'removal_closed', `Removal vote for ${uname(ctx.s, r.targetUserId)} failed (${t.yes}/${t.members} NAT yes, needed ${t.needed}).`, {
      targetUserId: r.targetUserId,
    });
  }
}

export const voteRemoval: Action<{ voteId: Id; vote: 'yes' | 'no' }> = (state, actorId, { voteId, vote }, now) => {
  assertCheck(canVoteRemoval(state, actorId, voteId));
  return run(state, now, (ctx) => {
    const r = ctx.s.removalVotes[voteId];
    r.votes.push({ userId: actorId, vote, at: now });
    emit(ctx, 'removal_vote', `${uname(ctx.s, actorId)} voted on the removal of ${uname(ctx.s, r.targetUserId)}.`, { actorId, targetUserId: r.targetUserId });
    resolveRemoval(ctx, r, false);
  });
};

export function resolveCandidacyFinal(ctx: Ctx, c: NATCandidacy) {
  resolveCandidacy(ctx, c, true);
}
