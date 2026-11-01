import { current, isDraft } from 'immer';
import type { Params } from '../config/params';
import { DAY, monthKey, seasonFor } from './time';
import type {
  Beatmapset,
  BnCriterion,
  BonusStarGrant,
  Category,
  Download,
  Flag,
  FlagCase,
  Id,
  Ms,
  Nomination,
  NominatorState,
  OverridePetition,
  Pack,
  Play,
  Season,
  StarCast,
  State,
  User,
} from './types';

// ---------------------------------------------------------------------------
// Memoisation: derived indexes are cached per record object. Indexed records are
// append-only (new keys only; the grouping fields never change). A plain record is
// valid while its key count is unchanged. An Immer draft is keyed on `state.seq`, which
// every append bumps (Object.keys on a draft is slow: one proxy trap per key), and its
// index is built from `current()` so no proxies are stored. Callers that mutate look the
// item up again on the draft by id.

function memoBy<K extends object, R>(fn: (k: K) => R): (k: K, ver: number) => R {
  const cache = new WeakMap<object, { v: number; r: R }>();
  const plain = (k: K): R => {
    const v = Object.keys(k).length;
    const hit = cache.get(k);
    if (hit && hit.v === v) return hit.r;
    const r = fn(k);
    cache.set(k, { v, r });
    return r;
  };
  return (k: K, ver: number) => {
    if (!isDraft(k)) return plain(k);
    const hit = cache.get(k);
    if (hit && hit.v === ver) return hit.r;
    // current() returns the base object when the draft is unmodified, so its cache is reused.
    const r = plain(current(k) as K);
    cache.set(k, { v: ver, r });
    return r;
  };
}

function groupBy<T>(items: T[], key: (t: T) => string): Record<string, T[]> {
  const out: Record<string, T[]> = {};
  for (const it of items) (out[key(it)] ??= []).push(it);
  return out;
}

const starsByMapIdx = memoBy((stars: Record<Id, StarCast>) => groupBy(Object.values(stars), (s) => s.mapId));
const starsByCasterIdx = memoBy((stars: Record<Id, StarCast>) => groupBy(Object.values(stars), (s) => s.castorId));
const nomsByMapIdx = memoBy((n: Record<Id, Nomination>) => groupBy(Object.values(n), (x) => x.mapId));
const nomsByUserIdx = memoBy((n: Record<Id, Nomination>) => groupBy(Object.values(n), (x) => x.userId));
const playsByMapIdx = memoBy((p: Record<Id, Play>) => groupBy(Object.values(p), (x) => x.mapId));
const playsByUserIdx = memoBy((p: Record<Id, Play>) => groupBy(Object.values(p), (x) => x.userId));
const downloadsByMapIdx = memoBy((d: Record<string, Download>) => groupBy(Object.values(d), (x) => x.mapId));
const flagsByMapIdx = memoBy((f: Record<Id, Flag>) => groupBy(Object.values(f), (x) => x.mapId));

type S = State;

// ---------------------------------------------------------------------------
// Users and roles

export const isNominator = (u: User | undefined): boolean => !!u && (u.isBN || u.isNAT);

export function rolesOf(u: User): string[] {
  const r: string[] = [];
  if (u.isAdmin) r.push('Admin');
  if (u.isNAT) r.push('NAT');
  else if (u.isBN) r.push('BN');
  if (u.isLegacyBN) r.push('Legacy');
  return r;
}

export function primaryRole(s: S, u: User): 'admin' | 'nat' | 'bn' | 'mapper' | 'player' {
  if (u.isAdmin) return 'admin';
  if (u.isNAT) return 'nat';
  if (u.isBN) return 'bn';
  if (Object.values(s.maps).some((m) => m.mapperId === u.id)) return 'mapper';
  return 'player';
}

export function natMembers(s: S): User[] {
  return Object.values(s.users).filter((u) => u.isNAT);
}

/** BN group excluding NAT (NAT members are tallied separately in candidacy votes). */
export function bnMembers(s: S): User[] {
  return Object.values(s.users).filter((u) => u.isBN && !u.isNAT);
}

export function allNominators(s: S): User[] {
  return Object.values(s.users).filter(isNominator);
}

// ---------------------------------------------------------------------------
// Nominations and pipeline

export function mapNominations(s: S, mapId: Id): Nomination[] {
  return (nomsByMapIdx(s.nominations, s.seq)[mapId] ?? []).map((n) => s.nominations[n.id]);
}

export function activeNominations(s: S, mapId: Id): Nomination[] {
  return mapNominations(s, mapId).filter((n) => n.voidedAt === null);
}

export function nominatorIdsOf(s: S, mapId: Id): Id[] {
  return activeNominations(s, mapId).map((n) => n.userId);
}

export function userNominations(s: S, userId: Id): Nomination[] {
  return (nomsByUserIdx(s.nominations, s.seq)[userId] ?? []).map((n) => s.nominations[n.id]);
}

export function everNominated(s: S, userId: Id, mapId: Id): boolean {
  return mapNominations(s, mapId).some((n) => n.userId === userId);
}

export function isCategoryLocked(s: S, map: Beatmapset): boolean {
  return map.status === 'qualified' || map.status === 'ranked' || activeNominations(s, map.id).length > 0;
}

export function openPetition(s: S, mapId: Id): OverridePetition | undefined {
  return Object.values(s.petitions).find((p) => p.mapId === mapId && (p.status === 'collecting' || p.status === 'awaiting_nat'));
}

export function activeSignatures(p: OverridePetition) {
  return p.signatures.filter((x) => !x.voided);
}

export function runVerifier(map: Beatmapset) {
  const unrankable = map.mvIssues.filter((i) => i.severity === 'unrankable');
  const others = map.mvIssues.filter((i) => i.severity !== 'unrankable');
  return { ok: unrankable.length === 0, unrankable, others };
}

export function openFlags(s: S, mapId: Id): Flag[] {
  return (flagsByMapIdx(s.flags, s.seq)[mapId] ?? []).map((f) => s.flags[f.id]).filter((f) => f && f.closedAt === null);
}

export function mapFlags(s: S, mapId: Id): Flag[] {
  return (flagsByMapIdx(s.flags, s.seq)[mapId] ?? []).map((f) => s.flags[f.id]).filter(Boolean);
}

export function openCase(s: S, mapId: Id): FlagCase | undefined {
  return Object.values(s.cases).find((c) => c.mapId === mapId && c.outcome === null);
}

export function qualifiedDaysElapsed(map: Beatmapset): number {
  return map.qualifiedElapsedMs / DAY;
}

export function qualifiedRemainingMs(s: S, map: Beatmapset): number {
  return Math.max(0, s.params.qualifiedDays * DAY - map.qualifiedElapsedMs);
}

export function accrualIntervalDays(params: Params, ns: NominatorState, now: Ms): number {
  const slow = ns.abuseSlowUntil !== null && ns.abuseSlowUntil > now ? ns.abuseSlowLevels : 0;
  const lvl = Math.min(ns.cooldownLevel + slow, params.cooldownAccrualDays.length - 1);
  return params.cooldownAccrualDays[lvl] / Math.max(params.allowancePerDay, 0.0001);
}

export function effectiveCooldownLevel(params: Params, ns: NominatorState, now: Ms): number {
  const slow = ns.abuseSlowUntil !== null && ns.abuseSlowUntil > now ? ns.abuseSlowLevels : 0;
  return Math.min(ns.cooldownLevel + slow, params.cooldownAccrualDays.length - 1);
}

export function nextAccrualAt(params: Params, ns: NominatorState, now: Ms): Ms {
  return ns.lastAccrualAt + accrualIntervalDays(params, ns, now) * DAY;
}

// ---------------------------------------------------------------------------
// Stars

export function mapStars(s: S, mapId: Id): StarCast[] {
  return starsByMapIdx(s.stars, s.seq)[mapId] ?? [];
}

export function casterStars(s: S, userId: Id): StarCast[] {
  return starsByCasterIdx(s.stars, s.seq)[userId] ?? [];
}

export type StarWindow = 'recent' | 'season' | 'year' | 'all';

/** Star score for a map in a window. 'recent' applies the optional half-life decay. */
export function starScore(s: S, mapId: Id, window: StarWindow, now: Ms = s.now): number {
  const p = s.params;
  const stars = mapStars(s, mapId);
  let total = 0;
  if (window === 'recent') {
    const from = now - p.sort.recentWindowDays * DAY;
    for (const st of stars) {
      if (st.at <= from || st.at > now) continue;
      total += p.sort.decayOn ? Math.pow(0.5, (now - st.at) / DAY / p.sort.decayHalfLifeDays) : 1;
    }
    return total;
  }
  if (window === 'season') {
    const season = seasonFor(now, p);
    for (const st of stars) if (st.at >= season.startsAt && st.at <= now) total++;
    return total;
  }
  if (window === 'year') {
    const from = now - 365 * DAY;
    for (const st of stars) if (st.at > from && st.at <= now) total++;
    return total;
  }
  for (const st of stars) if (st.at <= now) total++;
  return total;
}

/** Plain count of stars in a window (no decay), for display. */
export function starCount(s: S, mapId: Id, window: StarWindow, now: Ms = s.now): number {
  if (window !== 'recent') return starScore(s, mapId, window, now);
  const from = now - s.params.sort.recentWindowDays * DAY;
  return mapStars(s, mapId).filter((st) => st.at > from && st.at <= now).length;
}

export interface Wallet {
  weekly: number;
  spentBase: StarCast[];
  availableBase: number;
  bonus: BonusStarGrant[];
  availableBonus: number;
  available: number;
  nextReturnAt: Ms | null;
}

export function weeklyStars(params: Params, u: User): number {
  return u.isNAT ? params.stars.weeklyNAT : u.isBN ? params.stars.weeklyBN : 0;
}

export function bonusActive(g: BonusStarGrant, now: Ms): boolean {
  return g.remaining > 0 && (g.expiresAt === null || g.expiresAt > now);
}

export function starWallet(s: S, userId: Id, now: Ms = s.now): Wallet {
  const u = s.users[userId];
  const weekly = u ? weeklyStars(s.params, u) : 0;
  const spentBase = casterStars(s, userId)
    .filter((st) => st.fromBonus === null && st.replenishAt !== null && st.replenishAt > now)
    .sort((a, b) => (a.replenishAt ?? 0) - (b.replenishAt ?? 0));
  const availableBase = Math.max(0, weekly - spentBase.length);
  const bonus = Object.values(s.bonusGrants)
    .filter((g) => g.userId === userId && bonusActive(g, now))
    .sort((a, b) => (a.expiresAt ?? Infinity) - (b.expiresAt ?? Infinity));
  const availableBonus = bonus.reduce((a, g) => a + g.remaining, 0);
  // With more spent than the weekly allowance (e.g. after a demotion), the next return that frees a slot is later.
  const overflow = Math.max(0, spentBase.length - weekly);
  const nextReturnAt = availableBase === 0 && spentBase.length > 0 ? (spentBase[overflow]?.replenishAt ?? null) : null;
  return { weekly, spentBase, availableBase, bonus, availableBonus, available: availableBase + availableBonus, nextReturnAt };
}

// ---------------------------------------------------------------------------
// Engagement metrics

export function mapPlays(s: S, mapId: Id): Play[] {
  return playsByMapIdx(s.plays, s.seq)[mapId] ?? [];
}

export function userPlays(s: S, userId: Id): Play[] {
  return playsByUserIdx(s.plays, s.seq)[userId] ?? [];
}

export function playTimeHours(s: S, mapId: Id): number {
  return mapPlays(s, mapId).reduce((a, p) => a + p.durationSec, 0) / 3600;
}

export function legacyPlayCount(s: S, mapId: Id): number {
  return (s.maps[mapId]?.legacyPlaysBase ?? 0) + mapPlays(s, mapId).length;
}

export function uniqueDownloads(s: S, mapId: Id): number {
  return (downloadsByMapIdx(s.downloads, s.seq)[mapId] ?? []).length;
}

export function mapLeaderboard(s: S, mapId: Id, diffName?: string): Play[] {
  const best = new Map<Id, Play>();
  for (const p of mapPlays(s, mapId)) {
    if (diffName && p.diffName !== diffName) continue;
    const cur = best.get(p.userId);
    if (!cur || p.score > cur.score) best.set(p.userId, p);
  }
  return [...best.values()].sort((a, b) => b.score - a.score);
}

export function maxStarRating(m: Beatmapset): number {
  return m.difficulties.reduce((a, d) => Math.max(a, d.starRating), 0);
}

export function skillTagsOf(m: Beatmapset): string[] {
  return [...new Set(m.difficulties.flatMap((d) => d.skillTags))];
}

// ---------------------------------------------------------------------------
// Listings

export type SortKey = 'best_recent' | 'best_season' | 'best_year' | 'best_all' | 'recent' | 'plays' | 'star_rating' | 'title';

export interface MapQuery {
  category?: Category | null;
  status: Beatmapset['status'];
  sort?: SortKey;
  bestOfLD?: boolean;
  genre?: string;
  language?: string;
  faOnly?: boolean;
  srMin?: number;
  srMax?: number;
  skillTags?: string[];
  search?: string;
}

export const LD_SORTS: SortKey[] = ['best_recent', 'best_season', 'best_year', 'best_all', 'recent'];
export const MECH_SORTS: SortKey[] = ['recent', 'plays', 'star_rating', 'title'];

export function defaultSort(category: Category | null | undefined, status: Beatmapset['status']): SortKey {
  if (status !== 'ranked') return 'recent';
  return category === 'level_design' ? 'best_recent' : 'recent';
}

const sortWindow: Partial<Record<SortKey, StarWindow>> = {
  best_recent: 'recent',
  best_season: 'season',
  best_year: 'year',
  best_all: 'all',
};

function recencyOf(m: Beatmapset): Ms {
  if (m.status === 'ranked') return m.rankedAt ?? 0;
  if (m.status === 'qualified') return m.qualifiedAt ?? 0;
  return m.lastActivityAt;
}

export function listMaps(s: S, q: MapQuery): Beatmapset[] {
  let maps = Object.values(s.maps).filter((m) => m.status === q.status);
  if (q.category && (q.status === 'ranked' || q.status === 'qualified' || q.status === 'pending'))
    maps = maps.filter((m) => m.category === q.category);
  if (q.bestOfLD) {
    const best = bestOfLDSet(s);
    maps = maps.filter((m) => best.has(m.id));
  }
  if (q.genre) maps = maps.filter((m) => m.genre === q.genre);
  if (q.language) maps = maps.filter((m) => m.language === q.language);
  if (q.faOnly) maps = maps.filter((m) => m.isFA);
  if (q.srMin !== undefined) maps = maps.filter((m) => maxStarRating(m) >= q.srMin!);
  if (q.srMax !== undefined) maps = maps.filter((m) => maxStarRating(m) <= q.srMax!);
  if (q.skillTags?.length) maps = maps.filter((m) => q.skillTags!.every((t) => skillTagsOf(m).includes(t)));
  if (q.search) {
    const needle = q.search.toLowerCase();
    maps = maps.filter(
      (m) =>
        m.title.toLowerCase().includes(needle) ||
        m.artist.toLowerCase().includes(needle) ||
        (s.users[m.mapperId]?.username.toLowerCase().includes(needle) ?? false),
    );
  }
  const sort = q.sort ?? defaultSort(q.category, q.status);
  const win = sortWindow[sort];
  if (win) {
    const score = new Map(maps.map((m) => [m.id, starScore(s, m.id, win)]));
    maps.sort((a, b) => score.get(b.id)! - score.get(a.id)! || recencyOf(b) - recencyOf(a));
  } else if (sort === 'plays') {
    maps.sort((a, b) => legacyPlayCount(s, b.id) - legacyPlayCount(s, a.id));
  } else if (sort === 'star_rating') {
    maps.sort((a, b) => maxStarRating(b) - maxStarRating(a));
  } else if (sort === 'title') {
    maps.sort((a, b) => a.title.localeCompare(b.title));
  } else {
    maps.sort((a, b) => recencyOf(b) - recencyOf(a));
  }
  return maps;
}

export function rankedLD(s: S): Beatmapset[] {
  return Object.values(s.maps).filter((m) => m.status === 'ranked' && m.category === 'level_design');
}

/** Home page box: top N ranked Level Design maps by Best (recent). Maps with no recent stars don't qualify. */
export function homeTop(s: S, now: Ms = s.now): Beatmapset[] {
  const scored = rankedLD(s)
    .filter((m) => (m.rankedAt ?? 0) <= now)
    .map((m) => ({ m, score: starScore(s, m.id, 'recent', now) }))
    .filter((x) => x.score > 0);
  scored.sort((a, b) => b.score - a.score || (b.m.rankedAt ?? 0) - (a.m.rankedAt ?? 0) || a.m.id.localeCompare(b.m.id));
  return scored.slice(0, s.params.homeTopN).map((x) => x.m);
}

// ---------------------------------------------------------------------------
// Packs

const bestOfLDIdx = memoBy((packs: Record<Id, Pack>) => {
  const set = new Set<Id>();
  for (const p of Object.values(packs)) if (p.type === 'ld_top_quarter') p.mapIds.forEach((id) => set.add(id));
  return set;
});

export function bestOfLDSet(s: S): Set<Id> {
  return bestOfLDIdx(s.packs, s.seq);
}

export function isBestOfLD(s: S, mapId: Id): boolean {
  return bestOfLDSet(s).has(mapId);
}

export function packsSorted(s: S): Pack[] {
  return Object.values(s.packs).sort((a, b) => b.createdAt - a.createdAt);
}

/** Season playlist: every Best of Level Design map from the season's months, as of `asOf`. */
export function seasonPlaylist(s: S, season: Season, asOf: Ms = s.now): Beatmapset[] {
  const months = new Set<string>();
  for (let t = season.startsAt; t < season.endsAt; t += 28 * DAY) months.add(monthKey(t));
  months.add(monthKey(season.endsAt - 1));
  const ids = new Set<Id>();
  for (const p of Object.values(s.packs))
    if (p.type === 'ld_top_quarter' && months.has(p.periodKey) && p.createdAt <= asOf) p.mapIds.forEach((id) => ids.add(id));
  return [...ids].map((id) => s.maps[id]).filter(Boolean);
}

export function playlistProgress(s: S, userId: Id, playlist: Beatmapset[], until: Ms = s.now) {
  const played = new Set(userPlays(s, userId).filter((p) => p.at <= until).map((p) => p.mapId));
  const cleared = playlist.filter((m) => played.has(m.id));
  return { cleared: cleared.length, total: playlist.length, clearedIds: new Set(cleared.map((m) => m.id)) };
}

// ---------------------------------------------------------------------------
// Nominator leaderboards

export interface LeaderRow {
  userId: Id;
  points: number;
  rank: number;
}

export function leaderboard(s: S, season: Season, board: 'main' | 'fa', upTo: Ms = s.now): LeaderRow[] {
  const end = Math.min(season.endsAt, upTo + 1);
  const points: Record<Id, number> = {};
  const nomCache = new Map<Id, Id[]>();
  for (const st of Object.values((s.stars))) {
    if (st.at < season.startsAt || st.at >= end) continue;
    const m = s.maps[st.mapId];
    if (!m || m.category !== 'level_design') continue;
    const counts = board === 'fa' ? m.isFA : !m.isFA || s.params.faStarsCountOnMain;
    if (!counts) continue;
    let noms = nomCache.get(m.id);
    if (!noms) {
      noms = nominatorIdsOf(s, m.id);
      nomCache.set(m.id, noms);
    }
    for (const n of noms) points[n] = (points[n] ?? 0) + 1;
  }
  const rows = Object.entries(points)
    .map(([userId, pts]) => ({ userId, points: pts, rank: 0 }))
    .sort((a, b) => b.points - a.points || (s.users[a.userId]?.username ?? '').localeCompare(s.users[b.userId]?.username ?? ''));
  rows.forEach((r, i) => (r.rank = i + 1));
  return rows;
}

// ---------------------------------------------------------------------------
// Nominator performance (NAT invite cycle)

export function nominatorStats(s: S, userId: Id, now: Ms = s.now) {
  const p = s.params.natInvite;
  const noms = userNominations(s, userId);
  const ratioFrom = now - p.ratioWindowDays * DAY;
  const actFrom = now - p.activityWindowDays * DAY;
  const inRatio = noms.filter((n) => n.at > ratioFrom && n.at <= now);
  const rankedCount = inRatio.filter((n) => n.voidedAt === null && s.maps[n.mapId]?.status === 'ranked').length;
  const dqs = Object.values(s.dqs).filter((d) => d.nominatorIds.includes(userId) && d.at > ratioFrom && d.at <= now).length;
  const allDqs = Object.values(s.dqs).filter((d) => d.nominatorIds.includes(userId));
  return {
    total: noms.length,
    inRatioWindow: inRatio.length,
    rankedCount,
    dqs,
    allDqs,
    ratio: rankedCount / (dqs + 1),
    ratioEligible: inRatio.length >= p.minNominations,
    activity: noms.filter((n) => n.at > actFrom && n.at <= now).length,
  };
}

/** BNs (not NAT) in the top X% by ratio and top Y% by activity, per spec 6.3. */
export function natInviteEligible(s: S, now: Ms = s.now): Id[] {
  const p = s.params.natInvite;
  const bns = bnMembers(s);
  const stats = bns.map((u) => ({ u, st: nominatorStats(s, u.id, now) }));
  const byRatio = stats.filter((x) => x.st.ratioEligible).sort((a, b) => b.st.ratio - a.st.ratio);
  const byActivity = [...stats].sort((a, b) => b.st.activity - a.st.activity);
  const ratioCut = Math.ceil((bns.length * p.ratioTopPercent) / 100);
  const actCut = Math.ceil((bns.length * p.activityTopPercent) / 100);
  const topRatio = new Set(byRatio.slice(0, ratioCut).map((x) => x.u.id));
  const topAct = new Set(byActivity.slice(0, actCut).filter((x) => x.st.activity > 0).map((x) => x.u.id));
  return [...topRatio].filter((id) => topAct.has(id));
}

// ---------------------------------------------------------------------------
// BN eligibility

export function rankedHostCount(s: S, userId: Id): number {
  return Object.values(s.maps).filter((m) => m.status === 'ranked' && m.mapperId === userId).length;
}

export function vouchesReceived(s: S, userId: Id) {
  return Object.values(s.vouches)
    .filter((v) => v.candidateId === userId)
    .sort((a, b) => b.at - a.at);
}

export function validVouchCount(s: S, userId: Id): number {
  return vouchesReceived(s, userId).filter((v) => isNominator(s.users[v.voucherId])).length;
}

export interface CriterionStatus {
  key: BnCriterion;
  label: string;
  value: number | boolean;
  threshold: number | boolean;
  met: boolean;
}

export function bnCriteriaStatus(s: S, userId: Id): CriterionStatus[] {
  const u = s.users[userId];
  const c = s.params.bnCriteria;
  const ranked = rankedHostCount(s, userId);
  const vouches = validVouchCount(s, userId);
  return [
    { key: 'legacy', label: 'Current or former BN under the old system', value: u.isLegacyBN, threshold: true, met: u.isLegacyBN },
    { key: 'favourites', label: 'Profile beatmap favourites', value: u.favouritesReceived, threshold: c.favourites, met: u.favouritesReceived >= c.favourites },
    { key: 'subscribers', label: 'Mapping subscribers', value: u.mappingSubscribers, threshold: c.subscribers, met: u.mappingSubscribers >= c.subscribers },
    { key: 'plays', label: 'Total plays on own beatmaps', value: u.totalPlays, threshold: c.plays, met: u.totalPlays >= c.plays },
    { key: 'rankedMaps', label: 'Ranked beatmaps as host', value: ranked, threshold: c.rankedMaps, met: ranked >= c.rankedMaps },
    { key: 'vouches', label: 'Vouches from current BNs', value: vouches, threshold: c.vouches, met: vouches >= c.vouches },
  ];
}

// ---------------------------------------------------------------------------
// Mapper badge and tenure

export function mapperPoints(s: S, userId: Id): number {
  let pts = s.users[userId]?.mapperPointsAdjust ?? 0;
  for (const mapId of Object.keys(s.homeTopEntered)) if (s.maps[mapId]?.mapperId === userId) pts++;
  return pts;
}

export function mapperTierList(params: Params, upTo: number): number[] {
  const tiers = [...params.mapperBadgeTiers.fixed].sort((a, b) => a - b);
  const step = params.mapperBadgeTiers.thenEvery;
  let last = tiers[tiers.length - 1] ?? 0;
  while (step > 0 && last < upTo + step) {
    last += step;
    tiers.push(last);
  }
  return tiers;
}

export function mapperTier(params: Params, points: number): { tier: number; next: number } {
  const tiers = mapperTierList(params, points);
  let tier = 0;
  for (const t of tiers) if (points >= t) tier = t;
  const next = tiers.find((t) => t > points) ?? tier;
  return { tier, next };
}

export function natTenureYears(u: User, now: Ms): number {
  if (!u.isNAT || u.natSince === null) return 0;
  return (now - u.natSince) / (365 * DAY);
}

export function natTenureTier(params: Params, u: User, now: Ms): number {
  const years = natTenureYears(u, now);
  let tier = 0;
  for (const t of params.natTenureTiers) if (years >= t) tier = t;
  return tier;
}

export function userBadges(s: S, userId: Id) {
  return Object.values(s.badges)
    .filter((b) => b.userId === userId)
    .sort((a, b) => b.awardedAt - a.awardedAt);
}

export function mapsBy(s: S, userId: Id): Beatmapset[] {
  return Object.values(s.maps).filter((m) => m.mapperId === userId || m.guestMapperIds.includes(userId));
}

export function categoryName(params: Params, c: Category | null): string {
  if (c === 'mechanics') return params.categoryNames.mechanics;
  if (c === 'level_design') return params.categoryNames.levelDesign;
  return 'No category';
}

export function mapEvents(s: S, mapId: Id) {
  return s.events.filter((e) => e.mapId === mapId);
}

export function userEvents(s: S, userId: Id) {
  return s.events.filter((e) => e.actorId === userId || e.targetUserId === userId);
}

/** Thresholds for votes, given the current interpretation toggles. */
export function roundVotes(x: number, mode: Params['removalRounding']): number {
  if (mode === 'floor') return Math.floor(x + 1e-9);
  if (mode === 'ceil') return Math.ceil(x - 1e-9);
  if (mode === 'round') return Math.round(x);
  return x;
}

export function removalYesNeeded(s: S): number {
  return roundVotes(natMembers(s).length * s.params.removalThreshold, s.params.removalRounding);
}

/** What each ranked category exposes: Mechanics gets plain sorts and no stars UI. */
export function categoryFeatures(c: Category) {
  return c === 'level_design'
    ? { stars: true, sorts: LD_SORTS, defaultSort: 'best_recent' as SortKey, rewards: true }
    : { stars: false, sorts: MECH_SORTS, defaultSort: 'recent' as SortKey, rewards: false };
}
