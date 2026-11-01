// Guided demo tour (spec phase 7). Steps are plain functions over a small API so the
// same script runs in the UI (via the store) and in a Vitest test.
import { castStar, homeTop, mapperPoints, nominate, simulateStarCasts, type Action, type Id, type State, DAY } from '../engine';

export interface TourApi {
  state: () => State;
  dispatch: <A>(fn: Action<A>, args: A, as?: Id) => boolean;
  advance: (ms: number) => void;
  setUser: (id: Id) => void;
}

export interface TourStep {
  title: string;
  body: (s: State) => string;
  route: (s: State) => string;
  /** Label for the "do it for me" button. */
  doLabel?: string;
  run?: (api: TourApi) => void;
}

const byName = (s: State, name: string) => Object.values(s.users).find((u) => u.username === name)!;

export function tourMapId(s: State): Id {
  const pastel = byName(s, 'PastelWaltz');
  return Object.values(s.maps).find((m) => m.mapperId === pastel.id && m.title === 'Glasshouse Summer')!.id;
}

export const TOUR: TourStep[] = [
  {
    title: "PastelWaltz's unique map",
    body: () =>
      'Glasshouse Summer is a Western pop Level Design map with a 7.2-star difficulty built on 1/8 sliderstreams: the kind of "unique map" that struggles to find nominators. It is Pending with 1 of 3 nominations.',
    route: (s) => `/beatmaps/${tourMapId(s)}`,
    doLabel: 'Switch to PastelWaltz',
    run: (api) => api.setUser(byName(api.state(), 'PastelWaltz').id),
  },
  {
    title: 'LegacyNom nominates',
    body: () => 'LegacyNom is a legacy BN with a full allowance of 5. Nominating spends one; the Mapset Verifier only finds a minor issue, so it does not block.',
    route: (s) => `/beatmaps/${tourMapId(s)}`,
    doLabel: 'Switch to LegacyNom and nominate',
    run: (api) => {
      const s = api.state();
      const u = byName(s, 'LegacyNom');
      api.setUser(u.id);
      api.dispatch(nominate, { mapId: tourMapId(s) }, u.id);
    },
  },
  {
    title: 'FreshBN adds the third nomination',
    body: () =>
      'FreshBN qualified through profile favourites three days ago and has exactly 1 nomination available. Using it brings the map to 3/3: it becomes Qualified and the 15-day clock starts.',
    route: (s) => `/beatmaps/${tourMapId(s)}`,
    doLabel: 'Switch to FreshBN and nominate',
    run: (api) => {
      const s = api.state();
      const u = byName(s, 'FreshBN');
      api.setUser(u.id);
      api.dispatch(nominate, { mapId: tourMapId(s) }, u.id);
    },
  },
  {
    title: 'Arbiter supervises',
    body: () =>
      'Arbiter is NAT. Qualified maps sit under NAT supervision: two BN flags or 100 player reports would open a case and freeze the clock. Arbiter can also disqualify directly. Nothing is wrong here, so the map keeps counting down.',
    route: () => '/nat',
    doLabel: 'Switch to Arbiter',
    run: (api) => api.setUser(byName(api.state(), 'Arbiter').id),
  },
  {
    title: 'Fast-forward 15 days',
    body: () => 'The clock widget processes every scheduled job one simulated day at a time. After 15 qualified days the map ranks, and its nominators each get +5 bonus stars for a clean (0 DQ) rank.',
    route: (s) => `/beatmaps/${tourMapId(s)}`,
    doLabel: 'Advance 15 days',
    run: (api) => api.advance(15 * DAY),
  },
  {
    title: 'Stars are cast',
    body: () =>
      'Arbiter (not a nominator) shoots a star from their weekly NAT allowance of 25. Nominators cannot star their own nominations. The crowd simulator then has other eligible BNs and NAT cast 20 more.',
    route: (s) => `/beatmaps/${tourMapId(s)}`,
    doLabel: 'Cast stars',
    run: (api) => {
      const s = api.state();
      const mapId = tourMapId(s);
      const arbiter = byName(s, 'Arbiter');
      api.dispatch(castStar, { mapId }, arbiter.id);
      api.dispatch(simulateStarCasts, { mapId, count: 20 }, byName(api.state(), 'Lab Admin').id);
    },
  },
  {
    title: 'Nominator leaderboard',
    body: () => 'Every star cast at a Level Design map gives +1 point to each of its nominators. LegacyNom and FreshBN now have points from Glasshouse Summer on the season leaderboard.',
    route: () => '/rewards',
  },
  {
    title: 'Home top 5',
    body: (s) => {
      const inTop = homeTop(s).some((m) => m.id === tourMapId(s));
      return inTop
        ? `Glasshouse Summer is in the home top 5 by Best (recent). Entering it for the first time earned PastelWaltz a mapper badge point (now ${mapperPoints(s, byName(s, 'PastelWaltz').id)}).`
        : 'The home top 5 lists Level Design maps by Best (recent). Cast more stars at Glasshouse Summer to push it in and earn PastelWaltz a mapper badge point.';
    },
    route: () => '/',
  },
];
