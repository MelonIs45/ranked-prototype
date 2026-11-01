// Admin-only actions: live config, crowd simulation, stat editing. Not part of the proposal.
import seedrandom from 'seedrandom';
import type { Params } from '../config/params';
import { assertCheck, emit, fail, nextId, run, type Ctx } from './core';
import { mapLabel } from './pipeline';
import { addDownload, addPlay } from './player';
import { checkHomeTop } from './rewards';
import { canCastStar, castStarInternal } from './stars';
import { addPlayerReport } from './supervision';
import { openFlags } from './selectors';
import type { Action, Id, User } from './types';

function requireAdmin(state: { users: Record<Id, User> }, actorId: Id) {
  if (!state.users[actorId]?.isAdmin) assertCheck(fail('not_admin', 'Only the Lab Admin can do this.'));
}

function rngFor(ctx: Ctx, tag: string) {
  return seedrandom(`${tag}:${ctx.s.seq}`);
}

function crowdUser(ctx: Ctx): Id {
  const id = nextId(ctx, 'crowd');
  ctx.s.users[id] = {
    id,
    username: `crowd_${id.replace('crowd', '')}`,
    avatarColor: '#5a4c78',
    isBN: false,
    isNAT: false,
    isAdmin: false,
    isCrowd: true,
    isLegacyBN: false,
    bnSince: null,
    natSince: null,
    bnQualifiedVia: null,
    favouritesReceived: 0,
    mappingSubscribers: 0,
    totalPlays: 0,
    title: null,
    playerStrikes: 0,
    chatBanUntil: null,
    tournamentBanned: false,
    mapperPointsAdjust: 0,
    pp: 0,
    ldPp: 0,
    country: '??',
  };
  return id;
}

function players(ctx: Ctx): Id[] {
  return Object.values(ctx.s.users)
    .filter((u) => !u.isAdmin)
    .map((u) => u.id);
}

export const setParams: Action<{ params: Params }> = (state, actorId, { params }, now) => {
  requireAdmin(state, actorId);
  return run(state, now, (ctx) => {
    ctx.s.params = params;
    emit(ctx, 'admin', 'Lab Admin updated the config parameters.', { actorId });
  });
};

export const simulatePlays: Action<{ mapId?: Id; count: number }> = (state, actorId, { mapId, count }, now) => {
  requireAdmin(state, actorId);
  return run(state, now, (ctx) => {
    const rng = rngFor(ctx, 'plays');
    const pool = players(ctx);
    const targets = mapId ? [ctx.s.maps[mapId]] : Object.values(ctx.s.maps).filter((m) => m.status === 'ranked' || m.status === 'qualified');
    for (let i = 0; i < count; i++) {
      const m = targets[Math.floor(rng() * targets.length)];
      addPlay(ctx, pool[Math.floor(rng() * pool.length)], m.id);
    }
    emit(ctx, 'admin', `Crowd simulation: ${count} plays${mapId ? ` on ${mapLabel(ctx.s.maps[mapId])}` : ' across ranked and qualified maps'}.`, { actorId, mapId });
  });
};

export const simulateDownloads: Action<{ mapId?: Id; count: number }> = (state, actorId, { mapId, count }, now) => {
  requireAdmin(state, actorId);
  return run(state, now, (ctx) => {
    const rng = rngFor(ctx, 'dl');
    const pool = players(ctx);
    const targets = mapId ? [ctx.s.maps[mapId]] : Object.values(ctx.s.maps).filter((m) => m.status !== 'wip');
    let fresh = 0;
    for (let i = 0; i < count; i++) {
      const m = targets[Math.floor(rng() * targets.length)];
      if (addDownload(ctx, pool[Math.floor(rng() * pool.length)], m.id)) fresh++;
    }
    emit(ctx, 'admin', `Crowd simulation: ${count} downloads (${fresh} new unique)${mapId ? ` on ${mapLabel(ctx.s.maps[mapId])}` : ''}.`, { actorId, mapId });
  });
};

export const simulatePlayerReports: Action<{ mapId: Id; count: number; reasonCategory?: string }> = (state, actorId, { mapId, count, reasonCategory }, now) => {
  requireAdmin(state, actorId);
  const m = state.maps[mapId];
  if (!m || m.status !== 'qualified') assertCheck(fail('not_qualified', 'Player reports can only be simulated on Qualified maps.'));
  return run(state, now, (ctx) => {
    const map = ctx.s.maps[mapId];
    const already = new Set(openFlags(ctx.s, mapId).filter((f) => f.source === 'player').map((f) => f.userId));
    const eligible = players(ctx).filter((id) => !already.has(id) && id !== map.mapperId && !map.guestMapperIds.includes(id) && !ctx.s.users[id].isCrowd);
    const rng = rngFor(ctx, 'reports');
    for (let i = eligible.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [eligible[i], eligible[j]] = [eligible[j], eligible[i]];
    }
    let made = 0;
    for (let i = 0; i < count; i++) {
      if (ctx.s.maps[mapId].status !== 'qualified') break;
      const uid = eligible[i] ?? crowdUser(ctx);
      addPlayerReport(ctx, mapId, uid, reasonCategory ?? 'Gameplay quality', 'Simulated crowd report.', true);
      made++;
    }
    emit(ctx, 'admin', `Crowd simulation: ${made} player reports on ${mapLabel(map)}.`, { actorId, mapId });
  });
};

export const simulateStarCasts: Action<{ mapId: Id; count: number }> = (state, actorId, { mapId, count }, now) => {
  requireAdmin(state, actorId);
  return run(state, now, (ctx) => {
    const casters = Object.values(ctx.s.users).filter((u) => (u.isBN || u.isNAT) && canCastStar(ctx.s, u.id, mapId, now).ok);
    const rng = rngFor(ctx, 'stars');
    for (let i = casters.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [casters[i], casters[j]] = [casters[j], casters[i]];
    }
    let made = 0;
    for (const u of casters) {
      if (made >= count) break;
      if (!canCastStar(ctx.s, u.id, mapId, now).ok) continue;
      castStarInternal(ctx, u.id, mapId);
      made++;
    }
    emit(ctx, 'admin', `Crowd simulation: ${made} of ${count} requested stars cast at ${mapLabel(ctx.s.maps[mapId])} by eligible BNs/NAT.`, { actorId, mapId });
    checkHomeTop(ctx);
  });
};

export type UserStatPatch = Partial<Pick<User, 'favouritesReceived' | 'mappingSubscribers' | 'totalPlays' | 'mapperPointsAdjust' | 'isLegacyBN' | 'pp'>>;

export const editUserStats: Action<{ userId: Id; patch: UserStatPatch; allowance?: number }> = (state, actorId, { userId, patch, allowance }, now) => {
  requireAdmin(state, actorId);
  return run(state, now, (ctx) => {
    Object.assign(ctx.s.users[userId], patch);
    if (allowance !== undefined && ctx.s.nominators[userId]) ctx.s.nominators[userId].allowanceAvailable = allowance;
    emit(ctx, 'admin', `Lab Admin edited ${ctx.s.users[userId].username}'s stats.`, { actorId, targetUserId: userId });
    checkHomeTop(ctx);
  });
};
