import * as E from '../src/engine';
import { act, addMap, addUser, qualify, world } from './helpers';

describe('Phase 6: rewards', () => {
  it('Each star on a nominated LD map adds 1 point to every nominator; FA maps also add to the FA board', () => {
    const w = world();
    let s = w.s;
    const plain = addMap(s, w.mapper.id);
    const fa = addMap(s, w.mapper.id, { isFA: true });
    s = qualify(s, plain.id, w.bns.slice(0, 3));
    s = qualify(s, fa.id, w.bns.slice(3, 6));
    s = E.advance(s, 15 * E.DAY).state;
    s = act(s, E.castStar, w.nat[0], { mapId: plain.id });
    s = act(s, E.castStar, w.nat[1], { mapId: plain.id });
    s = act(s, E.castStar, w.nat[0], { mapId: fa.id });
    const season = E.seasonFor(s.now, s.params);
    const main = Object.fromEntries(E.leaderboard(s, season, 'main').map((r) => [r.userId, r.points]));
    const faBoard = Object.fromEntries(E.leaderboard(s, season, 'fa').map((r) => [r.userId, r.points]));
    for (const b of w.bns.slice(0, 3)) expect(main[b.id]).toBe(2);
    for (const b of w.bns.slice(3, 6)) {
      expect(main[b.id]).toBe(1);
      expect(faBoard[b.id]).toBe(1);
    }
    expect(faBoard[w.bns[0].id]).toBeUndefined();
    s.params.faStarsCountOnMain = false;
    expect(E.leaderboard({ ...s }, season, 'main').find((r) => r.userId === w.bns[3].id)).toBeUndefined();
  });

  it('Season rollover awards badges to the top 25 on each board and resets both', () => {
    const w = world({ bnCount: 30, natCount: 12 });
    let s = w.s;
    // 10 maps, each nominated by a distinct trio; map i gets i+1 stars. Even maps are FA.
    const maps = Array.from({ length: 10 }, (_, i) => addMap(s, w.mapper.id, { isFA: i % 2 === 0 }));
    maps.forEach((m, i) => (s = qualify(s, m.id, w.bns.slice(i * 3, i * 3 + 3))));
    s = E.advance(s, 15 * E.DAY).state;
    maps.forEach((m, i) => {
      for (const n of w.nat.slice(0, i + 1)) s = act(s, E.castStar, n, { mapId: m.id });
    });
    const season = E.seasonFor(s.now, s.params);
    expect(E.leaderboard(s, season, 'main')).toHaveLength(30);
    s = E.tick(s, s.now, season.endsAt).state;
    const badges = Object.values(s.badges);
    expect(badges.filter((b) => b.type === 'bn_top_main' && b.season === season.id)).toHaveLength(25);
    expect(badges.filter((b) => b.type === 'bn_top_fa' && b.season === season.id)).toHaveLength(15);
    const perUser = new Map<string, number>();
    for (const b of badges) perUser.set(b.userId, (perUser.get(b.userId) ?? 0) + 1);
    expect(Math.max(...perUser.values())).toBeLessThanOrEqual(2);
    // The lowest map (1 star) had its trio cut off.
    expect(badges.some((b) => b.userId === w.bns[0].id && b.type === 'bn_top_main')).toBe(false);
    const next = E.seasonFor(s.now, s.params);
    expect(E.leaderboard(s, next, 'main')).toHaveLength(0);
    expect(E.leaderboard(s, next, 'fa')).toHaveLength(0);
  });

  it('Monthly pack snapshot produces correct top-half and top-quarter sets and labels the quarter "Best of Level Design"', () => {
    const w = world({ natCount: 10 });
    let s = w.s;
    // 8 LD maps ranked in October 2026 with 1..8 stars.
    const maps = Array.from({ length: 8 }, (_, i) => addMap(s, w.mapper.id, { status: 'ranked', rankedAt: Date.UTC(2026, 9, 3 + i * 3) }));
    maps.forEach((m, i) => {
      for (let k = 0; k <= i; k++) {
        const id = `ps${i}_${k}`;
        s.stars[id] = { id, castorId: w.nat[k].id, mapId: m.id, at: m.rankedAt! + E.DAY, replenishAt: null, fromBonus: null };
      }
    });
    s.jobs.ldPacksDone = { '2026-08': true, '2026-09': true };
    const snapshot = E.ldPackSnapshotAt(s.params, '2026-10');
    expect(snapshot).toBe(Date.UTC(2026, 11, 1)); // month end (Nov 1) + 30 days
    s = E.tick(s, s.now, snapshot - E.HOUR).state;
    expect(Object.values(s.packs)).toHaveLength(0);
    s = E.tick(s, s.now, snapshot + E.HOUR).state;
    const packs = Object.values(s.packs).filter((p) => p.periodKey === '2026-10');
    const half = packs.find((p) => p.type === 'ld_top_half')!;
    const quarter = packs.find((p) => p.type === 'ld_top_quarter')!;
    expect(half.mapIds).toEqual([maps[7], maps[6], maps[5], maps[4]].map((m) => m.id));
    expect(quarter.mapIds).toEqual([maps[7], maps[6]].map((m) => m.id));
    expect(E.isBestOfLD(s, maps[7].id)).toBe(true);
    expect(E.isBestOfLD(s, maps[5].id)).toBe(false);
    expect(E.listMaps(s, { status: 'ranked', category: 'level_design', bestOfLD: true }).map((m) => m.id).sort()).toEqual([maps[6].id, maps[7].id].sort());
  });

  it('A map entering the home top 5 for the first time gives its mapper 1 badge point; re-entering gives none', () => {
    const w = world({ natCount: 6 });
    let s = w.s;
    s.params.homeTopN = 1;
    const mapperB = addUser(s, 'mapperB');
    const a = addMap(s, w.mapper.id, { status: 'ranked', rankedAt: s.now });
    const b = addMap(s, mapperB.id, { status: 'ranked', rankedAt: s.now });
    s = act(s, E.castStar, w.nat[0], { mapId: a.id });
    expect(E.mapperPoints(s, w.mapper.id)).toBe(1);
    s = act(s, E.castStar, w.nat[1], { mapId: b.id });
    s = act(s, E.castStar, w.nat[2], { mapId: b.id });
    expect(E.homeTop(s)[0].id).toBe(b.id);
    expect(E.mapperPoints(s, mapperB.id)).toBe(1);
    for (const n of w.nat.slice(3, 6)) s = act(s, E.castStar, n, { mapId: a.id });
    expect(E.homeTop(s)[0].id).toBe(a.id);
    expect(E.mapperPoints(s, w.mapper.id)).toBe(1);
  });

  it('Unique downloads do not increase when the same user downloads twice', () => {
    const w = world();
    let s = w.s;
    const map = addMap(s, w.mapper.id, { status: 'ranked', rankedAt: s.now });
    s = act(s, E.download, w.players[0], { mapId: map.id });
    s = act(s, E.download, w.players[0], { mapId: map.id });
    expect(E.uniqueDownloads(s, map.id)).toBe(1);
    s = act(s, E.download, w.players[1], { mapId: map.id });
    expect(E.uniqueDownloads(s, map.id)).toBe(2);
  });

  it('Play time sums durations and mapper badge tiers follow 5, 10, 25, 50, 75, 100, then every 100', () => {
    const w = world();
    let s = w.s;
    const map = addMap(s, w.mapper.id, { status: 'ranked', rankedAt: s.now });
    s = act(s, E.play, w.players[0], { mapId: map.id });
    s = act(s, E.play, w.players[0], { mapId: map.id });
    const total = Object.values(s.plays).reduce((a, p) => a + p.durationSec, 0);
    expect(E.playTimeHours(s, map.id)).toBeCloseTo(total / 3600);
    expect(E.mapperTier(s.params, 4).tier).toBe(0);
    expect(E.mapperTier(s.params, 75)).toEqual({ tier: 75, next: 100 });
    expect(E.mapperTier(s.params, 250)).toEqual({ tier: 200, next: 300 });
  });
});
