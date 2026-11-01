import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { Beatmapset, Category, Check, Id, MapStatus, State, User } from '../engine';
import { categoryName, rolesOf } from '../engine';
import { useLab, useLabState } from '../store';

export function cx(...xs: (string | false | null | undefined)[]) {
  return xs.filter(Boolean).join(' ');
}

export function Avatar({ user, size = 24 }: { user: User | undefined; size?: number }) {
  if (!user) return null;
  return (
    <span
      className="inline-flex shrink-0 select-none items-center justify-center rounded font-extrabold text-ink-950"
      style={{ width: size, height: size, background: user.avatarColor, fontSize: size * 0.42 }}
      title={user.username}
      aria-hidden
    >
      {user.username.replace(/[^a-z0-9]/gi, '').slice(0, 2).toUpperCase() || '?'}
    </span>
  );
}

export function UserLink({ id, avatar = true, className }: { id: Id; avatar?: boolean; className?: string }) {
  const s = useLabState();
  const u = s.users[id];
  if (!u) return <span className="muted">unknown</span>;
  return (
    <Link to={`/users/${u.id}`} className={cx('inline-flex items-center gap-1.5 font-medium text-slate-100 hover:text-lab-rose', className)}>
      {avatar && <Avatar user={u} size={20} />}
      <span className="truncate">{u.username}</span>
    </Link>
  );
}

export function AvatarStack({ ids, max = 5, link = true }: { ids: Id[]; max?: number; link?: boolean }) {
  const s = useLabState();
  if (!ids.length) return <span className="text-xs muted">none</span>;
  return (
    <span className="inline-flex -space-x-1.5">
      {ids.slice(0, max).map((id) =>
        link ? (
          <Link key={id} to={`/users/${id}`} className="rounded-full ring-2 ring-ink-900">
            <Avatar user={s.users[id]} size={22} />
          </Link>
        ) : (
          <span key={id} className="rounded-full ring-2 ring-ink-900">
            <Avatar user={s.users[id]} size={22} />
          </span>
        ),
      )}
      {ids.length > max && <span className="ml-2 text-xs muted">+{ids.length - max}</span>}
    </span>
  );
}

export function StatusBadge({ status, frozen }: { status: MapStatus; frozen?: boolean }) {
  return (
    <span className={cx('beatmapset-status', `beatmapset-status--${status}`)}>
      {status === 'wip' ? 'WIP' : status}
      {frozen && <span title="Frozen by an open NAT case">&nbsp;· frozen</span>}
    </span>
  );
}

export function CategoryBadge({ category }: { category: Category | null }) {
  const s = useLabState();
  if (!category) return <span className="chip">No category</span>;
  return (
    <span className="beatmapset-status shrink-0 whitespace-nowrap" style={{ background: `hsl(var(--hsl-${category === 'level_design' ? 'purple' : 'blue'}-1))` }}>
      {categoryName(s.params, category)}
    </span>
  );
}

export function RoleBadges({ user, compact }: { user: User; compact?: boolean }) {
  const roles = rolesOf(user).filter((r) => !compact || r !== 'Legacy');
  return (
    <span className={cx('inline-flex gap-1', compact ? 'flex-nowrap' : 'flex-wrap')}>
      {roles.map((r) => (
        <span
          key={r}
          className={cx(
            'rounded px-1.5 py-px text-[10px] font-bold uppercase tracking-wider',
            r === 'NAT' && 'bg-lab-red/20 text-lab-red',
            r === 'BN' && 'bg-lab-violet/25 text-lab-violet',
            r === 'Admin' && 'bg-lab-pink/25 text-lab-pink',
            r === 'Legacy' && 'bg-ink-700 text-slate-400',
          )}
        >
          {r}
        </span>
      ))}
    </span>
  );
}

export function Card({ children, className, title, action }: { children: ReactNode; className?: string; title?: ReactNode; action?: ReactNode }) {
  return (
    <section className={cx('card', className)}>
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          {title && <h2 className="h2">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, sub, className }: { label: ReactNode; value: ReactNode; sub?: ReactNode; className?: string }) {
  return (
    <div className={cx('rounded-lg bg-ink-850 px-3 py-2', className)}>
      <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-lg font-semibold text-white">{value}</div>
      {sub && <div className="text-xs muted">{sub}</div>}
    </div>
  );
}

export function Meter({ value, max, color = 'bg-lab-pink', className }: { value: number; max: number; color?: string; className?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className={cx('h-2 w-full overflow-hidden rounded-full bg-ink-700', className)}>
      <div className={cx('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
    </div>
  );
}

/**
 * A button guarded by an engine check. When the check fails the button is disabled and
 * shows the engine's message as a tooltip; tapping it (e.g. on touch) shows the message as a toast.
 */
export function ActionButton({
  check,
  onClick,
  children,
  variant = 'primary',
  className,
}: {
  check: Check;
  onClick: () => void;
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  className?: string;
}) {
  const toast = useLab((st) => st.toast);
  const blocked = !check.ok ? check.error.message : null;
  return (
    <span className="group relative inline-flex" onClick={() => blocked && toast('error', blocked)}>
      <button type="button" className={cx(`btn-${variant}`, className)} disabled={!!blocked} onClick={onClick} aria-describedby={blocked ? undefined : undefined}>
        {children}
      </button>
      {blocked && (
        <span role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 hidden w-60 -translate-x-1/2 rounded-lg border border-ink-600 bg-ink-800 px-3 py-2 text-xs text-slate-200 group-hover:block">
          {blocked}
        </span>
      )}
    </span>
  );
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    ref.current?.querySelector<HTMLElement>('textarea, input, select, button')?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4" onMouseDown={onClose}>
      <div
        ref={ref}
        role="dialog"
        aria-modal
        className={cx('max-h-[92vh] w-full overflow-y-auto border border-ink-600 bg-ink-900 p-5', wide ? 'sm:max-w-2xl' : 'sm:max-w-lg')}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="h2">{title}</h2>
          <button className="btn-ghost -mr-2 -mt-1 px-2" onClick={onClose} aria-label="Close">
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Tabs<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode; count?: number }[] }) {
  return (
    <div className="flex gap-1 overflow-x-auto rounded-lg bg-ink-850 p-1" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={o.value === value}
          onClick={() => onChange(o.value)}
          className={cx(
            'whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            o.value === value ? 'bg-ink-700 text-white' : 'text-slate-400 hover:text-slate-200',
          )}
        >
          {o.label}
          {o.count !== undefined && <span className="ml-1.5 text-xs text-slate-500">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

/** Generated cover: one flat, muted tone per map plus its id in small mono type. */

export function MapCover({ map, className }: { map: Beatmapset; className?: string }) {
  let h = 0;
  for (const c of map.id + map.title) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return (
    <div className={cx('relative overflow-hidden', className)} style={{ background: `linear-gradient(135deg, hsl(${h % 360} 45% 38%), hsl(${(h + 50) % 360} 40% 22%))` }} aria-hidden>
      <span className="absolute bottom-1.5 right-2 font-mono text-[10px] uppercase tracking-widest text-white/40">#{map.id.replace(/^m/, '')}</span>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-dashed border-ink-600 p-6 text-center text-sm muted">{children}</div>;
}

export function Field({ label, children, hint }: { label: ReactNode; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs muted">{hint}</span>}
    </label>
  );
}

export function useToggle(initial = false) {
  const [v, setV] = useState(initial);
  return [v, () => setV((x) => !x), setV] as const;
}

export function fmtNum(n: number, digits = 0) {
  return n.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

export function fmtCompact(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(Math.round(n));
}

export function mapTitle(m: Beatmapset) {
  return `${m.title} (${m.artist})`;
}

export function MapLink({ map, className }: { map: Beatmapset | undefined; className?: string }) {
  if (!map) return <span className="muted">deleted map</span>;
  return (
    <Link to={`/beatmaps/${map.id}`} className={cx('font-medium text-slate-100 hover:text-lab-rose', className)}>
      {map.title} <span className="font-normal text-slate-400">· {map.artist}</span>
    </Link>
  );
}

export function useMeUser(): User {
  const s = useLabState();
  return s.users[s.currentUserId] ?? Object.values(s.users)[0];
}

export function stateOf(): State {
  return useLab.getState().state;
}
