// Mapper actions: create, category, WIP -> Pending, revive.
import { assertCheck, emit, fail, nextId, OK, run, type Check } from './core';
import { mapLabel } from './pipeline';
import { categoryName, isCategoryLocked } from './selectors';
import type { Action, Category, Difficulty, Id, MVIssue, State } from './types';

type S = State;

export function canEditMap(s: S, actorId: Id, mapId: Id): Check {
  const m = s.maps[mapId];
  if (!m) return fail('no_map', 'That beatmap does not exist.');
  if (m.mapperId !== actorId) return fail('not_owner', 'Only the host mapper can change this map.');
  return OK;
}

export function canSetCategory(s: S, actorId: Id, mapId: Id): Check {
  const c = canEditMap(s, actorId, mapId);
  if (!c.ok) return c;
  if (isCategoryLocked(s, s.maps[mapId])) return fail('category_locked', 'The category is locked after the first nomination.');
  return OK;
}

export function canMoveToPending(s: S, actorId: Id, mapId: Id, category: Category | null): Check {
  const c = canEditMap(s, actorId, mapId);
  if (!c.ok) return c;
  if (s.maps[mapId].status !== 'wip') return fail('not_wip', 'Only WIP maps can be moved to Pending.');
  if (category === null) return fail('category_required', 'Pick a category (Mechanics or Level Design) before moving to Pending.');
  if (s.maps[mapId].difficulties.length === 0) return fail('no_diffs', 'Add at least one difficulty first.');
  return OK;
}

export function canRevive(s: S, actorId: Id, mapId: Id): Check {
  const c = canEditMap(s, actorId, mapId);
  if (!c.ok) return c;
  if (s.maps[mapId].status !== 'graveyard') return fail('not_graveyard', 'Only graveyarded maps can be revived.');
  return OK;
}

export interface CreateMapArgs {
  title: string;
  artist: string;
  genre: string;
  language: string;
  isFA: boolean;
  description: string;
  difficulties: Difficulty[];
  mvIssues: MVIssue[];
  guestMapperIds?: Id[];
}

export const createMap: Action<CreateMapArgs> = (state, actorId, a, now) => {
  if (!state.users[actorId] || state.users[actorId].isAdmin) assertCheck(fail('no_user', 'Switch to a mapper persona to create maps.'));
  if (!a.title.trim() || !a.artist.trim()) assertCheck(fail('metadata', 'Title and artist are required.'));
  if (!a.difficulties.length) assertCheck(fail('no_diffs', 'Add at least one difficulty.'));
  return run(state, now, (ctx) => {
    const id = nextId(ctx, 'm');
    ctx.s.maps[id] = {
      id,
      title: a.title.trim(),
      artist: a.artist.trim(),
      mapperId: actorId,
      guestMapperIds: a.guestMapperIds ?? [],
      genre: a.genre,
      language: a.language,
      isFA: a.isFA,
      category: null,
      difficulties: a.difficulties,
      status: 'wip',
      mvIssues: a.mvIssues,
      description: a.description,
      createdAt: now,
      pendingAt: null,
      qualifiedAt: null,
      qualifiedElapsedMs: 0,
      frozen: false,
      rankedAt: null,
      dqCount: 0,
      lastActivityAt: now,
      legacyPlaysBase: 0,
    };
    emit(ctx, 'map_created', `${ctx.s.users[actorId].username} created ${mapLabel(ctx.s.maps[id])} (WIP).`, { mapId: id, actorId });
  });
};

export const setCategory: Action<{ mapId: Id; category: Category }> = (state, actorId, { mapId, category }, now) => {
  assertCheck(canSetCategory(state, actorId, mapId));
  return run(state, now, (ctx) => {
    const m = ctx.s.maps[mapId];
    m.category = category;
    m.lastActivityAt = now;
    emit(ctx, 'map_category', `${mapLabel(m)} category set to ${categoryName(ctx.s.params, category)}.`, { mapId, actorId });
  });
};

export const moveToPending: Action<{ mapId: Id; category: Category }> = (state, actorId, { mapId, category }, now) => {
  assertCheck(canMoveToPending(state, actorId, mapId, category));
  return run(state, now, (ctx) => {
    const m = ctx.s.maps[mapId];
    m.category = category;
    m.status = 'pending';
    m.pendingAt = now;
    m.lastActivityAt = now;
    emit(ctx, 'map_pending', `${mapLabel(m)} moved to Pending as ${categoryName(ctx.s.params, category)}.`, { mapId, actorId });
  });
};

export const reviveMap: Action<{ mapId: Id; category?: Category }> = (state, actorId, { mapId, category }, now) => {
  assertCheck(canRevive(state, actorId, mapId));
  return run(state, now, (ctx) => {
    const m = ctx.s.maps[mapId];
    if (category) m.category = category;
    m.status = m.category ? 'pending' : 'wip';
    m.pendingAt = m.status === 'pending' ? now : m.pendingAt;
    m.lastActivityAt = now;
    emit(ctx, 'map_revived', `${mapLabel(m)} was revived from the graveyard to ${m.status === 'pending' ? 'Pending' : 'WIP'}.`, { mapId, actorId });
  });
};

/** Mapper "bump": any update counts as activity and resets the graveyard timer. */
export const touchMap: Action<{ mapId: Id }> = (state, actorId, { mapId }, now) => {
  assertCheck(canEditMap(state, actorId, mapId));
  const m = state.maps[mapId];
  if (m.status !== 'wip' && m.status !== 'pending') assertCheck(fail('status', 'Only WIP and Pending maps can be updated.'));
  return run(state, now, (ctx) => {
    ctx.s.maps[mapId].lastActivityAt = now;
    emit(ctx, 'map_created', `${mapLabel(ctx.s.maps[mapId])} was updated by its mapper.`, { mapId, actorId });
  });
};
