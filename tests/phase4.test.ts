import * as E from '../src/engine';
import { act, addMap, addUser, advanceDays, correctAnswers, expectRule, world } from './helpers';

describe('Phase 4: membership', () => {
  it('A user with 800 favourites and a passed test becomes a BN; one with 799 cannot take the test', () => {
    const w = world();
    let s = w.s;
    const ok = addUser(s, 'fav800', { favouritesReceived: 800 });
    const no = addUser(s, 'fav799', { favouritesReceived: 799 });
    expectRule(() => act(s, E.startTest, no, {}), 'no_criterion');
    s = act(s, E.startTest, ok, {});
    const app = E.lastApplication(s, ok.id)!;
    expect(app.questionIds).toHaveLength(20);
    s = act(s, E.submitTest, ok, { applicationId: app.id, answers: correctAnswers(s, app.id) });
    const u = s.users[ok.id];
    expect(u.isBN).toBe(true);
    expect(u.bnQualifiedVia).toBe('favourites');
    expect(u.bnSince).toBe(s.now);
    expect(s.nominators[ok.id].allowanceAvailable).toBe(1);
    expect(s.bnProfiles[ok.id]).toBeDefined();
  });

  it('A failed test can be retried only after 7 days', () => {
    const w = world();
    let s = w.s;
    const u = addUser(s, 'fav900', { favouritesReceived: 900 });
    s = act(s, E.startTest, u, {});
    const app = E.lastApplication(s, u.id)!;
    const wrong = correctAnswers(s, app.id).map((a) => (a + 1) % 4);
    s = act(s, E.submitTest, u, { applicationId: app.id, answers: wrong });
    expect(s.applications[app.id].status).toBe('failed');
    expectRule(() => act(s, E.startTest, u, {}), 'retry_wait');
    s = advanceDays(s, 7);
    expect(E.canStartTest(s, u.id).ok).toBe(true);
  });

  it('A BN cannot vouch twice within 15 days', () => {
    const w = world();
    let s = w.s;
    const a = addUser(s, 'hopeful1');
    const b = addUser(s, 'hopeful2');
    s = act(s, E.vouch, w.bns[0], { candidateId: a.id });
    expectRule(() => act(s, E.vouch, w.bns[0], { candidateId: b.id }), 'vouch_cooldown');
    s = advanceDays(s, 14.9);
    expectRule(() => act(s, E.vouch, w.bns[0], { candidateId: b.id }), 'vouch_cooldown');
    s = advanceDays(s, 0.1);
    s = act(s, E.vouch, w.bns[0], { candidateId: b.id });
    expect(E.vouchesReceived(s, b.id)).toHaveLength(1);
  });

  it('A removal vote with 5 of 8 NAT yes votes passes; 5 of 9 does not', () => {
    for (const [natCount, expected] of [
      [8, 'passed'],
      [9, 'failed'],
    ] as const) {
      const w = world({ natCount });
      let s = w.s;
      const target = w.bns[0];
      s = act(s, E.openRemovalVote, w.nat[0], { targetId: target.id, reason: 'bad_faith_nominations', note: 'x' });
      const rv = Object.values(s.removalVotes)[0];
      for (const n of w.nat.slice(0, 5)) s = act(s, E.voteRemoval, n, { voteId: rv.id, vote: 'yes' });
      s = advanceDays(s, 7);
      expect(s.removalVotes[rv.id].status).toBe(expected);
      expect(s.users[target.id].isBN).toBe(expected === 'failed');
    }
  });

  it('A NAT candidacy passes on a BN majority even if the NAT vote fails', () => {
    const w = world({ bnCount: 7, natCount: 8 });
    let s = w.s;
    const cand = w.bns[0];
    s.natInvites[cand.id] = { userId: cand.id, invitedAt: s.now, cycle: '2026-S4', status: 'accepted' };
    s = act(s, E.submitPortfolio, cand, { text: 'My modding', links: ['a'] });
    const c = Object.values(s.candidacies)[0];
    s = act(s, E.voteCandidacy, w.nat[0], { candidacyId: c.id, vote: 'yes' });
    s = act(s, E.voteCandidacy, w.nat[1], { candidacyId: c.id, vote: 'no' });
    // 6 other BNs: 4 yes is > 50%.
    for (const b of w.bns.slice(1, 4)) s = act(s, E.voteCandidacy, b, { candidacyId: c.id, vote: 'yes' });
    expect(s.candidacies[c.id].status).toBe('open');
    s = act(s, E.voteCandidacy, w.bns[4], { candidacyId: c.id, vote: 'yes' });
    const t = E.candidacyTally(s, s.candidacies[c.id]);
    expect(t.natPass).toBe(false);
    expect(s.candidacies[c.id].status).toBe('accepted');
    expect(s.users[cand.id].isNAT).toBe(true);
  });

  it('Season start invites BNs in the top 25% by ratio and top 50% by activity', () => {
    const w = world({ bnCount: 8 });
    let s = w.s;
    // bns[0] has 6 ranked nominations and no DQs in the window; others have none.
    for (let i = 0; i < 6; i++) {
      const m = addMap(s, w.mapper.id, { status: 'ranked', category: 'mechanics', rankedAt: s.now - 10 * E.DAY });
      s.nominations[`rn${i}`] = { id: `rn${i}`, mapId: m.id, userId: w.bns[0].id, at: s.now - 5 * E.DAY, viaOverride: false, voidedAt: null };
    }
    expect(E.natInviteEligible(s)).toEqual([w.bns[0].id]);
    const season = E.seasonFor(s.now, s.params);
    s = E.tick(s, s.now, season.endsAt).state;
    expect(s.natInvites[w.bns[0].id]?.status).toBe('pending');
  });
});
