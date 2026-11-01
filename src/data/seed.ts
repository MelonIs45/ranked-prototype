// Deterministic seed world (spec section 10). Same output on every reset.
import seedrandom from 'seedrandom';
import { cloneParams } from '../config/params';
import type { Ctx } from '../engine/core';
import { addPlay } from '../engine/player';
import { checkHomeTop, ldPackSnapshotAt, runFaPack, runMonthlyPack, seasonRollover } from '../engine/rewards';
import { DAY, HOUR, START_TIME, addMonths, monthKey, seasonFor } from '../engine/time';
import type { Beatmapset, BnCriterion, Category, Difficulty, Id, MVIssue, Ms, Nomination, State, User } from '../engine/types';
import { TEST_QUESTIONS } from './questions';
import {
  ARTIST_A,
  ARTIST_B,
  ARTIST_SOLO,
  BN_REQUEST_LINES,
  COUNTRIES,
  DIFF_NAMES,
  GENRES,
  GRAVEYARD_BLURBS,
  LANGUAGES,
  MV_CATALOGUE,
  NAME_A,
  NAME_B,
  PORTFOLIO_LINES,
  SKILL_TAGS,
  TITLE_A,
  TITLE_B,
} from './words';

export const SEED_VERSION = 4;

export function emptyState(now: Ms = START_TIME): State {
  return {
    version: SEED_VERSION,
    now,
    seq: 0,
    params: cloneParams(),
    currentUserId: '',
    users: {},
    nominators: {},
    bnProfiles: {},
    maps: {},
    nominations: {},
    petitions: {},
    flags: {},
    cases: {},
    dqs: {},
    stars: {},
    bonusGrants: {},
    vouches: {},
    applications: {},
    testQuestions: TEST_QUESTIONS,
    natInvites: {},
    candidacies: {},
    removalVotes: {},
    plays: {},
    downloads: {},
    badges: {},
    packs: {},
    homeTopEntered: {},
    jobs: { ldPacksDone: {}, lastFaPackAt: now, seasonsRolled: {}, inviteCyclesDone: {} },
    events: [],
    personas: [],
  };
}

export function createSeed(): State {
  const rng = seedrandom('ranked-lab');
  const now = START_TIME;
  const s = emptyState(now);
  const p = s.params;
  const id = (prefix: string) => `${prefix}${++s.seq}`;
  const rand = () => rng();
  const int = (a: number, b: number) => a + Math.floor(rand() * (b - a + 1));
  const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];
  const chance = (x: number) => rand() < x;
  const shuffle = <T,>(arr: T[]): T[] => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const daysAgo = (d: number) => now - d * DAY;

  // -------------------------------------------------------------------------
  // Users

  const taken = new Set<string>();
  const genName = (): string => {
    for (;;) {
      const style = rand();
      const n =
        style < 0.4
          ? `${pick(NAME_A)}${pick(NAME_B)}`
          : style < 0.7
            ? `${pick(NAME_A)}_${pick(NAME_B)}${chance(0.5) ? int(1, 99) : ''}`
            : `${pick(NAME_A).toLowerCase()}${pick(NAME_B)}${int(10, 999)}`;
      if (!taken.has(n.toLowerCase())) {
        taken.add(n.toLowerCase());
        return n;
      }
    }
  };
  const colour = () => `hsl(${int(0, 359)} ${int(55, 85)}% ${int(55, 70)}%)`;

  function makeUser(username: string, o: Partial<User> = {}): User {
    taken.add(username.toLowerCase());
    const u: User = {
      id: id('u'),
      username,
      avatarColor: colour(),
      isBN: false,
      isNAT: false,
      isAdmin: false,
      isCrowd: false,
      isLegacyBN: false,
      bnSince: null,
      natSince: null,
      bnQualifiedVia: null,
      favouritesReceived: int(0, 40),
      mappingSubscribers: int(0, 8),
      totalPlays: int(0, 3000),
      title: null,
      playerStrikes: 0,
      chatBanUntil: null,
      tournamentBanned: false,
      mapperPointsAdjust: 0,
      pp: int(800, 9000),
      ldPp: int(100, 2500),
      country: pick(COUNTRIES),
      ...o,
    };
    s.users[u.id] = u;
    return u;
  }

  const admin = makeUser('Lab Admin', { isAdmin: true, avatarColor: '#ff66aa', country: '—', pp: 0, ldPp: 0 });

  const nat: User[] = [];
  const natNames = ['Arbiter', ...Array.from({ length: 7 }, genName)];
  natNames.forEach((n, i) => {
    const years = i === 0 ? 4 : int(1, 6) + rand() * 0.8;
    nat.push(
      makeUser(n, {
        isBN: true,
        isNAT: true,
        isLegacyBN: true,
        natSince: now - years * 365 * DAY,
        bnSince: now - (years + 1 + rand() * 2) * 365 * DAY,
        bnQualifiedVia: 'legacy',
        favouritesReceived: int(900, 6000),
        mappingSubscribers: int(150, 900),
        totalPlays: int(200_000, 4_000_000),
        pp: int(3000, 11000),
      }),
    );
  });
  const arbiter = nat[0];

  const bns: User[] = [];
  const viaCycle: BnCriterion[] = ['favourites', 'subscribers', 'plays', 'rankedMaps', 'vouches'];
  const bnNames = ['LegacyNom', 'FreshBN', 'ProblemNom', ...Array.from({ length: 37 }, genName)];
  bnNames.forEach((n, i) => {
    const legacy = i === 0 || (i >= 3 && i < 14); // 12 legacy
    const via: BnCriterion = legacy ? 'legacy' : n === 'FreshBN' ? 'favourites' : n === 'ProblemNom' ? 'subscribers' : viaCycle[i % viaCycle.length];
    const since = n === 'FreshBN' ? daysAgo(3) : legacy ? daysAgo(int(400, 2000)) : daysAgo(int(60, 300));
    bns.push(
      makeUser(n, {
        isBN: true,
        isLegacyBN: legacy,
        bnSince: since,
        bnQualifiedVia: via,
        favouritesReceived: via === 'favourites' ? int(820, 1600) : int(150, 1200),
        mappingSubscribers: via === 'subscribers' ? int(105, 320) : int(20, 220),
        totalPlays: via === 'plays' ? int(110_000, 600_000) : int(10_000, 400_000),
        pp: int(1500, 10000),
      }),
    );
  });
  const byName = (n: string) => Object.values(s.users).find((u) => u.username === n)!;
  const legacyNom = byName('LegacyNom');
  const freshBN = byName('FreshBN');
  const problemNom = byName('ProblemNom');
  freshBN.favouritesReceived = 812;

  const mappers: User[] = [];
  const mapperNames = ['PastelWaltz', 'aimgod_77', 'AlmostThere', ...Array.from({ length: 27 }, genName)];
  mapperNames.forEach((n, i) => {
    // A few are over a threshold (can apply now), many are near one.
    const over = i >= 3 && i < 7;
    mappers.push(
      makeUser(n, {
        favouritesReceived: over && i % 2 === 0 ? int(810, 1100) : int(200, 790),
        mappingSubscribers: over && i % 2 === 1 ? int(101, 160) : int(10, 97),
        totalPlays: int(5_000, 95_000),
      }),
    );
  });
  const pastel = byName('PastelWaltz');
  const aimgod = byName('aimgod_77');
  const almost = byName('AlmostThere');
  Object.assign(pastel, { favouritesReceived: 640, mappingSubscribers: 74, totalPlays: 61_000 });
  Object.assign(aimgod, { favouritesReceived: 760, mappingSubscribers: 92, totalPlays: 98_400, pp: 9800 });
  Object.assign(almost, { favouritesReceived: 702, mappingSubscribers: 88, totalPlays: 72_500 });
  // A veteran close to the Legendary title, and one near the first tier.
  mappers[7].mapperPointsAdjust = 96;
  mappers[8].mapperPointsAdjust = 3;

  const players: User[] = [];
  const playerNames = ['ReportHappy', ...Array.from({ length: 149 }, genName)];
  for (const n of playerNames) players.push(makeUser(n));
  const reportHappy = byName('ReportHappy');

  const nominatorsAll = [...nat, ...bns];
  const activity = new Map<Id, number>(nominatorsAll.map((u) => [u.id, 0.2 + rand() ** 1.5 * 2]));
  activity.set(freshBN.id, 0);
  activity.set(legacyNom.id, 1.4);

  // Nominator states.
  for (const u of nominatorsAll) {
    s.nominators[u.id] = {
      userId: u.id,
      allowanceAvailable: int(1, 5),
      lastAccrualAt: now - rand() * DAY,
      cooldownLevel: 0,
      cooldownUntil: null,
      cooldownTriggeredAt: null,
      flagStrikes: 0,
      abuseSlowLevels: 0,
      abuseSlowUntil: null,
    };
    s.bnProfiles[u.id] = {
      userId: u.id,
      open: chance(0.7),
      genres: shuffle([...GENRES]).slice(0, int(1, 3)),
      skillsets: shuffle([...SKILL_TAGS]).slice(0, int(1, 3)),
      categories: chance(0.3) ? ['mechanics', 'level_design'] : [chance(0.5) ? 'mechanics' : 'level_design'],
      requestInstructions: pick(BN_REQUEST_LINES),
    };
  }
  Object.assign(s.nominators[legacyNom.id], { allowanceAvailable: 5, lastAccrualAt: now - 0.3 * DAY });
  Object.assign(s.nominators[freshBN.id], { allowanceAvailable: 1, lastAccrualAt: now - 0.4 * DAY });
  Object.assign(s.nominators[arbiter.id], { allowanceAvailable: 3 });
  s.bnProfiles[freshBN.id] = { userId: freshBN.id, open: true, genres: ['Western pop', 'J-pop'], skillsets: ['reading', 'tech'], categories: ['level_design'], requestInstructions: 'New BN! Send me anything with a melody I can hum.' };

  // -------------------------------------------------------------------------
  // Maps

  const genArtist = () => (chance(0.65) ? `${pick(ARTIST_A)} ${pick(ARTIST_B)}` : pick(ARTIST_SOLO));
  const RESERVED_TITLES = new Set(['Glasshouse Summer', 'Velocity Overdrive', 'Static Lullaby']);
  const genTitle = (): string => {
    const t = chance(0.8) ? `${pick(TITLE_A)} ${pick(TITLE_B)}` : pick(TITLE_B);
    return RESERVED_TITLES.has(t) ? genTitle() : t;
  };
  const mechTags = ['aim', 'stream', 'burst', 'finger control', 'alt', 'precision'];
  const ldTags = ['tech', 'reading', 'high SV', 'low AR', '1/8 sliderstreams', 'aim', 'precision'];

  function genDiffs(cat: Category | null, top: number, len: number): Difficulty[] {
    const n = int(2, 5);
    const names = DIFF_NAMES.slice(Math.max(0, 6 - n - int(0, 1)), 6).slice(0, n);
    return names.map((nm, i) => {
      const sr = Math.round((1.4 + ((top - 1.4) * (i + 1)) / names.length) * 100) / 100;
      const pool = cat === 'mechanics' ? mechTags : cat === 'level_design' ? ldTags : SKILL_TAGS;
      const tags = sr < 3 ? [] : shuffle([...pool]).slice(0, sr > 5 ? int(2, 3) : 1);
      return { name: nm, starRating: sr, skillTags: tags, lengthSec: len };
    });
  }

  function makeMap(mapperId: Id, o: Partial<Beatmapset> & { status: Beatmapset['status'] }): Beatmapset {
    const cat = o.category === undefined ? (chance(0.55) ? 'level_design' : 'mechanics') : o.category;
    const top = cat === 'mechanics' ? 5.6 + rand() * 3 : 4.4 + rand() * 3.2;
    const len = int(95, 290);
    const created = o.createdAt ?? now - int(40, 400) * DAY;
    const m: Beatmapset = {
      id: id('m'),
      title: genTitle(),
      artist: genArtist(),
      mapperId,
      guestMapperIds: [],
      genre: pick(GENRES),
      language: pick(LANGUAGES),
      isFA: chance(0.15),
      category: cat,
      difficulties: genDiffs(cat, top, len),
      mvIssues: chance(0.3) ? [{ ...pick(MV_CATALOGUE.filter((x) => x.severity !== 'unrankable')) } as MVIssue] : [],
      description: '',
      createdAt: created,
      pendingAt: null,
      qualifiedAt: null,
      qualifiedElapsedMs: 0,
      frozen: false,
      rankedAt: null,
      dqCount: 0,
      lastActivityAt: created,
      legacyPlaysBase: 0,
      ...o,
    } as Beatmapset;
    if (chance(0.2)) {
      const guest = pick([...mappers, ...bns].filter((u) => u.id !== mapperId));
      m.guestMapperIds = [guest.id];
    }
    s.maps[m.id] = m;
    return m;
  }

  const nomPool = (map: Beatmapset, at: Ms, exclude: Id[] = []) =>
    nominatorsAll.filter(
      (u) =>
        u.id !== map.mapperId &&
        !map.guestMapperIds.includes(u.id) &&
        !exclude.includes(u.id) &&
        (u.bnSince ?? 0) < at &&
        (activity.get(u.id) ?? 0) > 0,
    );

  function weightedPick(users: User[]): User {
    const total = users.reduce((a, u) => a + (activity.get(u.id) ?? 0.1), 0);
    let r = rand() * total;
    for (const u of users) {
      r -= activity.get(u.id) ?? 0.1;
      if (r <= 0) return u;
    }
    return users[users.length - 1];
  }

  function addNoms(map: Beatmapset, count: number, lastAt: Ms, opts: { voidedAt?: Ms | null; include?: Id[]; exclude?: Id[] } = {}): Id[] {
    const chosen: Id[] = [...(opts.include ?? [])];
    while (chosen.length < count) {
      const pool = nomPool(map, lastAt - 12 * DAY, [...chosen, ...(opts.exclude ?? [])]);
      if (!pool.length) break;
      chosen.push(weightedPick(pool).id);
    }
    chosen.forEach((uid, i) => {
      const at = lastAt - (chosen.length - 1 - i) * (0.5 + rand() * 5) * DAY;
      const n: Nomination = { id: id('n'), mapId: map.id, userId: uid, at, viaOverride: false, voidedAt: opts.voidedAt ?? null };
      s.nominations[n.id] = n;
    });
    return chosen;
  }

  function addDQ(map: Beatmapset, at: Ms, nominatorIds: Id[], reason: string, kind: 'criteria' | 'category' | 'direct' = 'criteria') {
    const dqId = id('dq');
    s.dqs[dqId] = { id: dqId, mapId: map.id, byUserId: pick(nat).id, reason, kind, at, nominatorIds };
  }

  const DQ_REASONS = ['Unsnapped objects found after qualification', 'Metadata conflict with the official release', 'Spacing issue in the Hard difficulty', 'Category misclassified: farm patterns throughout', 'Audio offset drift in the second kiai'];

  // Ranked maps: 40 Level Design, 25 Mechanics.
  const generic = mappers.slice(3);
  const rankedOwners: Id[] = [
    ...Array(6).fill(aimgod.id),
    ...Array(4).fill(almost.id),
    pastel.id,
    ...generic.flatMap((u, i) => Array(i % 3 === 0 ? 2 : 1).fill(u.id)),
  ];
  while (rankedOwners.length < 65) rankedOwners.push(pick(nominatorsAll).id);
  const ownerQueue = shuffle(rankedOwners.filter((x) => x !== aimgod.id));
  const ldMaps: Beatmapset[] = [];
  const mechMaps: Beatmapset[] = [];

  function makeRanked(cat: Category, mapperId: Id, rankedDaysAgo: number): Beatmapset {
    const rankedAt = daysAgo(rankedDaysAgo) - int(0, 20) * HOUR;
    const qualifiedAt = rankedAt - p.qualifiedDays * DAY;
    const m = makeMap(mapperId, {
      status: 'ranked',
      category: cat,
      rankedAt,
      qualifiedAt,
      qualifiedElapsedMs: p.qualifiedDays * DAY,
      pendingAt: qualifiedAt - int(10, 60) * DAY,
      createdAt: qualifiedAt - int(70, 200) * DAY,
      lastActivityAt: rankedAt,
      mvIssues: [],
    });
    const dqRoll = rand();
    m.dqCount = dqRoll < 0.05 ? 2 : dqRoll < 0.23 ? 1 : 0;
    let lastNom = qualifiedAt;
    for (let k = m.dqCount; k > 0; k--) {
      const dqAt = qualifiedAt - k * int(6, 20) * DAY;
      const voided = addNoms(m, 3, dqAt - int(3, 15) * DAY, { voidedAt: dqAt });
      addDQ(m, dqAt, voided, pick(DQ_REASONS));
      lastNom = qualifiedAt;
    }
    addNoms(m, 3, lastNom);
    const age = (now - rankedAt) / DAY;
    m.legacyPlaysBase = Math.round((cat === 'mechanics' ? 900 : 260) * Math.min(age, 200) * (0.4 + rand() * 1.4));
    return m;
  }

  // Recent ranks are denser so Best (recent) and the home top 5 have competition.
  const ldDays = [2, 4, 6, 9, 12, 15, 19, 23, 27, ...Array.from({ length: 31 }, () => int(32, 360))];
  ldDays.forEach((d, i) => ldMaps.push(makeRanked('level_design', i === 25 ? pastel.id : ownerQueue.pop() ?? pick(generic).id, d)));
  const mechDays = [3, 8, 14, 21, 29, ...Array.from({ length: 20 }, () => int(31, 360))];
  mechDays.forEach((d, i) => mechMaps.push(makeRanked('mechanics', i < 6 ? aimgod.id : ownerQueue.pop() ?? pick(generic).id, d)));
  // AlmostThere hosts exactly 4 ranked maps.
  const almostRanked = [...ldMaps, ...mechMaps].filter((m) => m.mapperId === almost.id);
  for (const m of almostRanked.slice(4)) m.mapperId = pick(generic).id;
  let need = 4 - Math.min(4, almostRanked.length);
  for (const m of ldMaps) {
    if (need <= 0) break;
    if (m.mapperId !== almost.id && m.mapperId !== pastel.id && !nominatorsAll.some((u) => u.id === m.mapperId)) {
      m.mapperId = almost.id;
      m.guestMapperIds = m.guestMapperIds.filter((g) => g !== almost.id);
      need--;
    }
  }
  // Keep generic non-BN mappers below the ranked-maps threshold.
  const hostCount = (uid: Id) => [...ldMaps, ...mechMaps].filter((m) => m.mapperId === uid).length;
  for (const u of generic) {
    while (hostCount(u.id) >= p.bnCriteria.rankedMaps) {
      const m = [...ldMaps, ...mechMaps].find((x) => x.mapperId === u.id)!;
      m.mapperId = pick(nat).id;
    }
  }
  // Remove nominations by people who are now the mapper or a guest.
  for (const n of Object.values(s.nominations)) {
    const m = s.maps[n.mapId];
    if (n.userId === m.mapperId || m.guestMapperIds.includes(n.userId)) {
      const alt = nomPool(m, n.at, Object.values(s.nominations).filter((x) => x.mapId === m.id).map((x) => x.userId))[0];
      if (alt) n.userId = alt.id;
      else delete s.nominations[n.id];
    }
  }

  // -------------------------------------------------------------------------
  // Stars on ranked Level Design maps

  const everNom = (uid: Id, mapId: Id) => Object.values(s.nominations).some((n) => n.mapId === mapId && n.userId === uid);
  for (const m of ldMaps) {
    const popularity = 0.12 + rand() ** 1.4 * 0.72;
    const eligible = nominatorsAll.filter((u) => u.id !== m.mapperId && !m.guestMapperIds.includes(u.id) && !everNom(u.id, m.id) && u.id !== freshBN.id);
    for (const u of eligible) {
      if (!chance(popularity)) continue;
      const span = (now - m.rankedAt!) / DAY;
      const delay = chance(0.72) ? -Math.log(1 - rand() * 0.999) * 9 : rand() * span;
      if (delay >= span) continue;
      const at = m.rankedAt! + delay * DAY;
      const sid = id('s');
      s.stars[sid] = { id: sid, castorId: u.id, mapId: m.id, at, replenishAt: at + p.stars.replenishDays * DAY, fromBonus: null };
    }
  }
  // Wallet sanity for the last 7 days: nobody has overspent, LegacyNom has a full wallet.
  for (const u of nominatorsAll) {
    const recent = Object.values(s.stars)
      .filter((st) => st.castorId === u.id && st.replenishAt! > now)
      .sort((a, b) => b.at - a.at);
    const cap = u.id === legacyNom.id ? 0 : Math.max(0, (u.isNAT ? p.stars.weeklyNAT : p.stars.weeklyBN) - int(2, 6));
    for (const st of recent.slice(cap)) delete s.stars[st.id];
  }
  // FreshBN: 7 stars in the last 3 days -> 3 left.
  const freshTargets = shuffle(ldMaps.filter((m) => m.rankedAt! < daysAgo(3) && m.mapperId !== freshBN.id && !m.guestMapperIds.includes(freshBN.id))).slice(0, 7);
  freshTargets.forEach((m, i) => {
    const at = daysAgo(2.8 - i * 0.35);
    const sid = id('s');
    s.stars[sid] = { id: sid, castorId: freshBN.id, mapId: m.id, at, replenishAt: at + p.stars.replenishDays * DAY, fromBonus: null };
  });

  // Bonus stars for nominators of maps ranked in the last week.
  for (const m of ldMaps.filter((x) => x.rankedAt! > daysAgo(p.stars.bonusLifetimeDays))) {
    const amount = m.dqCount === 0 ? p.stars.bonusZeroDQ : m.dqCount === 1 ? p.stars.bonusOneDQ : 0;
    if (!amount) continue;
    for (const n of Object.values(s.nominations).filter((x) => x.mapId === m.id && x.voidedAt === null)) {
      const gid = id('bg');
      s.bonusGrants[gid] = { id: gid, userId: n.userId, amount, remaining: amount, grantedAt: m.rankedAt!, expiresAt: m.rankedAt! + p.stars.bonusLifetimeDays * DAY, sourceMapId: m.id, expiredNotified: false };
    }
  }

  // -------------------------------------------------------------------------
  // Qualified maps (10)

  const qualifiedSpecs = [1, 2, 4, 5, 7, 9, 11, 13, 8, 14];
  const qualified: Beatmapset[] = qualifiedSpecs.map((d) => {
    const m = makeMap(pick(generic).id, { status: 'qualified', qualifiedAt: daysAgo(d), qualifiedElapsedMs: d * DAY, pendingAt: daysAgo(d + int(10, 40)), mvIssues: [] });
    m.lastActivityAt = m.qualifiedAt!;
    addNoms(m, 3, m.qualifiedAt!, { exclude: [legacyNom.id, freshBN.id] });
    return m;
  });
  const [, , , , , , , qPlayer87, qFrozen, qOverdue] = qualified;

  // Frozen by 2 BN flags, case opened 3 days ago (qualified 8 days ago -> 5 days on the clock).
  qFrozen.frozen = true;
  qFrozen.qualifiedElapsedMs = 5 * DAY;
  qFrozen.category = 'level_design';
  const frozenCase = id('fc');
  s.cases[frozenCase] = { id: frozenCase, mapId: qFrozen.id, openedAt: daysAgo(3), deadlineAt: daysAgo(3) + p.natReviewDays * DAY, trigger: 'bn', outcome: null, reviewerId: null, note: null, decidedAt: null, overdue: false };
  const flaggers = (map: Beatmapset, n: number) =>
    shuffle(bns.filter((u) => u.id !== map.mapperId && !map.guestMapperIds.includes(u.id) && !everNom(u.id, map.id) && u.id !== freshBN.id && u.id !== legacyNom.id)).slice(0, n);
  flaggers(qFrozen, 2).forEach((u, i) => {
    const fid = id('f');
    s.flags[fid] = {
      id: fid,
      mapId: qFrozen.id,
      source: 'bn',
      userId: u.id,
      reasonCategory: i === 0 ? 'Wrong category' : 'Gameplay quality',
      reasonText: i === 0 ? 'Mostly jump farm patterns; this reads as Mechanics, not Level Design.' : 'Spacing in the Insane is erratic in the second chorus.',
      at: daysAgo(3.4 - i * 0.4),
      caseId: frozenCase,
      markedAbusive: false,
      closedAt: null,
    };
  });

  // Overdue case: opened 12 days ago, deadline passed 2 days ago, still frozen.
  qOverdue.frozen = true;
  qOverdue.qualifiedElapsedMs = 2 * DAY;
  const overdueCase = id('fc');
  s.cases[overdueCase] = { id: overdueCase, mapId: qOverdue.id, openedAt: daysAgo(12), deadlineAt: daysAgo(2), trigger: 'bn', outcome: null, reviewerId: null, note: null, decidedAt: null, overdue: true };
  flaggers(qOverdue, 2).forEach((u, i) => {
    const fid = id('f');
    s.flags[fid] = {
      id: fid,
      mapId: qOverdue.id,
      source: 'bn',
      userId: u.id,
      reasonCategory: 'Timing / offset',
      reasonText: i === 0 ? 'Offset is about 8 ms early through the whole song.' : 'Agree with the offset concern; also a red line is missing at 02:10.',
      at: daysAgo(12.5 - i * 0.4),
      caseId: overdueCase,
      markedAbusive: false,
      closedAt: null,
    };
  });

  // 87 player reports, no case yet.
  const reporters = shuffle(players.filter((u) => u.id !== qPlayer87.mapperId && !qPlayer87.guestMapperIds.includes(u.id))).slice(0, 87);
  reporters.forEach((u) => {
    const fid = id('f');
    s.flags[fid] = {
      id: fid,
      mapId: qPlayer87.id,
      source: 'player',
      userId: u.id,
      reasonCategory: pick(['Gameplay quality', 'Gameplay quality', 'Other', 'Metadata']),
      reasonText: pick(['Unplayable second half', 'This map is unfair', 'Song title is wrong', 'Rhythm makes no sense', 'Too hard for its star rating']),
      at: daysAgo(rand() * 4),
      caseId: null,
      markedAbusive: false,
      closedAt: null,
    };
  });

  // -------------------------------------------------------------------------
  // Pending maps (20)

  const pendingMaps: Beatmapset[] = [];
  const mkPending = (mapperId: Id, o: Partial<Beatmapset> = {}) => {
    const m = makeMap(mapperId, { status: 'pending', pendingAt: daysAgo(int(2, 20)), ...o });
    m.lastActivityAt = Math.max(m.pendingAt!, daysAgo(int(0, 12)));
    pendingMaps.push(m);
    return m;
  };

  // PastelWaltz: high-star Western pop Level Design map with 1/8 sliderstreams, 1 nomination.
  const pastelMap = mkPending(pastel.id, {
    title: 'Glasshouse Summer',
    artist: 'Velvet Satellites',
    genre: 'Western pop',
    language: 'English',
    category: 'level_design',
    isFA: false,
    mvIssues: [{ check: 'Missing preview point', severity: 'minor', message: 'No preview point is set for the song select screen.' }],
    description: 'A bright pop song mapped around its vocal runs, with 1/8 sliderstreams on every melisma. Hard to classify, easy to love.',
    guestMapperIds: [],
  });
  pastelMap.difficulties = [
    { name: 'Normal', starRating: 2.3, skillTags: [], lengthSec: 214 },
    { name: 'Hard', starRating: 3.6, skillTags: ['reading'], lengthSec: 214 },
    { name: 'Insane', starRating: 5.4, skillTags: ['reading', 'tech'], lengthSec: 214 },
    { name: 'Melisma', starRating: 7.2, skillTags: ['1/8 sliderstreams', 'tech', 'reading'], lengthSec: 214 },
  ];
  pastelMap.lastActivityAt = daysAgo(1);
  const pastelNominator = bns.find((u) => u.id !== legacyNom.id && u.id !== freshBN.id && u.id !== problemNom.id && !u.isLegacyBN)!;
  addNoms(pastelMap, 1, daysAgo(1.5), { include: [pastelNominator.id] });

  // aimgod_77: one pending Mechanics map.
  mkPending(aimgod.id, { category: 'mechanics', genre: 'Drum and bass', title: 'Velocity Overdrive', guestMapperIds: [] });

  // ProblemNom: 3 maps disqualified this week (pending again, nominations voided).
  const problemMaps = [1, 3, 5].map((d) => {
    const m = mkPending(pick(generic).id, { dqCount: 1, category: pick(['mechanics', 'level_design'] as Category[]) });
    m.guestMapperIds = m.guestMapperIds.filter((g) => g !== problemNom.id);
    const voided = addNoms(m, 3, daysAgo(d + 7), { voidedAt: daysAgo(d), include: [problemNom.id] });
    addDQ(m, daysAgo(d), voided, pick(DQ_REASONS));
    m.lastActivityAt = daysAgo(d);
    return m;
  });
  void problemMaps;
  Object.assign(s.nominators[problemNom.id], {
    allowanceAvailable: 0,
    lastAccrualAt: now - 1.3 * DAY,
    cooldownLevel: 1,
    cooldownTriggeredAt: daysAgo(1),
    cooldownUntil: daysAgo(1) + p.cooldownResetDays * DAY,
  });

  // Three maps with unrankable verifier issues.
  const unrankable = (i: number): MVIssue[] => [{ ...MV_CATALOGUE[[0, 1, 3][i]] } as MVIssue, ...(i === 2 ? [{ ...MV_CATALOGUE[2] } as MVIssue] : [])];
  const petitionCollecting = mkPending(pick(generic).id, { mvIssues: unrankable(0), category: 'level_design' });
  const petitionAwaiting = mkPending(pick(generic).id, { mvIssues: unrankable(1), category: 'mechanics' });
  mkPending(pick(generic).id, { mvIssues: unrankable(2), category: 'level_design', title: 'Static Lullaby' });

  const signers = (map: Beatmapset, n: number) =>
    shuffle(bns.filter((u) => u.id !== map.mapperId && !map.guestMapperIds.includes(u.id) && u.id !== legacyNom.id && u.id !== freshBN.id && u.id !== problemNom.id)).slice(0, n);
  const pc = id('op');
  s.petitions[pc] = {
    id: pc,
    mapId: petitionCollecting.id,
    signatures: signers(petitionCollecting, 2).map((u, i) => ({ userId: u.id, reason: i === 0 ? 'The unsnap is a deliberate 1/12 note the verifier misreads.' : 'Checked in the editor: the slider tail lands on a 1/12 tick by design.', at: daysAgo(4 - i), voided: false })),
    status: 'collecting',
    openedAt: daysAgo(4),
    submittedAt: null,
    deadlineAt: null,
    decidedBy: null,
    decisionNote: null,
    overdue: false,
  };
  const pa = id('op');
  s.petitions[pa] = {
    id: pa,
    mapId: petitionAwaiting.id,
    signatures: signers(petitionAwaiting, 3).map((u, i) => ({
      userId: u.id,
      reason: ['The only release of this song is a lossless master; 320 kbps is the closest available.', 'Audio quality matters for this track and the file is still small.', 'Agree, the re-encode audibly damages the cymbals.'][i],
      at: daysAgo(6 - i),
      voided: false,
    })),
    status: 'awaiting_nat',
    openedAt: daysAgo(6),
    submittedAt: daysAgo(4),
    deadlineAt: daysAgo(4) + p.natReviewDays * DAY,
    decidedBy: null,
    decisionNote: null,
    overdue: false,
  };

  // The rest: a mix of 0/1/2 nominations; two are close to going idle.
  while (pendingMaps.length < 20) {
    const m = mkPending(pick(generic).id);
    const k = pendingMaps.length % 3;
    if (k > 0) addNoms(m, k, daysAgo(int(1, 8)), { exclude: [legacyNom.id, freshBN.id, arbiter.id, problemNom.id] });
    if (pendingMaps.length >= 19) m.lastActivityAt = daysAgo(int(24, 27));
  }

  // -------------------------------------------------------------------------
  // WIP (15) and graveyard (10)

  for (let i = 0; i < 15; i++) {
    const owner = i < 2 ? pastel.id : i < 4 ? almost.id : pick(generic).id;
    const m = makeMap(owner, { status: 'wip', category: chance(0.3) ? pick(['mechanics', 'level_design'] as Category[]) : null, createdAt: daysAgo(int(1, 25)) });
    m.lastActivityAt = Math.max(m.createdAt, daysAgo(int(0, 20)));
    if (chance(0.2)) m.mvIssues.push({ ...MV_CATALOGUE[0] } as MVIssue);
  }
  for (let i = 0; i < 10; i++) {
    const m = makeMap(i === 0 ? pastel.id : pick(generic).id, { status: 'graveyard', description: GRAVEYARD_BLURBS[i], createdAt: daysAgo(int(120, 500)) });
    m.lastActivityAt = daysAgo(int(30, 200));
    m.pendingAt = chance(0.6) ? m.lastActivityAt - int(5, 50) * DAY : null;
    if (!m.pendingAt) m.category = chance(0.5) ? m.category : null;
  }

  // -------------------------------------------------------------------------
  // Plays and downloads

  const allPlayers = Object.values(s.users).filter((u) => !u.isAdmin);
  const ctx: Ctx = { s: s as Ctx['s'], now, events: [] };
  const dedicated = players.slice(1, 7); // play every ranked LD map soon after it ranks
  for (const m of [...ldMaps, ...mechMaps, ...qualified]) {
    const start = m.status === 'ranked' ? m.rankedAt! : m.qualifiedAt!;
    const span = now - start;
    const count = m.status === 'qualified' ? int(3, 12) : m.category === 'mechanics' ? int(40, 100) : int(15, 50);
    for (let i = 0; i < count; i++) {
      ctx.now = start + rand() * span;
      addPlay(ctx, pick(allPlayers).id, m.id);
    }
    if (m.status === 'ranked' && m.category === 'level_design') {
      for (const u of dedicated) {
        ctx.now = Math.min(now - HOUR, start + rand() * 20 * DAY);
        addPlay(ctx, u.id, m.id);
      }
    }
    const dl = int(15, m.category === 'mechanics' ? 140 : 90);
    for (const u of shuffle(allPlayers).slice(0, dl)) s.downloads[`${u.id}|${m.id}`] = { userId: u.id, mapId: m.id, at: start + rand() * span };
  }
  for (const m of pendingMaps) for (const u of shuffle(allPlayers).slice(0, int(2, 25))) s.downloads[`${u.id}|${m.id}`] = { userId: u.id, mapId: m.id, at: m.pendingAt! };

  // -------------------------------------------------------------------------
  // Membership history: vouches, strikes, invites, a candidacy and a removal vote

  bns
    .filter((u) => u.id !== freshBN.id)
    .slice(0, 4)
    .forEach((u, i) => {
      const vid = id('v');
      s.vouches[vid] = { id: vid, voucherId: u.id, candidateId: almost.id, at: daysAgo(20 + i * 25) };
    });
  for (const m of mappers.slice(9, 14)) {
    const vid = id('v');
    s.vouches[vid] = { id: vid, voucherId: pick(nominatorsAll.filter((u) => u.id !== freshBN.id)).id, candidateId: m.id, at: daysAgo(int(16, 200)) };
  }

  reportHappy.playerStrikes = 2;
  reportHappy.chatBanUntil = now + 22 * HOUR;
  [ldMaps[30], ldMaps[31]].forEach((m, i) => {
    const fid = id('f');
    s.flags[fid] = { id: fid, mapId: m.id, source: 'player', userId: reportHappy.id, reasonCategory: 'Other', reasonText: 'Mapper is overrated, report this', at: m.qualifiedAt! + DAY, caseId: null, markedAbusive: true, closedAt: m.rankedAt };
    void i;
  });

  for (const u of bns.filter((x) => x.isLegacyBN)) s.natInvites[u.id] = { userId: u.id, invitedAt: daysAgo(10), cycle: 'founding', status: 'pending' };

  const season = seasonFor(now, p);
  s.jobs.inviteCyclesDone[season.id] = true;
  const candidate = bns.find((u) => !u.isLegacyBN && u.id !== freshBN.id && u.id !== problemNom.id && u.id !== pastelNominator.id)!;
  s.natInvites[candidate.id] = { userId: candidate.id, invitedAt: daysAgo(30), cycle: season.id, status: 'submitted' };
  const ncid = id('nc');
  const bnVoters = shuffle(bns.filter((u) => u.id !== candidate.id && !u.isLegacyBN)).slice(0, 9);
  const natVoters = nat.slice(1, 4);
  s.candidacies[ncid] = {
    id: ncid,
    userId: candidate.id,
    invitedAt: daysAgo(30),
    portfolioText: PORTFOLIO_LINES[0],
    portfolioLinks: ldMaps.slice(0, 4).map((m) => `#/beatmaps/${m.id}`),
    votes: [
      ...bnVoters.map((u, i) => ({ userId: u.id, asRole: 'bn' as const, vote: i < 7 ? ('yes' as const) : ('no' as const), at: daysAgo(4 - i * 0.3) })),
      ...natVoters.map((u, i) => ({ userId: u.id, asRole: 'nat' as const, vote: i < 2 ? ('yes' as const) : ('no' as const), at: daysAgo(3 - i * 0.5) })),
    ],
    opensAt: daysAgo(5),
    closesAt: daysAgo(5) + p.natVoteDays * DAY,
    status: 'open',
  };
  const removalTarget = bns.find((u) => !u.isLegacyBN && u.id !== candidate.id && u.id !== freshBN.id && u.id !== problemNom.id && u.id !== pastelNominator.id && !bnVoters.includes(u))!;
  const rvid = id('rv');
  s.removalVotes[rvid] = {
    id: rvid,
    targetUserId: removalTarget.id,
    reason: 'bad_faith_nominations',
    note: 'Nominated four maps from the same mapper within an hour of upload, with no visible modding.',
    openedBy: nat[2].id,
    openedAt: daysAgo(2),
    votes: nat.slice(2, 5).map((u) => ({ userId: u.id, vote: 'yes' as const, at: daysAgo(1.5) })),
    closesAt: daysAgo(2) + p.removalVoteDays * DAY,
    status: 'open',
  };

  // -------------------------------------------------------------------------
  // Replay the last year of reward jobs so packs, badges and mapper points exist on load.

  const historyStart = daysAgo(365);
  s.jobs.lastFaPackAt = historyStart;
  for (let k = 13; k >= 0; k--) {
    const key = monthKey(addMonths(historyStart, -k));
    if (ldPackSnapshotAt(p, key) <= historyStart) s.jobs.ldPacksDone[key] = true;
  }
  for (let t = historyStart + DAY; t <= now; t += DAY) {
    const a = t - DAY;
    ctx.now = t;
    for (let back = 3; back >= 1; back--) {
      const key = monthKey(addMonths(t, -back));
      if (!s.jobs.ldPacksDone[key] && ldPackSnapshotAt(p, key) <= t) runMonthlyPack(ctx, key, t);
    }
    while (s.jobs.lastFaPackAt + p.pack.faPackEveryDays * DAY <= t) {
      runFaPack(ctx, s.jobs.lastFaPackAt, s.jobs.lastFaPackAt + p.pack.faPackEveryDays * DAY);
      s.jobs.lastFaPackAt += p.pack.faPackEveryDays * DAY;
    }
    const sa = seasonFor(a, p);
    if (sa.id !== seasonFor(t, p).id) seasonRollover(ctx, sa);
    if (t > daysAgo(330)) checkHomeTop(ctx);
  }
  ctx.now = now;
  s.events.sort((x, y) => x.at - y.at);
  s.events.push({ id: id('e'), at: now, actorId: admin.id, type: 'admin', message: 'Ranked Lab seeded: a fictional world with every role and every map status.' });

  // -------------------------------------------------------------------------
  // Personas

  s.personas = [
    { userId: pastel.id, role: 'Mapper', demonstrates: 'High-star Level Design pop map with 1/8 sliderstreams, Pending with 1 nomination' },
    { userId: aimgod.id, role: 'Mapper', demonstrates: 'Prolific Mechanics mapper: several ranked, one pending' },
    { userId: legacyNom.id, role: 'BN (legacy)', demonstrates: 'Full allowance (5), full star wallet, pending NAT invite' },
    { userId: freshBN.id, role: 'BN via favourites', demonstrates: '1 allowance, can vouch, few stars left' },
    { userId: problemNom.id, role: 'BN', demonstrates: '3 DQs this week: cooldown level 1, slower accrual' },
    { userId: arbiter.id, role: 'NAT', demonstrates: 'NAT queue with 3 items, one overdue' },
    { userId: almost.id, role: 'Player / Mapper', demonstrates: '4 ranked maps and 4 vouches: one short on two criteria' },
    { userId: reportHappy.id, role: 'Player', demonstrates: '2 abuse strikes, 24 h chat ban' },
    { userId: admin.id, role: 'Admin', demonstrates: 'Clock, config, crowd simulation' },
  ];
  s.currentUserId = pastel.id;
  return s;
}
