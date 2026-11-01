# Ranked Lab

Clickable prototype of the ranked-section reform described in `Ranked Section Reform — Prototype Build Spec.md`. It runs entirely in the browser and keeps its world in localStorage, so it deploys as static files. Unofficial concept prototype: every user, song and artist is fictional.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # Vitest: engine acceptance tests
npm run build      # typecheck + static build in dist/
```

The router uses hash URLs (`/#/beatmaps`), so `dist/` works from any static host or sub-path.

## Layout

| Path | What |
| --- | --- |
| `src/config/params.ts` | Every tunable number plus the interpretation toggles (`interp.*`). Editable live from `/admin`. |
| `src/engine/` | Pure rules engine, no React. Actions are `action(state, actorId, args, now) → { state, events }` or throw `RuleError`. Each action has a matching `canX()` check that the UI reuses for disabled buttons and tooltips. |
| `src/engine/tick.ts` | Simulated clock. Processes jobs one day at a time: qualified clocks, allowance accrual, cooldowns, star returns, bonus expiry, NAT deadlines, votes, graveyard, monthly and FA packs, season rollover, NAT invite cycles and home top-5 entries. |
| `src/data/seed.ts` | Deterministic world (seed `ranked-lab`): 229 users, 130 maps and a replayed year of packs and badges. |
| `src/store/` | Zustand store wrapping engine calls, persisted to localStorage. |
| `src/tour/steps.ts` | Guided demo tour, also run as a test. |
| `tests/` | One Vitest test per acceptance check in spec section 12, plus seed, tour and performance checks. |

## Decisions where the spec was open or inconsistent

- **Removal vote rounding.** "≥ 2/3 of NAT" makes 5 of 8 fail (5/8 = 62.5%), but the acceptance test says 5 of 8 passes and 5 of 9 fails. The threshold is therefore `floor(2/3 × NAT)` (config `removalRounding`, which can also be `ceil`, `round` or `exact`).
- **Tour order.** PastelWaltz's map starts with 1 nomination, so LegacyNom and FreshBN bring it to 3/3 and Arbiter cannot add a "third". In the tour, Arbiter's step is NAT supervision and a star cast instead.
- **AlmostThere.** Seeded with 4 ranked maps and 4 vouches (the spec says 3 vouches), so they really are one short on two criteria.
- **Founding NAT invites.** Accepting a founding invite (legacy BNs) joins NAT directly. Invites from later cycles go through the portfolio and vote.
- **Bonus stars** are spent before weekly stars and don't return. Weekly stars return 7 days after each cast.
- **Clock buttons** work for every persona, not only Admin, so the tour can fast-forward without switching personas.
- **Pack snapshot date** is month end + 30 days (October's pack lands Dec 1).
- Each interpretation in spec section 11 is a toggle under `interp` in the config editor, set to the spec's default. The spec's author confirmed all of these defaults on Nov 1, 2026.
