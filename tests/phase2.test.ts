import * as E from '../src/engine';
import { act, addMap, advanceDays, expectRule, qualify, world } from './helpers';

describe('Phase 2: nomination pipeline', () => {
  it('A BN with 0 allowance cannot nominate; after +1 day they have 1; after 10 idle days they have 5, not 10', () => {
    const w = world();
    let s = w.s;
    const bn = w.bns[0];
    s.nominators[bn.id].allowanceAvailable = 0;
    s.nominators[bn.id].lastAccrualAt = s.now;
    const map = addMap(s, w.mapper.id);
    const msg = expectRule(() => act(s, E.nominate, bn, { mapId: map.id }), 'no_allowance');
    expect(msg).toBe('You have 0 nominations available. Next one in 1 d.');
    s = advanceDays(s, 1);
    expect(s.nominators[bn.id].allowanceAvailable).toBe(1);
    expect(E.canNominate(s, bn.id, map.id).ok).toBe(true);
    s = advanceDays(s, 10);
    expect(s.nominators[bn.id].allowanceAvailable).toBe(5);
  });

  it('A mapper cannot nominate their own map; a BN cannot nominate the same map twice', () => {
    const w = world();
    let s = w.s;
    const bnMapper = w.bns[0];
    const own = addMap(s, bnMapper.id);
    expectRule(() => act(s, E.nominate, bnMapper, { mapId: own.id }), 'own_map');
    const other = addMap(s, w.mapper.id);
    s = act(s, E.nominate, w.bns[1], { mapId: other.id });
    expectRule(() => act(s, E.nominate, w.bns[1], { mapId: other.id }), 'already_nominated');
    // A plain mapper (not a BN) can't nominate at all.
    expectRule(() => act(s, E.nominate, w.mapper, { mapId: other.id }), 'not_bn');
  });

  it('The third clean nomination makes a map Qualified; +15 days makes it Ranked', () => {
    const w = world();
    let s = w.s;
    const map = addMap(s, w.mapper.id);
    s = act(s, E.nominate, w.bns[0], { mapId: map.id });
    s = act(s, E.nominate, w.bns[1], { mapId: map.id });
    expect(s.maps[map.id].status).toBe('pending');
    s = act(s, E.nominate, w.bns[2], { mapId: map.id });
    expect(s.maps[map.id].status).toBe('qualified');
    expect(s.maps[map.id].qualifiedAt).toBe(s.now);
    s = E.advance(s, 15 * E.DAY - E.HOUR).state;
    expect(s.maps[map.id].status).toBe('qualified');
    s = E.advance(s, E.HOUR).state;
    expect(s.maps[map.id].status).toBe('ranked');
  });

  it('Nominating a map with an unrankable MV issue opens an override petition instead; 3 signatures send it to NAT; NAT deny leaves it Pending with signatures voided', () => {
    const w = world();
    let s = w.s;
    const map = addMap(s, w.mapper.id, { mvIssues: [{ check: 'Unsnapped object', severity: 'unrankable', message: 'x' }] });
    expect(E.runVerifier(s.maps[map.id]).ok).toBe(false);
    expectRule(() => act(s, E.nominate, w.bns[0], { mapId: map.id }), 'verifier_failed');
    expectRule(() => act(s, E.signOverride, w.bns[0], { mapId: map.id, reason: '  ' }), 'reason_required');
    for (const bn of w.bns.slice(0, 3)) s = act(s, E.signOverride, bn, { mapId: map.id, reason: 'False positive' });
    const pet = E.openPetition(s, map.id)!;
    expect(pet.status).toBe('awaiting_nat');
    expect(pet.deadlineAt).toBe(s.now + 10 * E.DAY);
    expect(s.nominators[w.bns[0].id].allowanceAvailable).toBe(4);
    s = act(s, E.decidePetition, w.nat[0], { petitionId: pet.id, approve: false, note: 'The unsnap is real' });
    expect(s.petitions[pet.id].status).toBe('denied');
    expect(s.petitions[pet.id].signatures.every((x) => x.voided)).toBe(true);
    expect(s.maps[map.id].status).toBe('pending');
    expect(E.activeNominations(s, map.id)).toHaveLength(0);
  });

  it('An approved override counts as real nominations and qualifies the map', () => {
    const w = world();
    let s = w.s;
    const map = addMap(s, w.mapper.id, { mvIssues: [{ check: 'Audio bitrate too high', severity: 'unrankable', message: 'x' }] });
    for (const bn of w.bns.slice(0, 3)) s = act(s, E.signOverride, bn, { mapId: map.id, reason: 'ok' });
    s = act(s, E.decidePetition, w.nat[0], { petitionId: E.openPetition(s, map.id)!.id, approve: true, note: '' });
    expect(s.maps[map.id].status).toBe('qualified');
    expect(E.activeNominations(s, map.id).every((n) => n.viaOverride)).toBe(true);
  });

  it('A DQ returns the map to Pending, voids nominations and does not refund allowance', () => {
    const w = world();
    let s = w.s;
    const map = addMap(s, w.mapper.id);
    s = qualify(s, map.id, w.bns);
    const before = w.bns.slice(0, 3).map((b) => s.nominators[b.id].allowanceAvailable);
    s = act(s, E.disqualify, w.nat[0], { mapId: map.id, reason: 'Unsnapped objects' });
    expect(s.maps[map.id].status).toBe('pending');
    expect(s.maps[map.id].dqCount).toBe(1);
    expect(E.activeNominations(s, map.id)).toHaveLength(0);
    expect(E.mapNominations(s, map.id).every((n) => n.voidedAt === s.now)).toBe(true);
    expect(w.bns.slice(0, 3).map((b) => s.nominators[b.id].allowanceAvailable)).toEqual(before);
    const dq = Object.values(s.dqs)[0];
    expect(dq.nominatorIds.sort()).toEqual(w.bns.slice(0, 3).map((b) => b.id).sort());
  });

  it('3 DQs within 7 days puts each affected nominator on cooldown level 1 (accrual every 2 days); 30 clean days resets it', () => {
    const w = world();
    let s = w.s;
    const maps = [0, 1, 2].map(() => addMap(s, w.mapper.id));
    for (const m of maps) s = qualify(s, m.id, w.bns);
    for (const m of maps) {
      s = act(s, E.disqualify, w.nat[0], { mapId: m.id, reason: 'Issue' });
      s = advanceDays(s, 1);
    }
    for (const b of w.bns.slice(0, 3)) expect(s.nominators[b.id].cooldownLevel).toBe(1);
    expect(s.nominators[w.bns[3].id].cooldownLevel).toBe(0);
    const bn = w.bns[0];
    s.nominators[bn.id].allowanceAvailable = 0;
    s.nominators[bn.id].lastAccrualAt = s.now;
    expect(E.accrualIntervalDays(s.params, s.nominators[bn.id], s.now)).toBe(2);
    s = advanceDays(s, 1);
    expect(s.nominators[bn.id].allowanceAvailable).toBe(0);
    s = advanceDays(s, 1);
    expect(s.nominators[bn.id].allowanceAvailable).toBe(1);
    s = advanceDays(s, 28);
    expect(s.nominators[bn.id].cooldownLevel).toBe(0);
  });

  it('Pending maps idle for 28 days go to the graveyard and can be revived', () => {
    const w = world();
    let s = w.s;
    const map = addMap(s, w.mapper.id);
    s = advanceDays(s, 27);
    expect(s.maps[map.id].status).toBe('pending');
    s = advanceDays(s, 1);
    expect(s.maps[map.id].status).toBe('graveyard');
    s = act(s, E.reviveMap, w.mapper, { mapId: map.id });
    expect(s.maps[map.id].status).toBe('pending');
  });
});
