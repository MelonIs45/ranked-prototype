# Ranked Section Reform — Prototype Build Spec

Nov 1, 2026 · @Ryan

## 1. Purpose and scope

Build a clickable web prototype that simulates the proposed ranked-section reform end to end: fake users in every role, fake beatmaps moving through the new nomination pipeline, a controllable clock, and the new stars, sorting and rewards systems. It exists so people can try each role and watch the rules play out, not to replace the real site.

**Instructions to the implementing AI**

1. Read the whole spec before writing code. Build in the phase order in section 12.
2. Put every number in one config module (section 11). The proposal stresses that all values are adjustable, so nothing numeric is hard-coded in rules or UI.
3. Where this spec says "interpretation", implement the stated default and make it a config toggle.
4. All rules live in a pure, unit-tested engine; the UI only calls engine actions and renders state.

**Goals**

- Any visitor can switch between seeded users (player, mapper, BN, NAT, admin) and perform that role's actions.
- Every rule in sections 5 to 8 is enforced, with a clear message when an action is blocked and why.
- Time can be fast-forwarded so qualified periods, star replenishment, cooldowns, votes and season rollovers can be seen in minutes.
- An admin panel edits parameters live and simulates crowd behaviour (plays, downloads, player reports).

**Non-goals**

- No real osu! API, accounts, .osu parsing, gameplay or pp calculation. Scores and pp are generated numbers.
- No production security. Login is a role switcher.
- No official branding. Name it something neutral (working title "Ranked Lab") and show "Unofficial concept prototype" in the footer. All songs, artists and users are invented.

## 2. Tech stack, architecture and simulated clock

Use a client-only single-page app so the prototype deploys as static files and needs no server.

| Layer | Choice | Notes |
| --- | --- | --- |
| Framework | React + TypeScript + Vite | React Router for pages |
| Styling | Tailwind CSS | Dark theme by default, osu!-adjacent pinks/purples but no official assets |
| State | Zustand store, persisted to localStorage | "Reset to seed" button in admin |
| Rules | Pure TS engine in `src/engine` | No React imports; fully unit tested |
| Tests | Vitest | One test per acceptance check in section 12 |
| Charts | Recharts | Star history, leaderboard trends |
| Random data | seedrandom with fixed seed | Same seed data on every reset |

**Folder layout**

- `src/config/params.ts` — every tunable value (section 11).
- `src/engine/` — types, actions, `tick()`, selectors (sorts, leaderboards).
- `src/data/seed.ts` — deterministic seed generator (section 10).
- `src/store/` — Zustand store wrapping engine calls.
- `src/pages/`, `src/components/` — UI.

**Engine contract**

- Every action is `action(state, actorId, args, now) → { state, events }` or throws `RuleError(code, message)`.
- The UI shows `RuleError.message` verbatim, e.g. "You have 0 nominations available. Next one in 14 h."
- Every successful action appends `Event` records, shown in a global activity feed and on the relevant map/user pages.
- Buttons are disabled with a tooltip when a precondition fails, using the same check functions the engine uses (`canNominate`, `canStar`, etc.).

**Simulated clock**

- `state.now` is the only time source; never call `Date.now()` in the engine. Start at 2026-11-01 12:00 UTC.
- A clock widget in the header shows the simulated date and buttons: +1 hour, +1 day, +7 days, +30 days, "to end of season".
- Advancing time calls `tick(state, from, to)`, which processes scheduled jobs in time order, one simulated day at a time: nomination allowance accrual, cooldown expiry, star replenishment and bonus expiry, qualified → ranked, NAT review deadlines, vote closures, monthly pack snapshots, NAT invite cycles and season rollover.
- Each processed job writes an Event, so fast-forwarding 30 days produces a readable log of what happened.

## 3. User roles and permissions

Roles are flags on a user, not exclusive types: every user is a player and can map; BN and NAT are added on top; NAT members also act as nominators.

| Role | Who | Core purpose in the prototype |
| --- | --- | --- |
| Player | Every user | Browse, play (simulated), download, report qualified maps |
| Mapper | Any user who owns a beatmapset | Upload, pick category, push WIP → Pending, track progress |
| BN | Users who met one criterion + passed the test | Nominate, sign overrides, flag, shoot stars, vouch, vote on NAT candidates (optional) |
| NAT | Invited and voted in | Everything a BN can do, plus review flags/overrides, DQ, vote on removals and candidates (required) |
| Admin | Prototype operator only | Clock, config, crowd simulation, reset. Not part of the proposal |

**Permissions matrix**

| Action | Player | Map owner | BN | NAT | Admin |
| --- | --- | --- | --- | --- | --- |
| Browse, sort, filter, view leaderboards | Yes | Yes | Yes | Yes | Yes |
| Simulated play / download | Yes | Yes | Yes | Yes | Yes |
| Report a qualified map (player flag) | Yes | No (own map) | Yes | Yes | — |
| Create map, set category, move WIP → Pending | — | Yes | — | — | — |
| Nominate a pending map | — | No (own map) | Yes | Yes | — |
| Sign an override petition | — | No | Yes | Yes | — |
| BN flag on a qualified map | — | No | Yes | Yes | — |
| Shoot stars (Level Design ranked only) | — | No | Yes, not own/nominated | Yes, not own/nominated | — |
| Vouch for a BN applicant | — | — | Yes, 1 per 15 days | Yes, 1 per 15 days | — |
| Review flag cases and override petitions, DQ | — | — | — | Yes | — |
| Mark flags as abusive | — | — | — | Yes | — |
| Vote on BN removal | — | — | — | Yes (counts toward 2/3) | — |
| Vote on NAT candidates | — | — | Optional | Required | — |
| Edit own BN directory profile | — | — | Yes | Yes | — |
| Clock, config, crowd simulation, reset | — | — | — | — | Yes |

**Role switcher**

- A dropdown in the header lists seeded users grouped by role, with a search box. Selecting one sets `currentUserId`; there is no password.
- Show role badges next to the current user's name and a short "what you can do here" hint on each page for that role.
- Include a "Demo personas" shortlist (section 10) at the top of the switcher.

## 4. Data model

All entities live in one normalised state object keyed by id. Derived values (ranked map count, ratios, star totals, leaderboards) are computed by selectors, not stored.

| Entity | Key fields | Notes |
| --- | --- | --- |
| User | id, username, avatarColor, isBN, isNAT, isAdmin, isLegacyBN, bnSince, natSince, bnQualifiedVia, favouritesReceived, mappingSubscribers, totalPlays, title | Stats are seeded numbers the admin can edit |
| NominatorState | userId, allowanceAvailable, lastAccrualAt, cooldownLevel, cooldownUntil, flagStrikes | One per BN/NAT |
| BNProfile | userId, open (bool), genres\[\], skillsets\[\], categories\[\], requestInstructions | Powers the BN directory |
| Beatmapset | id, title, artist, mapperId, guestMapperIds\[\], genre, language, isFA, category, difficulties\[\], status, mvIssues\[\], createdAt, pendingAt, qualifiedAt, qualifiedDaysElapsed, frozen, rankedAt, dqCount, lastActivityAt | status ∈ wip, pending, qualified, ranked, graveyard |
| Difficulty | name, starRating, skillTags\[\] | skillTags e.g. aim, stream, tech, reading, SV, alt, 1/8 sliderstreams |
| MVIssue | check, severity, message | severity ∈ minor, warning, unrankable |
| Nomination | id, mapId, userId, at, viaOverride, voidedAt | Voided on DQ |
| OverridePetition | id, mapId, signatures\[{userId, reason, at}\], status, submittedAt, deadlineAt, decidedBy, decisionNote | status ∈ collecting, awaiting\_nat, approved, denied, expired |
| Flag | id, mapId, source, userId, reasonCategory, reasonText, at, caseId, markedAbusive | source ∈ bn, player |
| FlagCase | id, mapId, openedAt, deadlineAt, trigger, outcome, reviewerId, note | outcome ∈ dismissed, dq\_criteria, dq\_category |
| Disqualification | id, mapId, byUserId, reason, at, nominatorIds\[\] | Counts against each nominator |
| StarCast | id, castorId, mapId, at, replenishAt, fromBonus | One row per star |
| BonusStarGrant | id, userId, amount, grantedAt, expiresAt, sourceMapId | +5 or +3 |
| Vouch | id, voucherId, candidateId, at |  |
| BNApplication | id, userId, criterionMet, testScore, status, at |  |
| TestQuestion | id, prompt, options\[\], correctIndex, explanation | Fictional ranking-criteria quiz |
| NATCandidacy | id, userId, invitedAt, portfolioText, portfolioLinks\[\], votes\[{userId, asRole, vote}\], opensAt, closesAt, status | asRole ∈ bn, nat |
| RemovalVote | id, targetUserId, reason, openedBy, votes\[\], closesAt, status |  |
| Play | id, userId, mapId, diffName, score, accuracy, pp, durationSec, at | Drives play time + leaderboards |
| Download | userId, mapId, at | Unique per pair |
| Badge | id, userId, type, season, tier, awardedAt | Types in section 8 |
| Pack | id, type, periodLabel, mapIds\[\], createdAt, inRankedPlay |  |
| Season | id, label, startsAt, endsAt | Quarterly |
| Event | id, at, actorId, type, mapId?, targetUserId?, message | Audit log |

## 5. Beatmap lifecycle and ranking rules

A map needs three nominations, then sits 15 days in qualified under NAT supervision before ranking; failing automated checks routes it through an override petition instead.

&#91;embedded content: beatmap lifecycle · 7 states\]

A flag case pauses the qualified clock; dismissal resumes it, a DQ sends the map back to Pending with nominations voided. Pending maps can also go idle into the graveyard.

### 5.1 Statuses

- **WIP** — mapper is still working; not nominatable.
- **Pending** — mapper has chosen a category (Mechanics or Level Design). Category is editable until the first nomination, then locked.
- **Qualified** — 3 nominations reached. Ranks after 15 qualified days unless frozen or disqualified.
- **Ranked** — leaderboards, pp, appears in its category's listing.
- **Graveyard** — WIP/Pending with no activity for 28 days (interpretation: keeps today's behaviour; configurable). Mapper can revive to Pending.

### 5.2 Nominating

Preconditions for `nominate(map)`, each with its own error message:

1. Actor is BN or NAT and is not the mapper or a guest mapper.
2. Map is Pending and the actor has not already nominated it.
3. Actor has ≥ 1 nomination available and is not blocked by a cooldown.

**Allowance:** +1 nomination per simulated day, stacking to a maximum of 5. A nomination spends 1.

**Mapset Verifier:** each map carries seeded `mvIssues`. Clicking Nominate runs `runVerifier(map)`:

- No `unrankable` issues → nomination recorded. Minor/warning issues show as a non-blocking list.
- Any `unrankable` issue → a modal lists the failures and asks "Sign an override petition?" with a required reason field. No regular nomination is possible.

**Third nomination** → status Qualified, `qualifiedAt = now`, `qualifiedDaysElapsed = 0`.

### 5.3 Override petitions

- The first signature opens a petition; each signature spends 1 nomination and requires a written reason.
- At 3 signatures the petition becomes `awaiting_nat` with a 10-day deadline and appears in the NAT queue.
- NAT **approve** → nominations count as real, map goes to Qualified. NAT **deny** → petition closed, signatures voided, map stays Pending.
- Deadline passes with no decision → `expired`, treated as denied, and flagged as overdue in the NAT dashboard (interpretation; configurable).

### 5.4 Qualified period and flags

- Each simulated day an unfrozen qualified map gains 1 qualified day. At 15 it ranks.
- **BN flag:** any BN/NAT except the mapper or its nominators can flag with a required reason. When 2 distinct BN flags exist, a FlagCase opens.
- **Player flag:** a "Report" button on qualified maps (reason category + text, one per player per map). When 100 distinct player reports exist, a FlagCase opens. Admin has "simulate N player reports" because the seed has fewer real users.
- An open FlagCase **freezes** the map: the qualified clock pauses and it cannot rank. NAT have 10 days to decide.
- NAT outcomes: **Dismiss** (unfreeze, clock resumes), **DQ for criteria**, or **DQ for misclassified category**. NAT may also DQ any qualified map directly with a reason.
- A FlagCase past its deadline stays frozen and is shown as overdue (interpretation; configurable).

### 5.5 Disqualification

- DQ returns the map to Pending, voids all nominations, increments `dqCount`, and records a Disqualification against every nominator.
- Nominations spent on a DQ'd map are not refunded.

### 5.6 Nominator cooldowns

- Excessive DQs on maps a nominator nominated trigger escalating cooldowns: ≥ 5 DQs in 30 days or ≥ 3 DQs in 7 days.
- Level 1: allowance accrues every 2 days. Level 2 (triggered again while at level 1): every 3 days.
- Cooldown resets to level 0 after 30 days with no new trigger.

### 5.7 Flag abuse

When dismissing a case, NAT can mark individual flags as abusive (coordinated campaign, not criteria concern). Each mark adds a strike:

| Strike | Player | BN |
| --- | --- | --- |
| 1 | Warning | Warning |
| 2 | 24 h chat ban | Allowance accrual slowed one cooldown level for 14 days |
| 3 | 7-day chat ban | Slowed two levels for 30 days |
| 4 | 30-day chat ban | Removal vote opened automatically |
| 5 | Tournament ban flag | — |

Chat and tournament bans are just badges/labels on the profile in the prototype.

## 6. BN eligibility, NAT membership and removal

Becoming a BN takes any one qualifying criterion plus a passed test; BN status has no activity requirement and is removed only by a 2/3 NAT vote.

### 6.1 BN application (`/bn/apply`)

The page shows a live checklist of criteria with the user's current values; meeting any one unlocks the test.

| Criterion | Default threshold (range in proposal) |
| --- | --- |
| Current or former BN under the old system | `isLegacyBN` |
| Profile beatmap favourites | ≥ 800 (800–1,000) |
| Mapping subscribers | ≥ 100 (100–200) |
| Total plays on own beatmaps | ≥ 100,000 (100,000–500,000) |
| Ranked beatmaps as host (no guest difficulties) | ≥ 5 |
| Vouches from current BNs | ≥ 5 |

- **Vouching:** a BN/NAT can vouch for one user per 15 days, from that user's profile. Vouches are listed publicly with the voucher's name.
- **Test:** 20 multiple-choice questions drawn randomly from a seeded bank of \~40 fictional ranking-criteria questions; pass mark 70%. Show the score and explanations after submission. Failed applicants can retry after 7 days.
- Passing sets `isBN`, `bnSince`, `bnQualifiedVia`, creates NominatorState (allowance 1) and an empty BNProfile.

### 6.2 BN removal

- Any NAT member can open a RemovalVote with a reason category: bad-faith nominations, or vouch abuse. Strike 4 for flag abuse opens one automatically.
- Vote window 7 days. Passes when yes votes ≥ 2/3 of all current NAT members (interpretation: of membership, not votes cast).
- On pass: `isBN = false`, pending override signatures voided, open nominations stay (the map is unaffected).

### 6.3 NAT membership

- **Founding cycle:** at seed time every legacy BN/NAT has a pending NAT invitation they can accept or decline from their dashboard.
- **Invite cycle:** at the start of each season (configurable), `tick()` invites every BN who is both in the top 25% of BNs by nomination-to-DQ ratio and in the top 50% by activity.
  - Ratio = nominations that reached ranked ÷ (DQs + 1), over the last 180 days, minimum 5 nominations to be eligible.
  - Activity = nominations in the last 90 days.
- An invited BN submits a modding portfolio (text + up to 10 map links). Submission opens a 14-day NATCandidacy vote.
- **Voting:** BN votes and NAT votes are tallied separately. The candidate is accepted if yes votes exceed 50% of BN membership **or** exceed 50% of NAT membership. Only one needs to pass.
- BN voting is optional. NAT voting is required: the NAT dashboard lists outstanding votes, and members who miss votes are shown in red on the candidacy page.
- Accepted → `isNAT = true`, `natSince = now`, NAT star allowance applies from the next replenish.

### 6.4 Tenure

NAT tenure badges remain (tiers at 1, 2, 3, 5 years). BN tenure badges are removed and replaced by the performance badges in section 8.

## 7. Ranked split, stars and visibility

Ranked is split into Mechanics and Level Design; both get leaderboards and pp, but stars, the new sorts and all section 8 rewards apply to Level Design only.

### 7.1 The two categories

- Display names come from config (defaults "Ranked · Mechanics" and "Ranked · Level Design"), since the proposal leaves naming open.
- Opening `/beatmaps` shows a two-card chooser first; the choice is remembered for the session and switchable via tabs.
- **Mechanics** listing: plain sorts only (recent, plays, star rating, title). No stars UI. Show a small note that its visibility and rewards are left to that community.
- **Level Design** listing: stars UI and the sorts in 7.3.
- Misclassification is handled by NAT through FlagCase outcome `dq_category` (section 5.4). Show reviewers a reminder: give Mechanics a wide berth, Level Design a narrow one.
- Optional (config, off by default): a separate "Level Design pp" stat on profiles, shown like a secondary rank.

### 7.2 Shooting stars

| Rule | Default |
| --- | --- |
| Base allowance per week | BN 10, NAT 25 |
| Replenish | Each spent star returns 7 days after it was cast (like hype), not on a weekly reset |
| Bonus when a nominated map ranks with 0 DQs | +5 stars to each nominator |
| Bonus when it ranks with exactly 1 DQ | +3 stars |
| Bonus with 2+ DQs | none |
| Bonus lifetime | Usable for 7 days, then expires (interpretation of "for the next week") |
| Eligible targets | Ranked Level Design maps only |
| Excluded targets | Maps the caster mapped, guested or nominated |
| Stars per caster per map | 1 (configurable) |

BN dashboard shows a star wallet: available now, a list of "returns on \<date>" entries, and bonus stars with their expiry.

### 7.3 Sorts and filters (Level Design)

| Sort | Definition |
| --- | --- |
| Best (recent) — **default** | Stars cast in the last 30 days, optionally weighted by decay `0.5^(ageDays / 14)` (toggle, on by default) |
| Best (seasonal) | Stars cast in the current season |
| Best (yearly) | Stars cast in the last 365 days |
| Best (all time) | All stars |
| Recent | Ranked date, newest first |

- Filter chip **"Best of Level Design"**: maps that made the top-quarter monthly pack (section 8.2).
- Other filters: genre, language, FA only, star-rating range, skill tags.
- Each map card shows: star count for the active window, total play time (h), unique downloads, nominators' avatars.

### 7.4 Home page top 5

The home page's popular box is replaced by the top 5 Level Design maps by Best (recent). Each time a map first enters this top 5, its mapper gets a point toward the evolving mapper badge (section 8.4).

## 8. Rewards

Stars cast at a map turn into points for its nominators, packs for the best maps, and badges for top nominators and mappers, all on a quarterly season cycle.

### 8.1 Nominator leaderboards (`/rewards`)

- Every star cast at a Level Design map gives +1 point to each of its nominators (BN or NAT) on the **Main** leaderboard.
- Stars cast at a Featured Artist map also give +1 point on the separate **FA** leaderboard. Default: FA stars count on both leaderboards (interpretation; toggle to FA-only).
- Both leaderboards reset each season. Show a dashed cutoff line at rank 25.
- **Season rollover:** the top 25 (configurable 20–25) on each leaderboard get a season badge (`bn_top_main`, `bn_top_fa`). Max 2 badges per person per season.

### 8.2 Monthly Level Design packs (`/packs`)

- For each calendar month, take the Level Design maps ranked that month. Snapshot their star totals 30 days after month end so late-month maps get a fair window (interpretation; configurable).
- Create two packs: **top half** and **top quarter** by stars. Top-quarter maps get the "Best of Level Design" label and appear under that filter.

### 8.3 Seasonal "Best of Level Design" playlist (`/spotlight`)

- All "Best of Level Design" maps from the season's months form a seasonal playlist, like seasonal spotlights.
- Players who clear every map (simulated via the Play button) by season end get a `best_of_ld` badge for that season. Show a progress bar.

### 8.4 Featured Artist packs and Ranked Play

- Every 30 simulated days, build **FA top half** and **FA top quarter** packs from FA maps ranked in that window, by stars.
- Both are added automatically to a "Ranked Play pool" page listing the current pool.

### 8.5 Evolving mapper badge

- A mapper earns 1 point each time one of their maps first enters the home top 5 (counted once per map).
- Badge tiers at 5, 10, 25, 50, 75, 100, then every 100 (200, 300, 400, 500…).
- Tier 100 also grants the profile title **"Legendary Mapping Master"**.
- Profiles show current tier and progress to the next.

### 8.6 Engagement metrics

- **Play time:** sum of `durationSec` for all Plays on a map, shown in hours on every map page and card.
- **Unique downloads:** count of distinct users who downloaded, shown beside play time.
- Legacy play count stays on the map page but is visually secondary, so retry spam weighs less.

## 9. Pages and screens

Fourteen pages cover every role; the header on every page carries the role switcher, the simulated clock and an activity-feed drawer.

| Page | Route | Main users | Contents |
| --- | --- | --- | --- |
| Home | `/` | All | Level Design top 5 (Best recent), latest ranked in both categories, season countdown, "what changed" explainer cards |
| Beatmap listing | `/beatmaps` | All | Category chooser → status tabs (Ranked, Qualified, Pending, WIP, Graveyard), sorts, filters (section 7) |
| Beatmap page | `/beatmaps/:id` | All | Metadata, difficulties + skill tags, category, status timeline, nominations n/3, verifier results, qualified countdown or frozen banner, flags count, star count + history chart, play time, unique downloads, fake leaderboard, event history, role-aware action bar |
| My maps | `/me/maps` | Mapper | Create map (form with genre, FA toggle, difficulties, skill tags, optional seeded MV issues), WIP → Pending with category picker, progress per map, revive from graveyard |
| BN dashboard | `/bn` | BN, NAT | Allowance meter (x/5 + next accrual), cooldown status, star wallet, my nominations and their outcomes, my flags, pending NAT invite, vouches left |
| BN directory | `/bn/directory` | Mappers | All BNs with open/closed, genres, skillsets, categories, request instructions; filter by these so mappers find a matching BN |
| BN application | `/bn/apply` | Non-BNs | Criteria checklist with live values, vouches received, test, result |
| NAT queue | `/nat` | NAT | Flag cases and override petitions sorted by deadline, overdue in red; review form with flags/reasons, verifier output, outcome buttons, "mark flag abusive"; my outstanding votes |
| Votes | `/votes` | BN, NAT | NAT candidacies (portfolio, separate BN/NAT tallies vs. thresholds), removal votes |
| Rewards | `/rewards` | All | Main and FA nominator leaderboards with cutoff line, past season badge winners |
| Packs | `/packs` | All | Monthly LD packs, FA packs, Ranked Play pool |
| Spotlight | `/spotlight` | Players | Seasonal Best of Level Design playlist with personal progress |
| Profile | `/users/:id` | All | Roles, stats, badges, title, mapper badge progress, maps by status, nominator points, strikes/bans, vouch button |
| Admin | `/admin` | Admin | Clock, config editor (all section 11 values, live), simulate plays/downloads/player reports/star casts, edit user stats, reset seed, full event log with filters |

**Beatmap page action bar** (only actions the current user can take, disabled ones with tooltip):

- Mapper: Edit category (until first nomination), Move to Pending, Revive.
- BN/NAT: Nominate / Sign override, Flag (qualified), Shoot star (ranked LD).
- NAT: Disqualify, Open case review.
- Player: Play (adds a simulated Play with random score and duration), Download, Report (qualified).

**UX details**

- Every blocked action explains itself with the engine's message.
- Toasts confirm actions and link to the new Event.
- Status timeline on map pages shows each nomination, flag, freeze, DQ and rank with simulated timestamps.
- Mobile-friendly layout; tables collapse to cards under 640 px.

## 10. Seed data

Generate a deterministic, fully fictional world (seed `"ranked-lab"`) with about 230 users and 130 mapsets spread across every status, so every rule can be demonstrated immediately on load.

### 10.1 Volumes

| Group | Count | Notes |
| --- | --- | --- |
| Players only | \~150 | Varied play/download history |
| Mappers (non-BN) | \~30 | Some near BN thresholds, some over |
| BNs | \~40 | \~12 legacy; others qualified via favourites, subscribers, plays, ranked maps or vouches |
| NAT | 8 | All legacy; tenure 1–6 years |
| Admin | 1 |  |
| Ranked · Level Design | 40 | Ranked over the past 12 months, star histories |
| Ranked · Mechanics | 25 | Higher plays, no stars |
| Qualified | 10 | Spread across days 1–14; one frozen by 2 BN flags (case 3 days old); one with 87 player reports; one overdue NAT case |
| Pending | 20 | Mix of 0/1/2 nominations; 3 with unrankable MV issues; 1 override petition with 2 signatures; 1 awaiting NAT |
| WIP | 15 |  |
| Graveyard | 10 | Some with high-effort descriptions |

About 15% of maps are Featured Artist. History before the start date (plays, star casts, DQs, past season badges) is generated so leaderboards, packs and sorts are populated from the first screen.

### 10.2 Content rules

- Invented artists and song titles only (generate from word lists, e.g. "Velvet Satellites — Glasshouse Summer"). No real songs, artists or osu! users.
- Genres: Western pop, J-pop, K-pop, electronic, drum and bass, rock, metal, classical, hip hop, game music, video game OST, folk.
- Skill tags: aim, stream, tech, reading, high SV, alt, finger control, low AR, 1/8 sliderstreams, burst, precision.
- MV issue catalogue (fictional): unsnapped object, audio bitrate too high, missing preview point, inconsistent metadata, background too large, overlapping objects in Normal, offset differs across diffs. Mark some unrankable.
- BN directory profiles: random genres/skillsets, 70% open.
- 40 fictional BN test questions with plausible ranking-criteria scenarios.

### 10.3 Demo personas (top of the role switcher)

| Persona | Role | What it demonstrates |
| --- | --- | --- |
| PastelWaltz | Mapper | High-star Western pop Level Design map with 1/8 sliderstreams, Pending with 1 nomination: the "unique map" problem |
| aimgod\_77 | Mapper | Prolific Mechanics mapper; several ranked, one pending |
| LegacyNom | BN (legacy) | Full allowance (5), full star wallet, pending NAT invite to accept |
| FreshBN | BN via favourites | 1 allowance, can vouch, few stars |
| ProblemNom | BN | 3 DQs this week → cooldown level 1, slower accrual shown |
| Arbiter | NAT | NAT queue with 3 items including one overdue |
| AlmostThere | Player/Mapper | 4 ranked maps and 3 vouches: one short of eligibility on two criteria |
| ReportHappy | Player | 2 abuse strikes, chat banned for 24 h |
| Lab Admin | Admin | Clock and config |

## 11. Config parameters and open interpretations

Every value below lives in `src/config/params.ts` and is editable live from `/admin`; "Proposal" means the number comes from the proposal, "Spec" means this spec chose it.

| Key | Default | Origin |
| --- | --- | --- |
| `nominationsRequired` | 3 | Proposal |
| `qualifiedDays` | 15 | Proposal |
| `allowancePerDay` / `allowanceCap` | 1 / 5 | Proposal |
| `natReviewDays` (flags and overrides) | 10 | Proposal |
| `bnFlagsToOpenCase` | 2 | Proposal |
| `playerFlagsToOpenCase` | 100 | Proposal |
| `dqCooldownTriggers` | 5 in 30 days, or 3 in 7 days | Proposal |
| `cooldownAccrualDays` by level | \[1, 2, 3\] | Proposal |
| `cooldownResetDays` | 30 | Proposal |
| `bnCriteria.favourites` | 800 (800–1,000) | Proposal |
| `bnCriteria.subscribers` | 100 (100–200) | Proposal |
| `bnCriteria.plays` | 100,000 (100k–500k) | Proposal |
| `bnCriteria.rankedMaps` / `vouches` | 5 / 5 | Proposal |
| `vouchCooldownDays` | 15 | Proposal |
| `bnTest` questions / pass mark / retry days | 20 / 70% / 7 | Spec |
| `removalThreshold` | 2/3 of NAT | Proposal |
| `natInvite` ratio percentile / activity percentile | top 25% / top 50% | Proposal |
| `natVoteThreshold` | > 50% of BNG or > 50% of NAT | Proposal |
| `natVoteDays` / `removalVoteDays` | 14 / 7 | Spec |
| `stars.weekly` BN / NAT | 10 / 25 | Proposal |
| `stars.replenishDays` | 7 | Proposal |
| `stars.bonus` 0 DQ / 1 DQ | 5 / 3 | Proposal |
| `stars.bonusLifetimeDays` | 7 | Spec |
| `stars.perCasterPerMap` | 1 | Spec |
| `sort.recentWindowDays` / decay half-life | 30 / 14 days, decay on | Proposal / Spec |
| `homeTopN` | 5 | Proposal |
| `leaderboard.badgeCutoff` | 25 (20–25) | Proposal |
| `faStarsCountOnMain` | true | Spec |
| `pack.snapshotDelayDays` | 30 | Spec |
| `mapperBadgeTiers` | 5, 10, 25, 50, 75, 100, then every 100 | Proposal |
| `legendaryTitleTier` | 100 | Proposal |
| `graveyardDays` | 28 | Spec |
| `seasonLengthMonths` | 3 | Proposal |
| `categoryNames` | "Mechanics", "Level Design" | Spec (placeholder) |
| `ldPpStat` | off | Proposal (optional) |

**Interpretations to confirm with the proposal's author**

- [ ] Does an override signature spend a nomination, and does approval start the 15-day clock on the approval date?
- [ ] What happens when NAT miss a 10-day deadline: auto-deny, auto-approve, or stay frozen?
- [ ] Does the qualified clock pause while a flag case is open?
- [ ] Are bonus stars a one-week pool, or permanent additions to next week's allowance?
- [ ] Do FA stars count on the main leaderboard as well as the FA one?
- [ ] Is "50%+1" measured against total membership or votes cast?
- [ ] Can one BN cast more than one star at the same map?
- [ ] How often do NAT invite cycles run?

## 12. Build phases and acceptance tests

Build in seven phases, each ending with a working app and passing tests; do not start a phase until the previous one's checks pass.

| Phase | Scope | Done when |
| --- | --- | --- |
| 1. Foundation | Vite app, config, types, seed generator, store, role switcher, clock widget, read-only listing/map/profile pages | Seeded world browsable as any persona |
| 2. Nomination pipeline | Allowance accrual, nominate, verifier, override petitions, qualified clock, ranking, DQ, cooldowns, graveyard | Phase 2 tests pass |
| 3. Supervision | BN and player flags, flag cases, freeze, NAT queue, outcomes, abuse strikes | Phase 3 tests pass |
| 4. Membership | BN application, criteria, vouching, test, NAT invites, portfolios, votes, removal votes | Phase 4 tests pass |
| 5. Split and visibility | Category chooser, category locking, star wallet, shooting stars, sorts, filters, home top 5 | Phase 5 tests pass |
| 6. Rewards | Leaderboards, season rollover, badges, monthly and FA packs, Ranked Play pool, spotlight playlist, mapper badge, metrics | Phase 6 tests pass |
| 7. Admin and polish | Config editor, crowd simulation, event log, guided demo tour, mobile layout | Full tour runs without errors |

### Acceptance tests (one Vitest test each)

**Phase 2**

- [ ] A BN with 0 allowance cannot nominate; after +1 day they have 1; after 10 idle days they have 5, not 10.
- [ ] A mapper cannot nominate their own map; a BN cannot nominate the same map twice.
- [ ] The third clean nomination makes a map Qualified; +15 days makes it Ranked.
- [ ] Nominating a map with an unrankable MV issue opens an override petition instead; 3 signatures send it to NAT; NAT deny leaves it Pending with signatures voided.
- [ ] A DQ returns the map to Pending, voids nominations and does not refund allowance.
- [ ] 3 DQs within 7 days puts each affected nominator on cooldown level 1 (accrual every 2 days); 30 clean days resets it.

**Phase 3**

- [ ] One BN flag does not open a case; a second distinct BN flag does and freezes the map.
- [ ] 99 player reports do not open a case; the 100th does.
- [ ] A frozen map does not rank even after 15+ days; dismissal resumes the clock where it paused.
- [ ] NAT can DQ for misclassified category, and the map returns to Pending with category unlocked.
- [ ] Marking a player's flag abusive twice applies a 24 h chat ban.

**Phase 4**

- [ ] A user with 800 favourites and a passed test becomes a BN; one with 799 cannot take the test.
- [ ] A BN cannot vouch twice within 15 days.
- [ ] A removal vote with 5 of 8 NAT yes votes passes; 5 of 9 does not.
- [ ] A NAT candidacy passes on a BN majority even if the NAT vote fails.

**Phase 5**

- [ ] Mechanics listing has no star controls; Level Design defaults to Best (recent).
- [ ] A BN cannot star a map they nominated, mapped or guested.
- [ ] A spent star returns exactly 7 days after casting.
- [ ] A clean rank gives each nominator +5 bonus stars that expire after 7 days; a 1-DQ rank gives +3.

**Phase 6**

- [ ] Each star on a nominated LD map adds 1 point to every nominator; FA maps also add to the FA board.
- [ ] Season rollover awards badges to the top 25 on each board and resets both.
- [ ] Monthly pack snapshot produces correct top-half and top-quarter sets and labels the quarter "Best of Level Design".
- [ ] A map entering the home top 5 for the first time gives its mapper 1 badge point; re-entering gives none.
- [ ] Unique downloads do not increase when the same user downloads twice.

### Guided demo tour (phase 7)

A dismissible tour that walks through: PastelWaltz's pending map → switch to LegacyNom and nominate → switch to FreshBN and nominate → third nomination by Arbiter → fast-forward 15 days → map ranks → stars cast → leaderboard and home top 5 update.
