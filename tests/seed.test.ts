import { createSeed } from '../src/data/seed';
import * as E from '../src/engine';

describe('seed', () => {
  const s = createSeed();
  const maps = Object.values(s.maps);
  const users = Object.values(s.users);
  const by = (st: string) => maps.filter((m) => m.status === st).length;
  const user = (n: string) => users.find((u) => u.username === n)!;

  it('is deterministic', () => {
    expect(JSON.stringify(createSeed())).toBe(JSON.stringify(s));
  });

  it('has the volumes in spec section 10.1', () => {
    expect(users.length).toBeGreaterThanOrEqual(225);
    expect(users.filter((u) => u.isNAT)).toHaveLength(8);
    expect(users.filter((u) => u.isBN && !u.isNAT)).toHaveLength(40);
    expect(users.filter((u) => u.isBN && !u.isNAT && u.isLegacyBN)).toHaveLength(12);
    expect(maps.filter((m) => m.status === 'ranked' && m.category === 'level_design')).toHaveLength(40);
    expect(maps.filter((m) => m.status === 'ranked' && m.category === 'mechanics')).toHaveLength(25);
    expect([by('qualified'), by('pending'), by('wip'), by('graveyard')]).toEqual([10, 20, 15, 10]);
    expect(Object.keys(s.packs).length).toBeGreaterThan(0);
    expect(Object.values(s.badges).some((b) => b.type === 'bn_top_main')).toBe(true);
    expect(E.homeTop(s)).toHaveLength(5);
  });

  it('sets up the demo personas', () => {
    const ln = user('LegacyNom');
    expect(s.nominators[ln.id].allowanceAvailable).toBe(5);
    expect(E.starWallet(s, ln.id).available).toBe(10);
    expect(s.natInvites[ln.id].status).toBe('pending');
    const fresh = user('FreshBN');
    expect(s.nominators[fresh.id].allowanceAvailable).toBe(1);
    expect(fresh.bnQualifiedVia).toBe('favourites');
    expect(E.starWallet(s, fresh.id).available).toBe(3);
    const pn = user('ProblemNom');
    expect(s.nominators[pn.id].cooldownLevel).toBe(1);
    expect(Object.values(s.dqs).filter((d) => d.nominatorIds.includes(pn.id) && d.at > s.now - 7 * E.DAY)).toHaveLength(3);
    const queue = Object.values(s.cases).filter((c) => c.outcome === null).length + Object.values(s.petitions).filter((p) => p.status === 'awaiting_nat').length;
    expect(queue).toBe(3);
    expect(Object.values(s.cases).filter((c) => c.outcome === null && c.deadlineAt < s.now)).toHaveLength(1);
    const almost = user('AlmostThere');
    expect(E.rankedHostCount(s, almost.id)).toBe(4);
    expect(E.validVouchCount(s, almost.id)).toBe(4);
    const rh = user('ReportHappy');
    expect(rh.playerStrikes).toBe(2);
    expect(rh.chatBanUntil! - s.now).toBeLessThanOrEqual(24 * E.HOUR);
    const pastelMap = maps.find((m) => m.title === 'Glasshouse Summer')!;
    expect(pastelMap.status).toBe('pending');
    expect(E.activeNominations(s, pastelMap.id)).toHaveLength(1);
    expect(maps.filter((m) => m.status === 'qualified' && E.openFlags(s, m.id).filter((f) => f.source === 'player').length === 87)).toHaveLength(1);
  });
});
