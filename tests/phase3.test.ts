import * as E from '../src/engine';
import { act, addMap, advanceDays, expectRule, qualify, world } from './helpers';

describe('Phase 3: supervision', () => {
  it('One BN flag does not open a case; a second distinct BN flag does and freezes the map', () => {
    const w = world();
    let s = w.s;
    const map = addMap(s, w.mapper.id);
    s = qualify(s, map.id, w.bns);
    expectRule(() => act(s, E.bnFlag, w.bns[0], { mapId: map.id, reasonCategory: 'Other', reasonText: 'x' }), 'own_nomination');
    s = act(s, E.bnFlag, w.bns[3], { mapId: map.id, reasonCategory: 'Metadata', reasonText: 'Title wrong' });
    expect(E.openCase(s, map.id)).toBeUndefined();
    expect(s.maps[map.id].frozen).toBe(false);
    expectRule(() => act(s, E.bnFlag, w.bns[3], { mapId: map.id, reasonCategory: 'Metadata', reasonText: 'again' }), 'already_flagged');
    s = act(s, E.bnFlag, w.bns[4], { mapId: map.id, reasonCategory: 'Metadata', reasonText: 'Agree' });
    const c = E.openCase(s, map.id)!;
    expect(c).toBeDefined();
    expect(c.trigger).toBe('bn');
    expect(s.maps[map.id].frozen).toBe(true);
  });

  it('99 player reports do not open a case; the 100th does', () => {
    const w = world({ playerCount: 100 });
    let s = w.s;
    const map = addMap(s, w.mapper.id);
    s = qualify(s, map.id, w.bns);
    for (const p of w.players.slice(0, 99)) s = act(s, E.report, p, { mapId: map.id, reasonCategory: 'Other', reasonText: 'bad' });
    expect(E.openCase(s, map.id)).toBeUndefined();
    expectRule(() => act(s, E.report, w.players[0], { mapId: map.id, reasonCategory: 'Other', reasonText: 'bad' }), 'already_reported');
    s = act(s, E.report, w.players[99], { mapId: map.id, reasonCategory: 'Other', reasonText: 'bad' });
    expect(E.openCase(s, map.id)?.trigger).toBe('player');
    expect(s.maps[map.id].frozen).toBe(true);
  });

  it('A frozen map does not rank even after 15+ days; dismissal resumes the clock where it paused', () => {
    const w = world();
    let s = w.s;
    const map = addMap(s, w.mapper.id);
    s = qualify(s, map.id, w.bns);
    s = advanceDays(s, 6);
    s = act(s, E.bnFlag, w.bns[3], { mapId: map.id, reasonCategory: 'Other', reasonText: 'a' });
    s = act(s, E.bnFlag, w.bns[4], { mapId: map.id, reasonCategory: 'Other', reasonText: 'b' });
    s = advanceDays(s, 20);
    expect(s.maps[map.id].status).toBe('qualified');
    expect(E.qualifiedDaysElapsed(s.maps[map.id])).toBe(6);
    const c = E.openCase(s, map.id)!;
    expect(s.cases[c.id].overdue).toBe(true);
    s = act(s, E.decideCase, w.nat[0], { caseId: c.id, outcome: 'dismissed', note: 'Fine' });
    expect(s.maps[map.id].frozen).toBe(false);
    s = advanceDays(s, 8.9);
    expect(s.maps[map.id].status).toBe('qualified');
    s = advanceDays(s, 0.1);
    expect(s.maps[map.id].status).toBe('ranked');
  });

  it('NAT can DQ for misclassified category, and the map returns to Pending with category unlocked', () => {
    const w = world();
    let s = w.s;
    const map = addMap(s, w.mapper.id, { category: 'level_design' });
    expect(E.canSetCategory(s, w.mapper.id, map.id).ok).toBe(true);
    s = act(s, E.nominate, w.bns[0], { mapId: map.id });
    expect(E.canSetCategory(s, w.mapper.id, map.id).ok).toBe(false);
    s = act(s, E.nominate, w.bns[1], { mapId: map.id });
    s = act(s, E.nominate, w.bns[2], { mapId: map.id });
    s = act(s, E.bnFlag, w.bns[3], { mapId: map.id, reasonCategory: 'Wrong category', reasonText: 'farm' });
    s = act(s, E.bnFlag, w.bns[4], { mapId: map.id, reasonCategory: 'Wrong category', reasonText: 'farm' });
    const c = E.openCase(s, map.id)!;
    s = act(s, E.decideCase, w.nat[0], { caseId: c.id, outcome: 'dq_category', note: 'This is a Mechanics map' });
    expect(s.cases[c.id].outcome).toBe('dq_category');
    expect(s.maps[map.id].status).toBe('pending');
    expect(E.canSetCategory(s, w.mapper.id, map.id).ok).toBe(true);
    s = act(s, E.setCategory, w.mapper, { mapId: map.id, category: 'mechanics' });
    expect(s.maps[map.id].category).toBe('mechanics');
  });

  it("Marking a player's flag abusive twice applies a 24 h chat ban", () => {
    const w = world({ playerCount: 3 });
    let s = w.s;
    const reporter = w.players[0];
    for (let i = 0; i < 2; i++) {
      const map = addMap(s, w.mapper.id);
      s = qualify(s, map.id, w.bns);
      s = act(s, E.report, reporter, { mapId: map.id, reasonCategory: 'Other', reasonText: 'campaign' });
      s = act(s, E.simulatePlayerReports, w.admin, { mapId: map.id, count: 99 });
      const c = E.openCase(s, map.id)!;
      const flag = E.openFlags(s, map.id).find((f) => f.userId === reporter.id)!;
      s = act(s, E.decideCase, w.nat[0], { caseId: c.id, outcome: 'dismissed', note: 'Coordinated', abusiveFlagIds: [flag.id] });
      if (i === 0) {
        expect(s.users[reporter.id].playerStrikes).toBe(1);
        expect(s.users[reporter.id].chatBanUntil).toBeNull();
      }
    }
    expect(s.users[reporter.id].playerStrikes).toBe(2);
    expect(s.users[reporter.id].chatBanUntil).toBe(s.now + 24 * E.HOUR);
  });

  it('BN strike 4 opens a removal vote automatically', () => {
    const w = world({ bnCount: 6 });
    let s = w.s;
    const flagger = w.bns[3];
    for (let i = 0; i < 4; i++) {
      const map = addMap(s, w.mapper.id);
      s = qualify(s, map.id, w.bns);
      s = act(s, E.bnFlag, flagger, { mapId: map.id, reasonCategory: 'Other', reasonText: 'x' });
      s = act(s, E.bnFlag, w.bns[4], { mapId: map.id, reasonCategory: 'Other', reasonText: 'y' });
      const c = E.openCase(s, map.id)!;
      const f = E.openFlags(s, map.id).find((x) => x.userId === flagger.id)!;
      s = act(s, E.decideCase, w.nat[0], { caseId: c.id, outcome: 'dismissed', note: '', abusiveFlagIds: [f.id] });
    }
    expect(s.nominators[flagger.id].flagStrikes).toBe(4);
    expect(Object.values(s.removalVotes).some((r) => r.targetUserId === flagger.id && r.status === 'open')).toBe(true);
  });
});
