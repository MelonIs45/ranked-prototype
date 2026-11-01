import { emptyState } from '../src/data/seed';
import { TEST_QUESTIONS } from '../src/data/questions';
import * as E from '../src/engine';
import type { Action, Beatmapset, Category, Id, MVIssue, State, User } from '../src/engine';

let n = 0;

export function addUser(s: State, username: string, o: Partial<User> = {}): User {
  const id = `t${++n}_${username}`;
  const u: User = {
    id, username, avatarColor: '#fff', isBN: false, isNAT: false, isAdmin: false, isCrowd: false, isLegacyBN: false,
    bnSince: null, natSince: null, bnQualifiedVia: null, favouritesReceived: 0, mappingSubscribers: 0, totalPlays: 0,
    title: null, playerStrikes: 0, chatBanUntil: null, tournamentBanned: false, mapperPointsAdjust: 0, pp: 0, ldPp: 0, country: 'XX', ...o,
  };
  s.users[id] = u;
  if (u.isBN || u.isNAT) {
    if (u.bnSince === null) u.bnSince = s.now - 400 * E.DAY;
    if (u.isNAT && u.natSince === null) u.natSince = s.now - 400 * E.DAY;
    s.nominators[id] = E.newNominatorState(id, s.now, 5);
  }
  return u;
}

export function addMap(s: State, mapperId: Id, o: Partial<Beatmapset> = {}): Beatmapset {
  const id = `tm${++n}`;
  const m: Beatmapset = {
    id, title: `Map ${id}`, artist: 'Test Artist', mapperId, guestMapperIds: [], genre: 'Rock', language: 'English', isFA: false,
    category: 'level_design' as Category, difficulties: [{ name: 'Insane', starRating: 5, skillTags: ['aim'], lengthSec: 120 }],
    status: 'pending', mvIssues: [] as MVIssue[], description: '', createdAt: s.now, pendingAt: s.now, qualifiedAt: null,
    qualifiedElapsedMs: 0, frozen: false, rankedAt: null, dqCount: 0, lastActivityAt: s.now, legacyPlaysBase: 0, ...o,
  };
  s.maps[id] = m;
  return m;
}

export interface World {
  s: State;
  admin: User;
  mapper: User;
  bns: User[];
  nat: User[];
  players: User[];
}

/** A small controlled world: 1 mapper, `bnCount` BNs, `natCount` NAT, `playerCount` players. */
export function world(o: { bnCount?: number; natCount?: number; playerCount?: number } = {}): World {
  const s = emptyState();
  s.testQuestions = TEST_QUESTIONS;
  s.jobs.lastFaPackAt = s.now;
  // Mark old months as done so only the months a test creates get packs.
  for (let k = 0; k < 6; k++) s.jobs.ldPacksDone[E.monthKey(E.addMonths(s.now, -k - 2))] = true;
  const admin = addUser(s, 'admin', { isAdmin: true });
  const mapper = addUser(s, 'mapper');
  const bns = Array.from({ length: o.bnCount ?? 6 }, (_, i) => addUser(s, `bn${i + 1}`, { isBN: true }));
  const nat = Array.from({ length: o.natCount ?? 3 }, (_, i) => addUser(s, `nat${i + 1}`, { isBN: true, isNAT: true, isLegacyBN: true }));
  const players = Array.from({ length: o.playerCount ?? 5 }, (_, i) => addUser(s, `p${i + 1}`));
  return { s, admin, mapper, bns, nat, players };
}

/** Run an engine action and return the new state. */
export function act<A>(s: State, fn: Action<A>, actor: User | Id, args: A): State {
  return fn(s, typeof actor === 'string' ? actor : actor.id, args, s.now).state;
}

export function advanceDays(s: State, days: number): State {
  return E.advance(s, days * E.DAY).state;
}

export function expectRule(fn: () => unknown, code: string) {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(E.RuleError);
    expect((e as E.RuleError).code).toBe(code);
    return (e as E.RuleError).message;
  }
  throw new Error(`Expected RuleError(${code}) but the action succeeded`);
}

/** Nominate with three BNs to reach Qualified. */
export function qualify(s: State, mapId: Id, by: User[]): State {
  for (const u of by.slice(0, 3)) s = act(s, E.nominate, u, { mapId });
  return s;
}

export function correctAnswers(s: State, appId: Id): number[] {
  const app = s.applications[appId];
  return app.questionIds.map((q) => s.testQuestions.find((x) => x.id === q)!.correctIndex);
}
