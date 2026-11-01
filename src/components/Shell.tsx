import { useMemo, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { SECTIONS, sectionForPath, titleForPath, visiblePages } from './sections';
import { DAY, HOUR, fmtDateTime, fmtDuration, fmtRelative, primaryRole, seasonFor, type EventType, type User } from '../engine';
import { useLab, useLabState } from '../store';
import { TOUR, type TourApi } from '../tour/steps';
import { Avatar, cx, RoleBadges, useMeUser } from './ui';

// ---------------------------------------------------------------------------
// Clock

export function ClockWidget({ compact }: { compact?: boolean }) {
  const s = useLabState();
  const advance = useLab((st) => st.advance);
  const advanceTo = useLab((st) => st.advanceTo);
  const season = seasonFor(s.now, s.params);
  const steps: [string, number][] = [
    ['+1h', HOUR],
    ['+1d', DAY],
    ['+7d', 7 * DAY],
    ['+30d', 30 * DAY],
  ];
  return (
    <div className={cx('flex flex-wrap items-center gap-1.5', compact && 'text-xs')}>
      <div className="mr-1 leading-tight">
        <div className="font-mono text-sm text-white" data-testid="clock">
          {fmtDateTime(s.now)}
        </div>
        <div className="text-[11px] muted">
          {season.label} · ends in {fmtDuration(season.endsAt - s.now)}
        </div>
      </div>
      {steps.map(([label, ms]) => (
        <button key={label} className="btn-secondary px-2 py-1 text-xs" onClick={() => advance(ms)} title={`Advance the simulated clock ${label.slice(1)}`}>
          {label}
        </button>
      ))}
      <button className="btn-secondary px-2 py-1 text-xs" onClick={() => advanceTo(season.endsAt)} title="Advance to the season rollover">
        End of season
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Role switcher

function groupOf(s: ReturnType<typeof useLabState>, u: User): string {
  const r = primaryRole(s, u);
  return { admin: 'Admin', nat: 'NAT', bn: 'BNs', mapper: 'Mappers', player: 'Players' }[r];
}

export function RoleSwitcher() {
  const s = useLabState();
  const me = useMeUser();
  const setUser = useLab((st) => st.setUser);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const groups = useMemo(() => {
    const out: Record<string, User[]> = { NAT: [], BNs: [], Mappers: [], Players: [], Admin: [] };
    for (const u of Object.values(s.users)) {
      if (u.isCrowd) continue;
      if (q && !u.username.toLowerCase().includes(q.toLowerCase())) continue;
      out[groupOf(s, u)].push(u);
    }
    for (const k of Object.keys(out)) out[k].sort((a, b) => a.username.localeCompare(b.username));
    return out;
  }, [s.users, s.maps, q]); // eslint-disable-line react-hooks/exhaustive-deps
  const pick = (id: string) => {
    setUser(id);
    setOpen(false);
    setQ('');
  };
  return (
    <div className="relative">
      <button className="btn-secondary max-w-[220px] gap-2 py-1" onClick={() => setOpen((x) => !x)} aria-expanded={open} aria-haspopup="listbox">
        <Avatar user={me} size={22} />
        <span className="truncate">{me.username}</span>
        <span className="hidden sm:inline-flex">
          <RoleBadges user={me} compact />
        </span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-2 w-[min(92vw,360px)] rounded-xl border border-ink-600 bg-ink-900 p-2">
            <input autoFocus className="input mb-2" placeholder="Search users…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search users" />
            <div className="max-h-[60vh] overflow-y-auto pr-1">
              {!q && (
                <div className="mb-2">
                  <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-lab-pink">Demo personas</div>
                  {s.personas.map((p) => (
                    <button key={p.userId} onClick={() => pick(p.userId)} className={cx('flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-ink-800', p.userId === me.id && 'bg-ink-800')}>
                      <Avatar user={s.users[p.userId]} size={24} />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-white">
                          {s.users[p.userId]?.username} <span className="text-xs font-normal muted">· {p.role}</span>
                        </span>
                        <span className="block text-xs muted">{p.demonstrates}</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {Object.entries(groups).map(([g, us]) =>
                us.length ? (
                  <div key={g} className="mb-2">
                    <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      {g} <span className="font-normal">({us.length})</span>
                    </div>
                    {us.slice(0, q ? 50 : 12).map((u) => (
                      <button key={u.id} onClick={() => pick(u.id)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-sm hover:bg-ink-800">
                        <Avatar user={u} size={20} />
                        <span className="truncate">{u.username}</span>
                      </button>
                    ))}
                    {!q && us.length > 12 && <div className="px-2 text-xs muted">…search to find {us.length - 12} more</div>}
                  </div>
                ) : null,
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Navigation (osu-web nav2) and section header (osu-web header-v4)

export function Header() {
  const me = useMeUser();
  const { pathname } = useLocation();
  const openDrawer = useLab((st) => st.openDrawer);
  const setTour = useLab((st) => st.setTour);
  const [menu, setMenu] = useState(false);
  const current = sectionForPath(pathname);
  const sections = SECTIONS.filter((x) => !x.show || x.show(me)).map((x) => ({ ...x, first: visiblePages(x, me)[0] })).filter((x) => x.first);
  return (
    <header className="relative z-40">
      <div className="relative bg-ink-900">
        {/* nav2-header__triangles: the red strip is hue-rotated to the section colour. */}
        <div
          className="pointer-events-none absolute inset-0 bg-bottom bg-repeat-x opacity-40"
          style={{ backgroundImage: 'url(./osu-web/layout/nav2-background-hue0.png)', filter: 'hue-rotate(var(--base-hue-deg)) saturate(0.6)' }}
          aria-hidden
        />
        <div className="relative mx-auto flex h-[70px] max-w-[1000px] items-center gap-4 px-4">
          <button className="btn-ghost px-2 lg:hidden" onClick={() => setMenu((x) => !x)} aria-label="Menu">
            Menu
          </button>
          <Link to="/" className="flex items-center gap-2 text-white hover:text-white" aria-label="Ranked Lab home">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-lab-pink text-base font-extrabold text-ink-950">RL</span>
          </Link>
          <nav className="hidden flex-1 items-center gap-5 lg:flex">
            {sections.map((x) => (
              <Link key={x.id} to={x.first.to} className={cx('relative py-2 text-[15px] lowercase', x.id === current.id ? 'text-white' : 'text-slate-200 hover:text-white')}>
                {x.label}
                {x.id === current.id && <span className="absolute inset-x-0 -bottom-0.5 h-[3px] rounded-full" style={{ background: `hsl(${x.menuColour})` }} />}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <button className="btn-ghost px-2" onClick={() => setTour({ active: true, dismissed: false })} title="Guided demo tour">
              tour
            </button>
            <button className="btn-ghost px-2" onClick={() => openDrawer()} title="Activity feed">
              activity
            </button>
            <RoleSwitcher />
          </div>
        </div>
      </div>
      <div className="bg-ink-950">
        <div className="mx-auto max-w-[1000px] px-4 py-1.5">
          <ClockWidget />
        </div>
      </div>
      {menu && (
        <nav className="grid grid-cols-2 gap-1 bg-ink-900 p-3 shadow-lg lg:hidden" onClick={() => setMenu(false)}>
          {sections.flatMap((x) =>
            visiblePages(x, me).map((p) => (
              <NavLink key={p.to} to={p.to} end className={({ isActive }) => cx('rounded px-3 py-2 text-sm', isActive ? 'bg-ink-800 text-white' : 'text-slate-300')}>
                <span className="text-xs lowercase muted">{x.label} · </span>
                {p.label}
              </NavLink>
            )),
          )}
        </nav>
      )}
    </header>
  );
}

export function PageHeader() {
  const me = useMeUser();
  const { pathname } = useLocation();
  const section = sectionForPath(pathname);
  const tabs = visiblePages(section, me);
  return (
    <div className="shadow">
      <div className="relative overflow-hidden" style={{ background: 'hsl(var(--hsl-d5))' }}>
        {/* header-v4__bg: artwork at 70% opacity, faded into the band at both edges. */}
        <div className="absolute inset-y-0 left-1/2 w-full max-w-[1200px] -translate-x-1/2 bg-cover bg-center opacity-70" style={{ backgroundImage: `url(./osu-web/headers/${section.image})` }} aria-hidden>
          <div className="h-full w-full" style={{ background: 'linear-gradient(to right, hsl(var(--hsl-d5)), transparent 200px, transparent calc(100% - 200px), hsl(var(--hsl-d5)))' }} />
        </div>
        <div className="relative mx-auto flex h-[90px] max-w-[1000px] items-end px-4 pb-4">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-full border-2 text-sm font-extrabold lowercase text-white" style={{ borderColor: 'hsl(var(--hsl-h1))' }} aria-hidden>
              {section.label[0]}
            </span>
            <h1 className="text-[24px] font-normal lowercase text-white">{titleForPath(pathname, section)}</h1>
          </div>
        </div>
      </div>
      <div className="bg-ink-850">
        <nav className="mx-auto flex max-w-[1000px] gap-5 overflow-x-auto px-4">
          {tabs.map((t) => (
            <NavLink key={t.to} to={t.to} end className={({ isActive }) => cx('relative whitespace-nowrap py-2.5 text-sm', isActive ? 'font-bold text-white' : 'text-slate-300 hover:text-white')}>
              {({ isActive }) => (
                <>
                  {t.label}
                  {isActive && <span className="absolute inset-x-0 bottom-0 h-[3px] rounded-full bg-lab-pink" />}
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Activity feed drawer

const TYPE_GROUPS: Record<string, EventType[]> = {
  Pipeline: ['nominated', 'qualified', 'ranked', 'override_signed', 'override_submitted', 'override_approved', 'override_denied', 'override_expired', 'disqualified', 'map_pending', 'map_created', 'map_category', 'map_revived', 'map_graveyarded'],
  Supervision: ['flag_bn', 'flag_player', 'case_opened', 'case_dismissed', 'case_overdue', 'flag_abusive', 'strike'],
  Stars: ['star_cast', 'star_returned', 'bonus_granted', 'bonus_expired', 'home_top'],
  Membership: ['vouch', 'bn_test', 'bn_joined', 'bn_removed', 'nat_invite', 'nat_invite_response', 'nat_candidacy', 'nat_vote', 'nat_joined', 'removal_opened', 'removal_vote', 'removal_closed', 'profile'],
  Rewards: ['pack_created', 'season_rollover', 'badge'],
  System: ['clock', 'allowance', 'cooldown', 'admin', 'play', 'download'],
};

export function EventList({ events, highlight, limit = 200 }: { events: ReturnType<typeof useLabState>['events']; highlight?: string | null; limit?: number }) {
  const s = useLabState();
  const shown = events.slice(-limit).reverse();
  if (!shown.length) return <div className="text-sm muted">No events yet.</div>;
  return (
    <ol className="space-y-1.5">
      {shown.map((e) => (
        <li key={e.id} id={`ev-${e.id}`} className={cx('rounded-lg px-2.5 py-1.5 text-sm', e.id === highlight ? 'bg-lab-pink/15 ring-1 ring-lab-pink/50' : 'bg-ink-850')}>
          <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
            <span className="uppercase tracking-wide">{e.type.replace(/_/g, ' ')}</span>
            <span title={fmtDateTime(e.at)}>{fmtRelative(e.at, s.now)}</span>
          </div>
          <div className="text-slate-200">
            {e.mapId ? (
              <Link to={`/beatmaps/${e.mapId}`} className="text-slate-200 hover:text-lab-rose">
                {e.message}
              </Link>
            ) : (
              e.message
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

export function ActivityDrawer() {
  const s = useLabState();
  const open = useLab((st) => st.drawerOpen);
  const close = useLab((st) => st.closeDrawer);
  const highlight = useLab((st) => st.highlightEventId);
  const [group, setGroup] = useState<string>('All');
  if (!open) return null;
  const types = group === 'All' ? null : new Set(TYPE_GROUPS[group]);
  const events = s.events.filter((e) => !types || types.has(e.type));
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={close}>
      <aside className="flex h-full w-full max-w-md flex-col border-l border-ink-600 bg-ink-900" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-ink-700 p-4">
          <h2 className="h2">Activity feed</h2>
          <button className="btn-ghost px-2" onClick={close} aria-label="Close">
            Close
          </button>
        </div>
        <div className="flex flex-wrap gap-1 border-b border-ink-700 p-3">
          {['All', ...Object.keys(TYPE_GROUPS)].map((g) => (
            <button key={g} className={cx('chip', g === group && 'chip-on')} onClick={() => setGroup(g)}>
              {g}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <EventList events={events} highlight={highlight} />
        </div>
      </aside>
    </div>
  );
}

export function Toasts() {
  const toasts = useLab((st) => st.toasts);
  const dismiss = useLab((st) => st.dismissToast);
  const openDrawer = useLab((st) => st.openDrawer);
  return (
    <div className="pointer-events-none fixed right-4 top-28 z-[60] flex w-[min(92vw,380px)] flex-col gap-2" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cx(
            'pointer-events-auto border px-4 py-3 text-sm',
            t.kind === 'error' && 'border-lab-red/60 bg-[#2a1a16] text-slate-100',
            t.kind === 'success' && 'border-lab-mint/50 bg-[#1e231a] text-slate-100',
            t.kind === 'info' && 'border-ink-500 bg-ink-800 text-slate-100',
          )}
        >
          <div className="flex items-start gap-2">
            <span className="mt-px w-14 shrink-0 text-[10px] font-semibold uppercase tracking-wider opacity-70">{t.kind === 'error' ? 'Blocked' : t.kind === 'success' ? 'Done' : 'Note'}</span>
            <span className="flex-1">{t.message}</span>
            <button className="text-slate-400 hover:text-white" onClick={() => dismiss(t.id)} aria-label="Dismiss">
              Close
            </button>
          </div>
          {t.eventId && (
            <button className="ml-16 mt-1 text-xs text-lab-rose hover:underline" onClick={() => openDrawer(t.eventId)}>
              View in activity feed
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Role hint

export function RoleHint({ hints }: { hints: Partial<Record<'player' | 'mapper' | 'bn' | 'nat' | 'admin', ReactNode>> }) {
  const s = useLabState();
  const me = useMeUser();
  const role = primaryRole(s, me);
  const hint = hints[role] ?? (role === 'nat' ? hints.bn : undefined) ?? (role === 'mapper' ? hints.player : undefined);
  if (!hint) return null;
  const label = { player: 'Player', mapper: 'Mapper', bn: 'BN', nat: 'NAT', admin: 'Admin' }[role];
  return (
    <div className="mb-4 flex items-start gap-3 border border-ink-600 bg-ink-900 px-3 py-2 text-sm text-slate-200">
      <span className="mt-px bg-ink-700 px-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-300">{label}</span>
      <span>{hint}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Guided tour

export function TourPanel() {
  const tour = useLab((st) => st.tour);
  const setTour = useLab((st) => st.setTour);
  const s = useLabState();
  const navigate = useNavigate();
  const [min, setMin] = useState(false);
  if (!tour.active) return null;
  const step = TOUR[Math.min(tour.step, TOUR.length - 1)];
  const api: TourApi = {
    state: () => useLab.getState().state,
    dispatch: (fn, args, as) => useLab.getState().dispatch(fn, args, { as }) !== null,
    advance: (ms) => useLab.getState().advance(ms),
    setUser: (id) => useLab.getState().setUser(id),
  };
  const go = (i: number) => {
    setTour({ step: i });
    navigate(TOUR[i].route(useLab.getState().state));
  };
  return (
    <div className="fixed bottom-4 left-4 z-[55] w-[min(92vw,380px)] rounded-2xl border border-ink-500 bg-ink-900 p-4">
      <div className="mb-1 flex items-center justify-between text-[11px] uppercase tracking-wider text-lab-pink">
        <span>
          Guided tour · {tour.step + 1}/{TOUR.length}
        </span>
        <span className="flex gap-3">
          <button className="text-slate-400 hover:text-white" onClick={() => setMin((x) => !x)} aria-label={min ? 'Expand tour' : 'Minimise tour'}>
            {min ? 'Show' : 'Hide'}
          </button>
          <button className="text-slate-400 hover:text-white" onClick={() => setTour({ active: false, dismissed: true })} aria-label="Close tour">
            Close
          </button>
        </span>
      </div>
      <h3 className="mb-1 font-semibold text-white">{step.title}</h3>
      {!min && <p className="mb-3 text-sm text-slate-300">{step.body(s)}</p>}
      <div className="flex flex-wrap items-center gap-2">
        {step.run && (
          <button
            className="btn-primary"
            onClick={() => {
              step.run!(api);
              navigate(step.route(useLab.getState().state));
              if (tour.step < TOUR.length - 1) setTour({ step: tour.step + 1 });
            }}
          >
            {step.doLabel ?? 'Do it'}
          </button>
        )}
        <button className="btn-secondary" onClick={() => navigate(step.route(s))}>
          Show me
        </button>
        <span className="flex-1" />
        <button className="btn-ghost px-2" disabled={tour.step === 0} onClick={() => go(tour.step - 1)}>
          Back
        </button>
        <button className="btn-ghost px-2" disabled={tour.step >= TOUR.length - 1} onClick={() => go(tour.step + 1)}>
          Next
        </button>
      </div>
    </div>
  );
}
