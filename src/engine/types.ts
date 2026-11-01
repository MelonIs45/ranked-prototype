import type { Params } from '../config/params';

export type Id = string;
export type Ms = number;

export type Category = 'mechanics' | 'level_design';
export type MapStatus = 'wip' | 'pending' | 'qualified' | 'ranked' | 'graveyard';
export type Severity = 'minor' | 'warning' | 'unrankable';

export interface User {
  id: Id;
  username: string;
  avatarColor: string;
  isBN: boolean;
  isNAT: boolean;
  isAdmin: boolean;
  /** Synthetic users created by the admin crowd simulator; hidden from the role switcher. */
  isCrowd: boolean;
  isLegacyBN: boolean;
  bnSince: Ms | null;
  natSince: Ms | null;
  bnQualifiedVia: BnCriterion | null;
  favouritesReceived: number;
  mappingSubscribers: number;
  totalPlays: number;
  title: string | null;
  /** Abuse strikes earned as a player reporter. */
  playerStrikes: number;
  chatBanUntil: Ms | null;
  tournamentBanned: boolean;
  /** Manual adjustment to evolving-mapper badge points (admin-editable seed history). */
  mapperPointsAdjust: number;
  /** Seeded performance stats used only for the fake pp display. */
  pp: number;
  ldPp: number;
  country: string;
}

export interface NominatorState {
  userId: Id;
  allowanceAvailable: number;
  lastAccrualAt: Ms;
  cooldownLevel: number;
  cooldownUntil: Ms | null;
  /** When the current cooldown level was last triggered; DQs before this don't count toward a new trigger. */
  cooldownTriggeredAt: Ms | null;
  flagStrikes: number;
  abuseSlowLevels: number;
  abuseSlowUntil: Ms | null;
}

export interface BNProfile {
  userId: Id;
  open: boolean;
  genres: string[];
  skillsets: string[];
  categories: Category[];
  requestInstructions: string;
}

export interface Difficulty {
  name: string;
  starRating: number;
  skillTags: string[];
  lengthSec: number;
}

export interface MVIssue {
  check: string;
  severity: Severity;
  message: string;
}

export interface Beatmapset {
  id: Id;
  title: string;
  artist: string;
  mapperId: Id;
  guestMapperIds: Id[];
  genre: string;
  language: string;
  isFA: boolean;
  category: Category | null;
  difficulties: Difficulty[];
  status: MapStatus;
  mvIssues: MVIssue[];
  description: string;
  createdAt: Ms;
  pendingAt: Ms | null;
  qualifiedAt: Ms | null;
  /** Qualified time accumulated so far, in ms (the qualified clock). */
  qualifiedElapsedMs: number;
  frozen: boolean;
  rankedAt: Ms | null;
  dqCount: number;
  lastActivityAt: Ms;
  /** Seeded legacy play count (includes retries); shown as secondary. */
  legacyPlaysBase: number;
}

export interface Nomination {
  id: Id;
  mapId: Id;
  userId: Id;
  at: Ms;
  viaOverride: boolean;
  voidedAt: Ms | null;
}

export type PetitionStatus = 'collecting' | 'awaiting_nat' | 'approved' | 'denied' | 'expired';

export interface OverrideSignature {
  userId: Id;
  reason: string;
  at: Ms;
  voided: boolean;
}

export interface OverridePetition {
  id: Id;
  mapId: Id;
  signatures: OverrideSignature[];
  status: PetitionStatus;
  openedAt: Ms;
  submittedAt: Ms | null;
  deadlineAt: Ms | null;
  decidedBy: Id | null;
  decisionNote: string | null;
  overdue: boolean;
}

export type FlagSource = 'bn' | 'player';

export interface Flag {
  id: Id;
  mapId: Id;
  source: FlagSource;
  userId: Id;
  reasonCategory: string;
  reasonText: string;
  at: Ms;
  caseId: Id | null;
  markedAbusive: boolean;
  /** Set when the map leaves qualified (DQ or rank): flags only count while the map is in its current qualified run. */
  closedAt: Ms | null;
}

export type CaseOutcome = 'dismissed' | 'dq_criteria' | 'dq_category';

export interface FlagCase {
  id: Id;
  mapId: Id;
  openedAt: Ms;
  deadlineAt: Ms;
  trigger: FlagSource;
  outcome: CaseOutcome | null;
  reviewerId: Id | null;
  note: string | null;
  decidedAt: Ms | null;
  overdue: boolean;
}

export interface Disqualification {
  id: Id;
  mapId: Id;
  byUserId: Id;
  reason: string;
  kind: 'criteria' | 'category' | 'direct';
  at: Ms;
  nominatorIds: Id[];
}

export interface StarCast {
  id: Id;
  castorId: Id;
  mapId: Id;
  at: Ms;
  /** null when cast from a bonus grant (bonus stars don't return). */
  replenishAt: Ms | null;
  fromBonus: Id | null;
}

export interface BonusStarGrant {
  id: Id;
  userId: Id;
  amount: number;
  remaining: number;
  grantedAt: Ms;
  expiresAt: Ms | null;
  sourceMapId: Id;
  expiredNotified: boolean;
}

export interface Vouch {
  id: Id;
  voucherId: Id;
  candidateId: Id;
  at: Ms;
}

export type BnCriterion = 'legacy' | 'favourites' | 'subscribers' | 'plays' | 'rankedMaps' | 'vouches';

export interface BNApplication {
  id: Id;
  userId: Id;
  criterionMet: BnCriterion;
  questionIds: Id[];
  answers: number[] | null;
  testScore: number | null;
  status: 'in_test' | 'passed' | 'failed';
  at: Ms;
}

export interface TestQuestion {
  id: Id;
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface CandidacyVote {
  userId: Id;
  asRole: 'bn' | 'nat';
  vote: 'yes' | 'no';
  at: Ms;
}

export interface NATInvite {
  userId: Id;
  invitedAt: Ms;
  cycle: 'founding' | string;
  status: 'pending' | 'accepted' | 'declined' | 'submitted';
}

export interface NATCandidacy {
  id: Id;
  userId: Id;
  invitedAt: Ms;
  portfolioText: string;
  portfolioLinks: string[];
  votes: CandidacyVote[];
  opensAt: Ms;
  closesAt: Ms;
  status: 'open' | 'accepted' | 'rejected';
}

export interface RemovalVote {
  id: Id;
  targetUserId: Id;
  reason: 'bad_faith_nominations' | 'vouch_abuse' | 'flag_abuse';
  note: string;
  openedBy: Id;
  openedAt: Ms;
  votes: { userId: Id; vote: 'yes' | 'no'; at: Ms }[];
  closesAt: Ms;
  status: 'open' | 'passed' | 'failed';
}

export interface Play {
  id: Id;
  userId: Id;
  mapId: Id;
  diffName: string;
  score: number;
  accuracy: number;
  pp: number;
  durationSec: number;
  at: Ms;
}

export interface Download {
  userId: Id;
  mapId: Id;
  at: Ms;
}

export type BadgeType = 'bn_top_main' | 'bn_top_fa' | 'best_of_ld' | 'mapper_tier';

export interface Badge {
  id: Id;
  userId: Id;
  type: BadgeType;
  season: string | null;
  tier: number | null;
  rank: number | null;
  awardedAt: Ms;
}

export type PackType = 'ld_top_half' | 'ld_top_quarter' | 'fa_top_half' | 'fa_top_quarter';

export interface Pack {
  id: Id;
  type: PackType;
  periodLabel: string;
  /** Month key (YYYY-MM) for LD packs; window start for FA packs. */
  periodKey: string;
  mapIds: Id[];
  /** Star totals at snapshot, by map id. */
  starTotals: Record<Id, number>;
  createdAt: Ms;
  inRankedPlay: boolean;
}

export interface Season {
  id: string;
  label: string;
  startsAt: Ms;
  endsAt: Ms;
}

export type EventType =
  | 'clock'
  | 'map_created'
  | 'map_pending'
  | 'map_category'
  | 'map_revived'
  | 'map_graveyarded'
  | 'nominated'
  | 'qualified'
  | 'ranked'
  | 'override_signed'
  | 'override_submitted'
  | 'override_approved'
  | 'override_denied'
  | 'override_expired'
  | 'flag_bn'
  | 'flag_player'
  | 'case_opened'
  | 'case_dismissed'
  | 'case_overdue'
  | 'disqualified'
  | 'flag_abusive'
  | 'strike'
  | 'allowance'
  | 'cooldown'
  | 'star_cast'
  | 'star_returned'
  | 'bonus_granted'
  | 'bonus_expired'
  | 'vouch'
  | 'bn_test'
  | 'bn_joined'
  | 'bn_removed'
  | 'nat_invite'
  | 'nat_invite_response'
  | 'nat_candidacy'
  | 'nat_vote'
  | 'nat_joined'
  | 'removal_opened'
  | 'removal_vote'
  | 'removal_closed'
  | 'play'
  | 'download'
  | 'pack_created'
  | 'season_rollover'
  | 'badge'
  | 'home_top'
  | 'profile'
  | 'admin';

export interface Event {
  id: Id;
  at: Ms;
  actorId: Id | null;
  type: EventType;
  mapId?: Id;
  targetUserId?: Id;
  message: string;
}

export interface State {
  version: number;
  now: Ms;
  seq: number;
  params: Params;
  currentUserId: Id;
  users: Record<Id, User>;
  nominators: Record<Id, NominatorState>;
  bnProfiles: Record<Id, BNProfile>;
  maps: Record<Id, Beatmapset>;
  nominations: Record<Id, Nomination>;
  petitions: Record<Id, OverridePetition>;
  flags: Record<Id, Flag>;
  cases: Record<Id, FlagCase>;
  dqs: Record<Id, Disqualification>;
  stars: Record<Id, StarCast>;
  bonusGrants: Record<Id, BonusStarGrant>;
  vouches: Record<Id, Vouch>;
  applications: Record<Id, BNApplication>;
  testQuestions: TestQuestion[];
  natInvites: Record<Id, NATInvite>;
  candidacies: Record<Id, NATCandidacy>;
  removalVotes: Record<Id, RemovalVote>;
  plays: Record<Id, Play>;
  /** Keyed `${userId}|${mapId}` so a pair can only exist once. */
  downloads: Record<string, Download>;
  badges: Record<Id, Badge>;
  packs: Record<Id, Pack>;
  /** Map ids that have ever entered the home top N (each counted once for the mapper badge). */
  homeTopEntered: Record<Id, Ms>;
  /** Housekeeping for scheduled jobs. */
  jobs: {
    ldPacksDone: Record<string, true>;
    lastFaPackAt: Ms;
    seasonsRolled: Record<string, true>;
    inviteCyclesDone: Record<string, true>;
  };
  events: Event[];
  /** Personas shown at the top of the role switcher. */
  personas: { userId: Id; role: string; demonstrates: string }[];
}

export interface ActionResult {
  state: State;
  events: Event[];
}

export type Action<A> = (state: State, actorId: Id, args: A, now: Ms) => ActionResult;
