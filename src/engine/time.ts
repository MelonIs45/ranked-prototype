import type { Params } from '../config/params';
import type { Ms, Season } from './types';

export const HOUR = 3_600_000;
export const DAY = 24 * HOUR;
export const START_TIME: Ms = Date.UTC(2026, 10, 1, 12, 0, 0);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function monthKey(t: Ms): string {
  const d = new Date(t);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

export function monthStart(key: string): Ms {
  const [y, m] = key.split('-').map(Number);
  return Date.UTC(y, m - 1, 1);
}

export function monthEnd(key: string): Ms {
  const [y, m] = key.split('-').map(Number);
  return Date.UTC(y, m, 1);
}

export function addMonths(t: Ms, n: number): Ms {
  const d = new Date(t);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1);
}

/** Seasons are aligned to calendar months: with length 3, Jan–Mar is S1, Apr–Jun S2, and so on. */
export function seasonFor(t: Ms, params: Params): Season {
  const len = Math.max(1, Math.round(params.seasonLengthMonths));
  const d = new Date(t);
  const y = d.getUTCFullYear();
  const idx = Math.floor(d.getUTCMonth() / len);
  const startsAt = Date.UTC(y, idx * len, 1);
  const endsAt = Date.UTC(y, idx * len + len, 1);
  const perYear = Math.ceil(12 / len);
  const label = perYear === 4 ? `${y} Q${idx + 1}` : `${y} Season ${idx + 1}`;
  return { id: `${y}-S${idx + 1}`, label, startsAt, endsAt };
}

export function previousSeason(t: Ms, params: Params): Season {
  return seasonFor(seasonFor(t, params).startsAt - 1, params);
}

export function fmtDate(t: Ms): string {
  const d = new Date(t);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

export function fmtDateTime(t: Ms): string {
  const d = new Date(t);
  return `${fmtDate(t)} ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')} UTC`;
}

/** "14 h", "3 d 4 h", "25 min" */
export function fmtDuration(ms: Ms): string {
  if (ms <= 0) return 'now';
  const days = Math.floor(ms / DAY);
  const hours = Math.floor((ms % DAY) / HOUR);
  const mins = Math.ceil((ms % HOUR) / 60_000);
  if (days > 0) return hours > 0 ? `${days} d ${hours} h` : `${days} d`;
  if (hours > 0) return mins >= 60 ? `${hours + 1} h` : `${hours} h${mins > 0 && hours < 3 ? ` ${mins} min` : ''}`;
  return `${mins} min`;
}

export function fmtRelative(t: Ms, now: Ms): string {
  const diff = now - t;
  if (Math.abs(diff) < 60_000) return 'just now';
  return diff > 0 ? `${fmtDuration(diff)} ago` : `in ${fmtDuration(-diff)}`;
}
