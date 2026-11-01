import * as E from '../src/engine';
import { act, addMap, expectRule, qualify, world } from './helpers';

describe('Phase 5: split and visibility', () => {
  it('Mechanics listing has no star controls; Level Design defaults to Best (recent)', () => {
    const mech = E.categoryFeatures('mechanics');
    const ld = E.categoryFeatures('level_design');
    expect(mech.stars).toBe(false);
    expect(mech.sorts.some((x) => x.startsWith('best'))).toBe(false);
    expect(ld.stars).toBe(true);
    expect(ld.defaultSort).toBe('best_recent');
    expect(E.defaultSort('level_design', 'ranked')).toBe('best_recent');
    const w = world();
    const m = addMap(w.s, w.mapper.id, { category: 'mechanics', status: 'ranked', rankedAt: w.s.now });
    expectRule(() => act(w.s, E.castStar, w.nat[0], { mapId: m.id }), 'not_ld');
  });

  it('A BN cannot star a map they nominated, mapped or guested', () => {
    const w = world();
    let s = w.s;
    const guest = w.bns[4];
    const map = addMap(s, w.bns[3].id, { guestMapperIds: [guest.id] });
    s = qualify(s, map.id, w.bns);
    s = E.advance(s, 15 * E.DAY).state;
    expect(s.maps[map.id].status).toBe('ranked');
    expectRule(() => act(s, E.castStar, w.bns[0], { mapId: map.id }), 'nominated');
    expectRule(() => act(s, E.castStar, w.bns[3], { mapId: map.id }), 'own_map');
    expectRule(() => act(s, E.castStar, guest, { mapId: map.id }), 'guest_map');
    s = act(s, E.castStar, w.bns[5], { mapId: map.id });
    expectRule(() => act(s, E.castStar, w.bns[5], { mapId: map.id }), 'already_starred');
  });

  it('A spent star returns exactly 7 days after casting', () => {
    const w = world();
    let s = w.s;
    const map = addMap(s, w.mapper.id, { status: 'ranked', rankedAt: s.now });
    const caster = w.bns[0];
    expect(E.starWallet(s, caster.id).available).toBe(10);
    s = act(s, E.castStar, caster, { mapId: map.id });
    const castAt = s.now;
    expect(E.starWallet(s, caster.id).available).toBe(9);
    expect(E.starWallet(s, caster.id, castAt + 7 * E.DAY - 1).available).toBe(9);
    expect(E.starWallet(s, caster.id, castAt + 7 * E.DAY).available).toBe(10);
    s = E.advance(s, 7 * E.DAY).state;
    expect(E.starWallet(s, caster.id).available).toBe(10);
  });

  it('A clean rank gives each nominator +5 bonus stars that expire after 7 days; a 1-DQ rank gives +3', () => {
    const w = world();
    let s = w.s;
    const clean = addMap(s, w.mapper.id);
    const once = addMap(s, w.mapper.id);
    s = qualify(s, clean.id, w.bns.slice(0, 3));
    s = qualify(s, once.id, w.bns.slice(3, 6));
    s = act(s, E.disqualify, w.nat[0], { mapId: once.id, reason: 'x' });
    s = qualify(s, once.id, w.bns.slice(0, 3));
    s = E.advance(s, 15 * E.DAY).state;
    expect(s.maps[clean.id].status).toBe('ranked');
    expect(s.maps[once.id].status).toBe('ranked');
    const grants = (uid: string) => Object.values(s.bonusGrants).filter((g) => g.userId === uid);
    const bn = w.bns[0];
    expect(grants(bn.id).map((g) => g.amount).sort()).toEqual([3, 5]);
    expect(grants(w.bns[3].id)).toHaveLength(0); // their nominations were voided by the DQ
    expect(E.starWallet(s, bn.id).available).toBe(10 + 8);
    s = E.advance(s, 7 * E.DAY).state;
    expect(E.starWallet(s, bn.id).available).toBe(10);
  });

  it('Best (recent) applies decay and the home top N lists the highest LD maps', () => {
    const w = world();
    const s = w.s;
    const a = addMap(s, w.mapper.id, { status: 'ranked', rankedAt: s.now - 29 * E.DAY });
    const b = addMap(s, w.mapper.id, { status: 'ranked', rankedAt: s.now - 20 * E.DAY });
    s.stars.x1 = { id: 'x1', castorId: w.nat[0].id, mapId: a.id, at: s.now - 28 * E.DAY, replenishAt: null, fromBonus: null };
    s.stars.x2 = { id: 'x2', castorId: w.nat[1].id, mapId: a.id, at: s.now - 28 * E.DAY, replenishAt: null, fromBonus: null };
    s.stars.x3 = { id: 'x3', castorId: w.nat[0].id, mapId: b.id, at: s.now - 1, replenishAt: null, fromBonus: null };
    expect(E.starScore(s, a.id, 'recent')).toBeCloseTo(0.5, 5); // two stars, two half-lives old
    expect(E.listMaps(s, { status: 'ranked', category: 'level_design' }).map((m) => m.id)).toEqual([b.id, a.id]);
    s.params.sort.decayOn = false;
    expect(E.listMaps({ ...s }, { status: 'ranked', category: 'level_design' }).map((m) => m.id)).toEqual([a.id, b.id]);
  });
});
