import { createSeed } from '../src/data/seed';
import * as E from '../src/engine';
import { TOUR, tourMapId, type TourApi } from '../src/tour/steps';

describe('Phase 7: guided demo tour', () => {
  it('runs end to end on the seed without errors', () => {
    let s = createSeed();
    const errors: string[] = [];
    const api: TourApi = {
      state: () => s,
      dispatch: (fn, args, as) => {
        try {
          s = fn(s, as ?? s.currentUserId, args, s.now).state;
          return true;
        } catch (e) {
          errors.push((e as Error).message);
          return false;
        }
      },
      advance: (ms) => (s = E.advance(s, ms).state),
      setUser: (id) => (s = { ...s, currentUserId: id }),
    };
    const mapId = tourMapId(s);
    expect(E.activeNominations(s, mapId)).toHaveLength(1);
    for (const step of TOUR) {
      step.run?.(api);
      expect(step.route(s)).toMatch(/^\//);
      expect(step.body(s).length).toBeGreaterThan(10);
    }
    expect(errors).toEqual([]);
    expect(s.maps[mapId].status).toBe('ranked');
    expect(E.mapStars(s, mapId).length).toBe(21);
    expect(E.homeTop(s).map((m) => m.id)).toContain(mapId);
    const lb = E.leaderboard(s, E.seasonFor(s.now, s.params), 'main');
    const legacy = Object.values(s.users).find((u) => u.username === 'LegacyNom')!;
    expect(lb.find((r) => r.userId === legacy.id)?.points).toBeGreaterThanOrEqual(21);
    expect(s.homeTopEntered[mapId]).toBeDefined();
  });

  it('fast-forwarding the seed by 90 days stays quick and consistent', () => {
    let s = createSeed();
    const t0 = Date.now();
    s = E.advance(s, 90 * E.DAY).state;
    const ms = Date.now() - t0;
    console.log(`90-day tick: ${ms} ms, ${s.events.length} events`);
    expect(ms).toBeLessThan(5000);
    expect(Object.values(s.maps).filter((m) => m.status === 'qualified' && !m.frozen)).toHaveLength(0);
    expect(Object.values(s.badges).some((b) => b.season === '2026-S4')).toBe(true);
  });
});
