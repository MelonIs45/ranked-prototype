import { produce, setAutoFreeze, type Draft } from 'immer';
import type { ActionResult, Event, EventType, Id, Ms, State } from './types';

setAutoFreeze(false);

export class RuleError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = 'RuleError';
  }
}

/** Result of a precondition check: shared by the engine (throws) and the UI (disables + tooltip). */
export type Check = { ok: true } | { ok: false; error: RuleError };

export const OK: Check = { ok: true };
export const fail = (code: string, message: string): Check => ({ ok: false, error: new RuleError(code, message) });

export function assertCheck(c: Check): void {
  if (!c.ok) throw c.error;
}

/** Mutable context passed to internal mutators while an action or tick runs. */
export interface Ctx {
  s: Draft<State>;
  now: Ms;
  events: Event[];
}

export function nextId(ctx: Ctx, prefix: string): Id {
  ctx.s.seq += 1;
  return `${prefix}${ctx.s.seq}`;
}

export function emit(
  ctx: Ctx,
  type: EventType,
  message: string,
  extra: { actorId?: Id | null; mapId?: Id; targetUserId?: Id; at?: Ms } = {},
): Event {
  const ev: Event = {
    id: nextId(ctx, 'e'),
    at: extra.at ?? ctx.now,
    actorId: extra.actorId ?? null,
    type,
    message,
  };
  if (extra.mapId) ev.mapId = extra.mapId;
  if (extra.targetUserId) ev.targetUserId = extra.targetUserId;
  ctx.s.events.push(ev);
  const cap = ctx.s.params.maxEvents;
  if (ctx.s.events.length > cap) ctx.s.events.splice(0, ctx.s.events.length - cap);
  ctx.events.push(ev);
  return ev;
}

/** Run a mutator against a draft of `state` and return the new state plus the events it wrote. */
export function run(state: State, now: Ms, fn: (ctx: Ctx) => void): ActionResult {
  const events: Event[] = [];
  const next = produce(state, (draft) => {
    fn({ s: draft, now, events });
  });
  return { state: next, events };
}

export function values<T>(rec: Record<string, T>): T[] {
  return Object.values(rec);
}
