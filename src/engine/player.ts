// Player actions: simulated play and download.
import seedrandom from 'seedrandom';
import { assertCheck, emit, fail, nextId, OK, run, type Check, type Ctx } from './core';
import { mapLabel, name } from './pipeline';
import type { Action, Id, Play, State } from './types';

type S = State;

export function canPlay(s: S, actorId: Id, mapId: Id): Check {
  const m = s.maps[mapId];
  if (!m) return fail('no_map', 'That beatmap does not exist.');
  if (!s.users[actorId] || s.users[actorId].isAdmin) return fail('admin', 'Switch to a player persona to play (or use the crowd simulator).');
  if (m.status === 'wip') return fail('wip', 'WIP maps are not available to play yet.');
  return OK;
}

export function canDownload(s: S, actorId: Id, mapId: Id): Check {
  const m = s.maps[mapId];
  if (!m) return fail('no_map', 'That beatmap does not exist.');
  if (!s.users[actorId] || s.users[actorId].isAdmin) return fail('admin', 'Switch to a player persona to download (or use the crowd simulator).');
  if (m.status === 'wip') return fail('wip', 'WIP maps are not available to download yet.');
  return OK;
}

/** Generate one simulated play; deterministic per play id. */
export function addPlay(ctx: Ctx, userId: Id, mapId: Id, diffName?: string): Play {
  const m = ctx.s.maps[mapId];
  const id = nextId(ctx, 'p');
  const rng = seedrandom(`play:${id}`);
  const diff = m.difficulties.find((d) => d.name === diffName) ?? m.difficulties[Math.floor(rng() * m.difficulties.length)];
  const skill = 0.55 + rng() * 0.45;
  const accuracy = Math.round((0.86 + skill * 0.14 - rng() * 0.03) * 10000) / 100;
  const pass = rng() < 0.75;
  const score = Math.round((pass ? 400_000 + skill * 600_000 : 50_000 + rng() * 300_000) * (0.95 + rng() * 0.05));
  const pp = m.status === 'ranked' ? Math.round(diff.starRating ** 2.6 * skill ** 3 * (accuracy / 100) ** 8 * 2.1) : 0;
  const durationSec = Math.round(pass ? diff.lengthSec : diff.lengthSec * (0.15 + rng() * 0.6));
  const play: Play = { id, userId, mapId, diffName: diff.name, score, accuracy, pp, durationSec, at: ctx.now };
  ctx.s.plays[id] = play;
  return play;
}

export function addDownload(ctx: Ctx, userId: Id, mapId: Id): boolean {
  const key = `${userId}|${mapId}`;
  if (ctx.s.downloads[key]) return false;
  ctx.s.downloads[key] = { userId, mapId, at: ctx.now };
  return true;
}

export const play: Action<{ mapId: Id; diffName?: string }> = (state, actorId, { mapId, diffName }, now) => {
  assertCheck(canPlay(state, actorId, mapId));
  return run(state, now, (ctx) => {
    const p = addPlay(ctx, actorId, mapId, diffName);
    emit(
      ctx,
      'play',
      `${name(ctx.s, actorId)} played ${mapLabel(ctx.s.maps[mapId])} [${p.diffName}]: ${p.score.toLocaleString('en-US')} (${p.accuracy.toFixed(2)}%${p.pp ? `, ${p.pp} pp` : ''}).`,
      { mapId, actorId },
    );
  });
};

export const download: Action<{ mapId: Id }> = (state, actorId, { mapId }, now) => {
  assertCheck(canDownload(state, actorId, mapId));
  return run(state, now, (ctx) => {
    const fresh = addDownload(ctx, actorId, mapId);
    emit(ctx, 'download', `${name(ctx.s, actorId)} downloaded ${mapLabel(ctx.s.maps[mapId])}${fresh ? '' : ' again (not counted twice)'}.`, { mapId, actorId });
  });
};
