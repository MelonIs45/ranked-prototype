// Every tunable value in the prototype lives here (spec section 11).
// Rules and UI read these through `state.params`, so the admin panel can edit them live.

export type Rounding = 'floor' | 'round' | 'ceil' | 'exact';

export interface Params {
  nominationsRequired: number;
  qualifiedDays: number;
  allowancePerDay: number;
  allowanceCap: number;
  /** Starting allowance for a newly passed BN. */
  newBnAllowance: number;
  natReviewDays: number;
  bnFlagsToOpenCase: number;
  playerFlagsToOpenCase: number;
  dqCooldownTriggers: { count: number; days: number }[];
  /** Days between +1 allowance at cooldown level 0, 1, 2. */
  cooldownAccrualDays: number[];
  cooldownResetDays: number;
  bnCriteria: { favourites: number; subscribers: number; plays: number; rankedMaps: number; vouches: number };
  vouchCooldownDays: number;
  bnTest: { questions: number; passMark: number; retryDays: number };
  removalThreshold: number;
  /** How 2/3 of membership is turned into a vote count. 'floor' makes 5 of 8 pass (spec acceptance test). */
  removalRounding: Rounding;
  removalVoteDays: number;
  natInvite: { ratioTopPercent: number; activityTopPercent: number; ratioWindowDays: number; activityWindowDays: number; minNominations: number };
  natVoteThreshold: number;
  natVoteDays: number;
  stars: {
    weeklyBN: number;
    weeklyNAT: number;
    replenishDays: number;
    bonusZeroDQ: number;
    bonusOneDQ: number;
    bonusLifetimeDays: number;
    perCasterPerMap: number;
  };
  sort: { recentWindowDays: number; decayHalfLifeDays: number; decayOn: boolean };
  homeTopN: number;
  leaderboard: { badgeCutoff: number };
  faStarsCountOnMain: boolean;
  pack: { snapshotDelayDays: number; faPackEveryDays: number };
  mapperBadgeTiers: { fixed: number[]; thenEvery: number };
  legendaryTitleTier: number;
  graveyardDays: number;
  seasonLengthMonths: number;
  categoryNames: { mechanics: string; levelDesign: string };
  ldPpStat: boolean;
  natTenureTiers: number[];
  /** Player-strike ladder: chat-ban hours per strike (index = strike number - 1; 0 = warning only). */
  playerStrikeBanHours: number[];
  /** Strike number at which a player gets the tournament-ban flag. */
  playerTournamentBanStrike: number;
  /** BN strike ladder: [slowLevels, days] per strike; strike >= bnRemovalStrike opens a removal vote. */
  bnStrikeSlow: { levels: number; days: number }[];
  bnRemovalStrike: number;
  maxEvents: number;

  /** Open interpretations (spec "interpretation" items), each a toggle with the spec's default. */
  interp: {
    overrideSignatureSpendsNomination: boolean;
    /** true: the 15-day clock starts on the NAT approval date. */
    overrideApprovalStartsClock: boolean;
    /** What happens when NAT miss the override deadline. */
    overrideDeadline: 'expire_as_denied' | 'auto_approve' | 'stay_open';
    /** What happens when NAT miss a flag-case deadline. */
    flagCaseDeadline: 'stay_frozen' | 'auto_dismiss';
    pauseClockWhileFrozen: boolean;
    /** 'pool': bonus stars expire after bonusLifetimeDays. 'permanent': they never expire. */
    bonusStars: 'pool' | 'permanent';
    /** Vote thresholds measured against total membership or votes cast. */
    voteBasis: 'membership' | 'cast';
    /** When NAT invite cycles run. */
    natInviteCadence: 'season' | 'month';
    graveyardEnabled: boolean;
    /** Monthly LD pack snapshot waits pack.snapshotDelayDays after month end. */
    packSnapshotDelayed: boolean;
  };
}

export const defaultParams: Params = {
  nominationsRequired: 3,
  qualifiedDays: 15,
  allowancePerDay: 1,
  allowanceCap: 5,
  newBnAllowance: 1,
  natReviewDays: 10,
  bnFlagsToOpenCase: 2,
  playerFlagsToOpenCase: 100,
  dqCooldownTriggers: [
    { count: 5, days: 30 },
    { count: 3, days: 7 },
  ],
  cooldownAccrualDays: [1, 2, 3],
  cooldownResetDays: 30,
  bnCriteria: { favourites: 800, subscribers: 100, plays: 100_000, rankedMaps: 5, vouches: 5 },
  vouchCooldownDays: 15,
  bnTest: { questions: 20, passMark: 0.7, retryDays: 7 },
  removalThreshold: 2 / 3,
  removalRounding: 'floor',
  removalVoteDays: 7,
  natInvite: { ratioTopPercent: 25, activityTopPercent: 50, ratioWindowDays: 180, activityWindowDays: 90, minNominations: 5 },
  natVoteThreshold: 0.5,
  natVoteDays: 14,
  stars: {
    weeklyBN: 10,
    weeklyNAT: 25,
    replenishDays: 7,
    bonusZeroDQ: 5,
    bonusOneDQ: 3,
    bonusLifetimeDays: 7,
    perCasterPerMap: 1,
  },
  sort: { recentWindowDays: 30, decayHalfLifeDays: 14, decayOn: true },
  homeTopN: 5,
  leaderboard: { badgeCutoff: 25 },
  faStarsCountOnMain: true,
  pack: { snapshotDelayDays: 30, faPackEveryDays: 30 },
  mapperBadgeTiers: { fixed: [5, 10, 25, 50, 75, 100], thenEvery: 100 },
  legendaryTitleTier: 100,
  graveyardDays: 28,
  seasonLengthMonths: 3,
  categoryNames: { mechanics: 'Mechanics', levelDesign: 'Level Design' },
  ldPpStat: false,
  natTenureTiers: [1, 2, 3, 5],
  playerStrikeBanHours: [0, 24, 24 * 7, 24 * 30, 24 * 30],
  playerTournamentBanStrike: 5,
  bnStrikeSlow: [
    { levels: 0, days: 0 },
    { levels: 1, days: 14 },
    { levels: 2, days: 30 },
  ],
  bnRemovalStrike: 4,
  maxEvents: 8000,

  interp: {
    overrideSignatureSpendsNomination: true,
    overrideApprovalStartsClock: true,
    overrideDeadline: 'expire_as_denied',
    flagCaseDeadline: 'stay_frozen',
    pauseClockWhileFrozen: true,
    bonusStars: 'pool',
    voteBasis: 'membership',
    natInviteCadence: 'season',
    graveyardEnabled: true,
    packSnapshotDelayed: true,
  },
};

/** Where each value came from, shown beside it in the admin config editor. */
export const paramOrigin: Record<string, 'Proposal' | 'Spec'> = {
  nominationsRequired: 'Proposal',
  qualifiedDays: 'Proposal',
  allowancePerDay: 'Proposal',
  allowanceCap: 'Proposal',
  natReviewDays: 'Proposal',
  bnFlagsToOpenCase: 'Proposal',
  playerFlagsToOpenCase: 'Proposal',
  dqCooldownTriggers: 'Proposal',
  cooldownAccrualDays: 'Proposal',
  cooldownResetDays: 'Proposal',
  bnCriteria: 'Proposal',
  vouchCooldownDays: 'Proposal',
  bnTest: 'Spec',
  removalThreshold: 'Proposal',
  natInvite: 'Proposal',
  natVoteThreshold: 'Proposal',
  natVoteDays: 'Spec',
  removalVoteDays: 'Spec',
  stars: 'Proposal',
  sort: 'Proposal',
  homeTopN: 'Proposal',
  leaderboard: 'Proposal',
  faStarsCountOnMain: 'Spec',
  pack: 'Spec',
  mapperBadgeTiers: 'Proposal',
  legendaryTitleTier: 'Proposal',
  graveyardDays: 'Spec',
  seasonLengthMonths: 'Proposal',
  categoryNames: 'Spec',
  ldPpStat: 'Proposal',
  interp: 'Spec',
};

export function cloneParams(p: Params = defaultParams): Params {
  return JSON.parse(JSON.stringify(p));
}
