// Zustand store: wraps engine calls, persists state to localStorage, and surfaces toasts.
import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import { createSeed, emptyState, SEED_VERSION } from '../data/seed';
import { RuleError, tick, type Action, type Event, type Id, type Ms, type State } from '../engine';

export interface Toast {
  id: number;
  kind: 'success' | 'error' | 'info';
  message: string;
  eventId?: Id;
}

interface LabStore {
  state: State;
  toasts: Toast[];
  drawerOpen: boolean;
  highlightEventId: Id | null;
  tour: { active: boolean; step: number; dismissed: boolean };
  dispatch: <A>(fn: Action<A>, args: A, opts?: { as?: Id; success?: string; quiet?: boolean }) => Event[] | null;
  advance: (ms: Ms) => void;
  advanceTo: (t: Ms) => void;
  setUser: (id: Id) => void;
  reset: () => void;
  toast: (kind: Toast['kind'], message: string, eventId?: Id) => void;
  dismissToast: (id: number) => void;
  openDrawer: (eventId?: Id | null) => void;
  closeDrawer: () => void;
  setTour: (t: Partial<LabStore['tour']>) => void;
}

let toastSeq = 0;
const STORE_KEY = 'ranked-lab';

/** Skip building a seed at startup when a saved world is about to be rehydrated. */
function initialState(): State {
  try {
    if (localStorage.getItem(STORE_KEY)) return emptyState();
  } catch {
    /* storage blocked */
  }
  return createSeed();
}

/** localStorage can throw (private mode, quota); the app keeps working in memory. */
const safeStorage: StateStorage = {
  getItem: (k) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  setItem: (k, v) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* quota or blocked: ignore */
    }
  },
  removeItem: (k) => {
    try {
      localStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  },
};

export const useLab = create<LabStore>()(
  persist(
    (set, get) => ({
      state: initialState(),
      toasts: [],
      drawerOpen: false,
      highlightEventId: null,
      tour: { active: false, step: 0, dismissed: false },

      dispatch: (fn, args, opts = {}) => {
        const s = get().state;
        const actor = opts.as ?? s.currentUserId;
        try {
          const res = fn(s, actor, args, s.now);
          set({ state: res.state });
          const last = res.events[res.events.length - 1];
          if (!opts.quiet) get().toast('success', opts.success ?? last?.message ?? 'Done.', last?.id);
          return res.events;
        } catch (e) {
          if (e instanceof RuleError) {
            get().toast('error', e.message);
            return null;
          }
          console.error(e);
          get().toast('error', `Unexpected error: ${(e as Error).message}`);
          return null;
        }
      },

      advance: (ms) => get().advanceTo(get().state.now + ms),

      advanceTo: (t) => {
        const s = get().state;
        if (t <= s.now) return;
        const res = tick(s, s.now, t, s.currentUserId);
        set({ state: res.state });
        const notable = res.events.filter((e) => !['clock', 'allowance', 'star_returned'].includes(e.type)).length;
        get().toast('info', `Advanced ${Math.round(((t - s.now) / 3_600_000) * 10) / 10} h: ${res.events.length} events (${notable} notable).`, res.events[0]?.id);
      },

      setUser: (id) => set((st) => ({ state: { ...st.state, currentUserId: id } })),

      reset: () => {
        set({ state: createSeed(), toasts: [], highlightEventId: null, tour: { active: false, step: 0, dismissed: false } });
        get().toast('info', 'World reset to the seed.');
      },

      toast: (kind, message, eventId) => {
        const id = ++toastSeq;
        set((st) => ({ toasts: [...st.toasts.slice(-3), { id, kind, message, eventId }] }));
        setTimeout(() => get().dismissToast(id), kind === 'error' ? 7000 : 4500);
      },
      dismissToast: (id) => set((st) => ({ toasts: st.toasts.filter((t) => t.id !== id) })),
      openDrawer: (eventId = null) => set({ drawerOpen: true, highlightEventId: eventId }),
      closeDrawer: () => set({ drawerOpen: false, highlightEventId: null }),
      setTour: (t) => set((st) => ({ tour: { ...st.tour, ...t } })),
    }),
    {
      name: STORE_KEY,
      version: SEED_VERSION,
      storage: createJSONStorage(() => safeStorage),
      partialize: (st) => ({ state: st.state, tour: st.tour }),
      migrate: () => ({ state: createSeed(), tour: { active: false, step: 0, dismissed: false } }) as unknown as LabStore,
      onRehydrateStorage: () => (st) => {
        if (st && Object.keys(st.state.users).length === 0) useLab.setState({ state: createSeed() });
      },
    },
  ),
);

export const useLabState = () => useLab((st) => st.state);

export function useMe() {
  const s = useLabState();
  return s.users[s.currentUserId] ?? Object.values(s.users)[0];
}
