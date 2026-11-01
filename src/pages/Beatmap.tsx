import { useMemo, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { EventList, RoleHint } from '../components/Shell';
import { ActionButton, AvatarStack, Card, CategoryBadge, cx, Field, fmtNum, MapCover, Meter, Modal, Stat, StatusBadge, UserLink, useMeUser } from '../components/ui';
import {
  activeNominations,
  activeSignatures,
  canBnFlag,
  canCastStar,
  canDisqualify,
  canDownload,
  canMoveToPending,
  canNominate,
  canPlay,
  canReport,
  canRevive,
  canSetCategory,
  canSignOverride,
  castStar,
  categoryFeatures,
  categoryName,
  DAY,
  disqualify,
  download,
  FLAG_REASONS,
  bnFlag,
  fmtDate,
  fmtDateTime,
  fmtDuration,
  isBestOfLD,
  isNominator,
  legacyPlayCount,
  mapEvents,
  mapFlags,
  mapLeaderboard,
  mapNominations,
  mapStars,
  moveToPending,
  nominate,
  openCase,
  openFlags,
  openPetition,
  play,
  playTimeHours,
  qualifiedDaysElapsed,
  qualifiedRemainingMs,
  report,
  reviveMap,
  runVerifier,
  setCategory,
  signOverride,
  starCount,
  starWallet,
  uniqueDownloads,
  type Beatmapset,
  type Category,
  type MVIssue,
  type State,
} from '../engine';
import { useLab, useLabState } from '../store';

export function IssueList({ issues }: { issues: MVIssue[] }) {
  if (!issues.length) return <div className="text-sm text-lab-mint">No issues found.</div>;
  return (
    <ul className="space-y-1.5">
      {issues.map((i, k) => (
        <li key={k} className="flex items-start gap-2 text-sm">
          <span
            className={cx(
              'mt-0.5 shrink-0 rounded px-1.5 text-[10px] font-bold uppercase',
              i.severity === 'unrankable' ? 'bg-lab-red/20 text-lab-red' : i.severity === 'warning' ? 'bg-lab-amber/20 text-lab-amber' : 'bg-ink-700 text-slate-400',
            )}
          >
            {i.severity}
          </span>
          <span>
            <span className="font-medium text-slate-100">{i.check}.</span> <span className="muted">{i.message}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function CategoryPicker({ value, onChange }: { value: Category | null; onChange: (c: Category) => void }) {
  const s = useLabState();
  return (
    <div className="grid grid-cols-2 gap-2">
      {(['mechanics', 'level_design'] as Category[]).map((c) => (
        <button key={c} type="button" onClick={() => onChange(c)} className={cx('rounded-lg border p-3 text-left', value === c ? 'border-lab-pink bg-lab-pink/10' : 'border-ink-600 hover:bg-ink-800')}>
          <div className="font-semibold text-white">{categoryName(s.params, c)}</div>
          <div className="text-xs muted">{c === 'mechanics' ? 'Skill-focused; plain sorts.' : 'Design-focused; stars and rewards.'}</div>
        </button>
      ))}
    </div>
  );
}

type ModalKind = null | 'nominate' | 'override' | 'flag' | 'report' | 'dq' | 'category' | 'pending' | 'revive';

function ActionBar({ map }: { map: Beatmapset }) {
  const s = useLabState();
  const me = useMeUser();
  const dispatch = useLab((st) => st.dispatch);
  const [modal, setModal] = useState<ModalKind>(null);
  const [text, setText] = useState('');
  const [reasonCat, setReasonCat] = useState(FLAG_REASONS[0]);
  const [cat, setCat] = useState<Category | null>(map.category);
  const [dqKind, setDqKind] = useState<'criteria' | 'category' | 'direct'>('direct');
  const [diff, setDiff] = useState(map.difficulties[map.difficulties.length - 1]?.name ?? '');
  const v = runVerifier(map);
  const isOwner = map.mapperId === me.id;
  const nominator = isNominator(me);
  const close = () => {
    setModal(null);
    setText('');
  };
  const open = (k: ModalKind) => {
    setText('');
    setCat(map.category);
    setModal(k);
  };
  const ok = (r: unknown) => r !== null && close();

  const groups: { label: string; buttons: ReactNode[] }[] = [];
  if (isOwner) {
    const b: ReactNode[] = [];
    if (map.status === 'wip') b.push(<ActionButton key="p" check={canMoveToPending(s, me.id, map.id, 'mechanics')} onClick={() => open('pending')}>Move to Pending</ActionButton>);
    if (map.status === 'wip' || map.status === 'pending')
      b.push(<ActionButton key="c" variant="secondary" check={canSetCategory(s, me.id, map.id)} onClick={() => open('category')}>Edit category</ActionButton>);
    if (map.status === 'graveyard') b.push(<ActionButton key="r" check={canRevive(s, me.id, map.id)} onClick={() => open('revive')}>Revive</ActionButton>);
    if (b.length) groups.push({ label: 'Mapper', buttons: b });
  }
  if (nominator) {
    const b: ReactNode[] = [];
    if (map.status === 'pending') {
      if (v.ok) b.push(<ActionButton key="n" check={canNominate(s, me.id, map.id)} onClick={() => open('nominate')}>Nominate</ActionButton>);
      else b.push(<ActionButton key="o" check={canSignOverride(s, me.id, map.id, null)} onClick={() => open('override')}>Sign override petition</ActionButton>);
    }
    if (map.status === 'qualified') b.push(<ActionButton key="f" variant="secondary" check={canBnFlag(s, me.id, map.id)} onClick={() => open('flag')}>Flag</ActionButton>);
    if (map.status === 'ranked' && map.category === 'level_design') {
      const w = starWallet(s, me.id);
      b.push(
        <ActionButton key="s" check={canCastStar(s, me.id, map.id)} onClick={() => dispatch(castStar, { mapId: map.id })}>
          Shoot star <span className="text-xs opacity-70">({w.available} left)</span>
        </ActionButton>,
      );
    }
    if (b.length) groups.push({ label: me.isNAT ? 'Nominator' : 'BN', buttons: b });
  }
  if (me.isNAT && map.status === 'qualified') {
    const c = openCase(s, map.id);
    groups.push({
      label: 'NAT',
      buttons: [
        <ActionButton key="dq" variant="danger" check={canDisqualify(s, me.id, map.id, null)} onClick={() => open('dq')}>
          Disqualify
        </ActionButton>,
        c ? (
          <Link key="case" to={`/nat?item=${c.id}`} className="btn-secondary">
            Open case review
          </Link>
        ) : null,
      ].filter(Boolean),
    });
  }
  if (!me.isAdmin) {
    const b: ReactNode[] = [];
    if (map.status !== 'wip') {
      b.push(
        <span key="play" className="inline-flex items-center gap-1">
          <select className="input w-auto py-1.5 text-xs" value={diff} onChange={(e) => setDiff(e.target.value)} aria-label="Difficulty">
            {map.difficulties.map((d) => (
              <option key={d.name}>{d.name}</option>
            ))}
          </select>
          <ActionButton variant="secondary" check={canPlay(s, me.id, map.id)} onClick={() => dispatch(play, { mapId: map.id, diffName: diff })}>
            Play
          </ActionButton>
        </span>,
        <ActionButton key="dl" variant="secondary" check={canDownload(s, me.id, map.id)} onClick={() => dispatch(download, { mapId: map.id })}>
          Download
        </ActionButton>,
      );
    }
    if (map.status === 'qualified') b.push(<ActionButton key="rep" variant="ghost" check={canReport(s, me.id, map.id)} onClick={() => open('report')}>Report</ActionButton>);
    if (b.length) groups.push({ label: 'Player', buttons: b });
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-ink-700 bg-ink-900 p-3">
        {groups.length === 0 && <span className="text-sm muted">No actions for {me.username} on this map. Switch persona in the header to try another role.</span>}
        {groups.map((g) => (
          <div key={g.label} className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{g.label}</span>
            {g.buttons}
          </div>
        ))}
      </div>

      <Modal open={modal === 'nominate'} onClose={close} title="Nominate this map">
        <p className="mb-3 text-sm muted">
          This spends 1 of your {s.nominators[me.id]?.allowanceAvailable ?? 0} available nominations. The map has {activeNominations(s, map.id).length}/{s.params.nominationsRequired}.
        </p>
        <div className="mb-4 rounded-lg bg-ink-850 p-3">
          <div className="label">Mapset Verifier</div>
          <IssueList issues={v.others} />
          {v.others.length > 0 && <p className="mt-2 text-xs muted">These issues don't block nomination.</p>}
        </div>
        <div className="flex justify-end gap-2">
          <button className="btn-ghost" onClick={close}>Cancel</button>
          <button className="btn-primary" onClick={() => ok(dispatch(nominate, { mapId: map.id }))}>Nominate</button>
        </div>
      </Modal>

      <Modal open={modal === 'override'} onClose={close} title="The Mapset Verifier blocked this nomination">
        <div className="mb-3 rounded-lg border border-lab-red/40 bg-lab-red/10 p-3">
          <IssueList issues={v.unrankable} />
        </div>
        {(() => {
          const pet = openPetition(s, map.id);
          return (
            <p className="mb-3 text-sm muted">
              Sign an override petition? It needs {s.params.nominationsRequired} signatures with written reasons, then NAT decide within {s.params.natReviewDays} days.
              {pet ? ` ${activeSignatures(pet).length} signed so far.` : ' Yours would be the first.'}
              {s.params.interp.overrideSignatureSpendsNomination && ' Signing spends 1 nomination.'}
            </p>
          );
        })()}
        <Field label="Reason (required)">
          <textarea className="input min-h-[90px]" value={text} onChange={(e) => setText(e.target.value)} placeholder="Why is this check a false positive or acceptable here?" />
        </Field>
        <div className="mt-4 flex justify-end gap-2">
          <button className="btn-ghost" onClick={close}>Cancel</button>
          <ActionButton check={canSignOverride(s, me.id, map.id, text)} onClick={() => ok(dispatch(signOverride, { mapId: map.id, reason: text }))}>
            Sign petition
          </ActionButton>
        </div>
      </Modal>

      <Modal open={modal === 'flag' || modal === 'report'} onClose={close} title={modal === 'flag' ? 'Raise a BN flag' : 'Report this qualified map'}>
        <p className="mb-3 text-sm muted">
          {modal === 'flag'
            ? `${s.params.bnFlagsToOpenCase} distinct BN flags open a NAT case and freeze the map.`
            : `${s.params.playerFlagsToOpenCase} distinct player reports open a NAT case. Coordinated or bad-faith reports can earn abuse strikes.`}
        </p>
        <Field label="Reason category">
          <select className="input" value={reasonCat} onChange={(e) => setReasonCat(e.target.value)}>
            {FLAG_REASONS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </Field>
        <div className="mt-3">
          <Field label="Details (required)">
            <textarea className="input min-h-[80px]" value={text} onChange={(e) => setText(e.target.value)} />
          </Field>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button className="btn-ghost" onClick={close}>Cancel</button>
          {modal === 'flag' ? (
            <ActionButton check={canBnFlag(s, me.id, map.id, text)} onClick={() => ok(dispatch(bnFlag, { mapId: map.id, reasonCategory: reasonCat, reasonText: text }))}>
              Flag
            </ActionButton>
          ) : (
            <ActionButton check={canReport(s, me.id, map.id, text)} onClick={() => ok(dispatch(report, { mapId: map.id, reasonCategory: reasonCat, reasonText: text }))}>
              Report
            </ActionButton>
          )}
        </div>
      </Modal>

      <Modal open={modal === 'dq'} onClose={close} title="Disqualify this map">
        <p className="mb-3 text-sm muted">The map returns to Pending, all nominations are voided (not refunded) and a DQ is recorded against each nominator.</p>
        <Field label="Kind">
          <select className="input" value={dqKind} onChange={(e) => setDqKind(e.target.value as typeof dqKind)}>
            <option value="direct">Direct DQ (criteria concern)</option>
            <option value="category">Misclassified category</option>
          </select>
        </Field>
        <div className="mt-3">
          <Field label="Reason (required)">
            <textarea className="input min-h-[80px]" value={text} onChange={(e) => setText(e.target.value)} />
          </Field>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button className="btn-ghost" onClick={close}>Cancel</button>
          <ActionButton variant="danger" check={canDisqualify(s, me.id, map.id, text)} onClick={() => ok(dispatch(disqualify, { mapId: map.id, reason: text, kind: dqKind === 'category' ? 'category' : undefined }))}>
            Disqualify
          </ActionButton>
        </div>
      </Modal>

      <Modal open={modal === 'category' || modal === 'pending' || modal === 'revive'} onClose={close} title={modal === 'pending' ? 'Move to Pending' : modal === 'revive' ? 'Revive from the graveyard' : 'Edit category'}>
        <p className="mb-3 text-sm muted">The category is editable until the first nomination, then locked. NAT can still disqualify a clearly misclassified map.</p>
        <CategoryPicker value={cat} onChange={setCat} />
        <div className="mt-4 flex justify-end gap-2">
          <button className="btn-ghost" onClick={close}>Cancel</button>
          {modal === 'pending' && (
            <ActionButton check={canMoveToPending(s, me.id, map.id, cat)} onClick={() => ok(dispatch(moveToPending, { mapId: map.id, category: cat! }))}>
              Move to Pending
            </ActionButton>
          )}
          {modal === 'category' && (
            <ActionButton check={cat ? canSetCategory(s, me.id, map.id) : canMoveToPending(s, me.id, map.id, null)} onClick={() => ok(dispatch(setCategory, { mapId: map.id, category: cat! }))}>
              Save category
            </ActionButton>
          )}
          {modal === 'revive' && (
            <ActionButton check={canRevive(s, me.id, map.id)} onClick={() => ok(dispatch(reviveMap, { mapId: map.id, category: cat ?? undefined }))}>
              Revive
            </ActionButton>
          )}
        </div>
      </Modal>
    </>
  );
}

function timeline(s: State, map: Beatmapset) {
  const items: { at: number; label: ReactNode; tone?: string }[] = [];
  const u = (id: string) => <UserLink id={id} avatar={false} />;
  items.push({ at: map.createdAt, label: <>Created by {u(map.mapperId)}</> });
  if (map.pendingAt) items.push({ at: map.pendingAt, label: 'Moved to Pending' });
  for (const n of mapNominations(s, map.id))
    items.push({ at: n.at, label: <>Nominated by {u(n.userId)}{n.viaOverride && ' (override)'}{n.voidedAt && <span className="text-lab-red"> · voided {fmtDate(n.voidedAt)}</span>}</>, tone: 'text-lab-violet' });
  for (const p of Object.values(s.petitions).filter((x) => x.mapId === map.id)) {
    for (const sig of p.signatures) items.push({ at: sig.at, label: <>Override signed by {u(sig.userId)}{sig.voided && <span className="muted"> (voided)</span>}</> });
    if (p.submittedAt) items.push({ at: p.submittedAt, label: 'Override petition sent to NAT', tone: 'text-lab-amber' });
  }
  const flags = mapFlags(s, map.id);
  const bnFlags = flags.filter((f) => f.source === 'bn');
  for (const f of bnFlags) items.push({ at: f.at, label: <>BN flag by {u(f.userId)}: {f.reasonCategory}</>, tone: 'text-lab-amber' });
  const playerFlags = flags.filter((f) => f.source === 'player');
  if (playerFlags.length) items.push({ at: playerFlags[playerFlags.length - 1].at, label: `${playerFlags.length} player reports (latest)`, tone: 'text-lab-amber' });
  for (const c of Object.values(s.cases).filter((x) => x.mapId === map.id)) {
    items.push({ at: c.openedAt, label: 'NAT case opened; map frozen', tone: 'text-lab-sky' });
    if (c.decidedAt) items.push({ at: c.decidedAt, label: <>Case {c.outcome?.replace('_', ' ')} by {c.reviewerId ? u(c.reviewerId) : 'system'}</>, tone: 'text-lab-sky' });
  }
  for (const d of Object.values(s.dqs).filter((x) => x.mapId === map.id)) items.push({ at: d.at, label: <>Disqualified by {u(d.byUserId)}: {d.reason}</>, tone: 'text-lab-red' });
  if (map.qualifiedAt) items.push({ at: map.qualifiedAt, label: 'Qualified', tone: 'text-lab-sky' });
  if (map.rankedAt) items.push({ at: map.rankedAt, label: 'Ranked', tone: 'text-lab-mint' });
  return items.sort((a, b) => a.at - b.at);
}

function StarHistory({ map }: { map: Beatmapset }) {
  const s = useLabState();
  const data = useMemo(() => {
    const stars = mapStars(s, map.id).filter((x) => x.at <= s.now).sort((a, b) => a.at - b.at);
    const start = map.rankedAt ?? s.now;
    const days = Math.max(1, Math.ceil((s.now - start) / DAY));
    const step = Math.max(1, Math.ceil(days / 60));
    const out: { day: string; total: number; recent: number }[] = [];
    let i = 0;
    for (let d = 0; d <= days; d += step) {
      const t = Math.min(s.now, start + d * DAY);
      while (i < stars.length && stars[i].at <= t) i++;
      out.push({ day: fmtDate(t).replace(/, \d{4}$/, ''), total: i, recent: stars.filter((x) => x.at <= t && x.at > t - s.params.sort.recentWindowDays * DAY).length });
    }
    return out;
  }, [s, map]);
  return (
    <div className="h-44">
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ left: -20, right: 8, top: 6 }}>
          <CartesianGrid stroke="#463a40" vertical={false} />
          <XAxis dataKey="day" tick={{ fill: '#ab9aa2', fontSize: 11 }} minTickGap={24} />
          <YAxis allowDecimals={false} tick={{ fill: '#ab9aa2', fontSize: 11 }} />
          <Tooltip contentStyle={{ background: '#30272c', border: '1px solid #584a51', borderRadius: 8 }} labelStyle={{ color: '#e6dbe0' }} />
          <Area type="monotone" dataKey="total" name="All-time stars" stroke="#e8b84f" fill="#e8b84f22" strokeWidth={2} />
          <Area type="monotone" dataKey="recent" name={`Last ${s.params.sort.recentWindowDays} d`} stroke="#ff66ab" fill="#ff66ab1a" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function BeatmapPage() {
  const { id } = useParams();
  const s = useLabState();
  const map = s.maps[id ?? ''];
  const [lbDiff, setLbDiff] = useState<string | undefined>(undefined);
  if (!map) return <div className="card">Beatmap not found. <Link to="/beatmaps">Back to listing</Link></div>;
  const noms = activeNominations(s, map.id);
  const v = runVerifier(map);
  const pet = openPetition(s, map.id);
  const c = openCase(s, map.id);
  const flags = openFlags(s, map.id);
  const bnFlagCount = new Set(flags.filter((f) => f.source === 'bn' && f.caseId === null).map((f) => f.userId)).size;
  const playerFlagCount = new Set(flags.filter((f) => f.source === 'player' && f.caseId === null).map((f) => f.userId)).size;
  const ld = map.category === 'level_design';
  const showStars = map.status === 'ranked' && map.category !== null && categoryFeatures(map.category).stars;
  const req = s.params.nominationsRequired;
  const lb = mapLeaderboard(s, map.id, lbDiff).slice(0, 10);

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-ink-700 bg-ink-900">
        <MapCover map={map} className="h-36 sm:h-44" />
        <div className="-mt-24 px-4 pb-4 sm:-mt-28 sm:px-6">
          <div className="relative flex flex-wrap gap-1.5">
            <StatusBadge status={map.status} frozen={map.frozen} />
            <CategoryBadge category={map.category} />
            {map.isFA && <span className="rounded-md bg-lab-amber/90 px-1.5 py-0.5 text-[11px] font-bold text-ink-950">Featured Artist</span>}
            {isBestOfLD(s, map.id) && <span className="rounded-md bg-lab-pink/90 px-1.5 py-0.5 text-[11px] font-bold text-ink-950">Best of {s.params.categoryNames.levelDesign}</span>}
          </div>
          <h1 className="relative mt-3 text-2xl font-bold text-white drop-shadow sm:text-3xl">{map.title}</h1>
          <div className="relative text-lg text-slate-200 drop-shadow">{map.artist}</div>
          <div className="relative mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span className="muted">mapped by</span> <UserLink id={map.mapperId} />
            {map.guestMapperIds.length > 0 && (
              <>
                <span className="muted">with guests</span>
                {map.guestMapperIds.map((g) => (
                  <UserLink key={g} id={g} />
                ))}
              </>
            )}
            <span className="muted">· {map.genre} · {map.language}</span>
          </div>
          {map.description && <p className="relative mt-3 max-w-3xl text-sm text-slate-300">{map.description}</p>}
        </div>
      </div>

      <RoleHint
        hints={{
          player: 'Play or download to add to the engagement metrics. If a qualified map has a real problem, report it.',
          mapper: 'If this is your map, you can edit its category until the first nomination.',
          bn: 'Nominate Pending maps (verifier permitting), flag Qualified ones you did not nominate, and star ranked Level Design maps.',
          nat: 'You can disqualify any Qualified map directly, or review its open case in the NAT queue.',
          admin: 'Use the admin panel to simulate plays, downloads, reports or stars on this map.',
        }}
      />
      <ActionBar map={map} />

      {map.status === 'qualified' &&
        (map.frozen ? (
          <div className="rounded-xl border border-lab-sky/40 bg-lab-sky/10 p-4">
            <div className="font-semibold text-lab-sky">Frozen by an open NAT case</div>
            <div className="text-sm text-slate-300">
              The qualified clock is paused at day {qualifiedDaysElapsed(map).toFixed(1)} of {s.params.qualifiedDays}. NAT deadline: {c ? fmtDateTime(c.deadlineAt) : 'not set'}
              {c?.overdue && <span className="ml-1 font-semibold text-lab-red">(overdue)</span>}.
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-lab-sky/30 bg-ink-900 p-4">
            <div className="mb-1 flex justify-between text-sm">
              <span className="font-semibold text-lab-sky">Qualified · ranks in {fmtDuration(qualifiedRemainingMs(s, map))}</span>
              <span className="muted">
                day {qualifiedDaysElapsed(map).toFixed(1)} / {s.params.qualifiedDays}
              </span>
            </div>
            <Meter value={map.qualifiedElapsedMs} max={s.params.qualifiedDays * DAY} color="bg-lab-sky" />
          </div>
        ))}

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <Card title="Difficulties">
            <table className="responsive w-full text-sm">
              <thead className="text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="pb-2">Difficulty</th>
                  <th className="pb-2">Star rating</th>
                  <th className="pb-2">Length</th>
                  <th className="pb-2">Skill tags</th>
                </tr>
              </thead>
              <tbody>
                {map.difficulties.map((d) => (
                  <tr key={d.name} className="table-row">
                    <td data-label="Difficulty" className="py-1.5 font-medium text-white">{d.name}</td>
                    <td data-label="Star rating" className="py-1.5">{d.starRating.toFixed(2)}</td>
                    <td data-label="Length" className="py-1.5">{Math.floor(d.lengthSec / 60)}:{String(d.lengthSec % 60).padStart(2, '0')}</td>
                    <td data-label="Skill tags" className="py-1.5">
                      <span className="flex flex-wrap justify-end gap-1 sm:justify-start">
                        {d.skillTags.length ? d.skillTags.map((t) => <span key={t} className="chip">{t}</span>) : <span className="muted">none</span>}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {showStars && (
            <Card title={<>Stars <span className="text-sm font-normal muted">· {starCount(s, map.id, 'recent')} in the last {s.params.sort.recentWindowDays} days, {starCount(s, map.id, 'season')} this season, {starCount(s, map.id, 'all')} all time</span></>}>
              <StarHistory map={map} />
            </Card>
          )}
          {map.status === 'ranked' && map.category === 'mechanics' && (
            <div className="rounded-xl border border-ink-700 p-3 text-sm muted">
              {s.params.categoryNames.mechanics} maps have leaderboards and pp but no stars. Their visibility and rewards are left to that community.
            </div>
          )}

          {(map.status === 'ranked' || map.status === 'qualified') && (
            <Card
              title="Leaderboard"
              action={
                <select className="input w-auto py-1 text-xs" value={lbDiff ?? ''} onChange={(e) => setLbDiff(e.target.value || undefined)} aria-label="Leaderboard difficulty">
                  <option value="">All difficulties</option>
                  {map.difficulties.map((d) => (
                    <option key={d.name}>{d.name}</option>
                  ))}
                </select>
              }
            >
              {lb.length ? (
                <table className="responsive w-full text-sm">
                  <thead className="text-left text-xs uppercase text-slate-500">
                    <tr>
                      <th className="pb-2">#</th>
                      <th className="pb-2">Player</th>
                      <th className="pb-2">Score</th>
                      <th className="pb-2">Accuracy</th>
                      <th className="pb-2">pp</th>
                      <th className="pb-2">Diff</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lb.map((p, i) => (
                      <tr key={p.id} className="table-row">
                        <td data-label="#" className="py-1.5 font-semibold text-slate-400">{i + 1}</td>
                        <td data-label="Player" className="py-1.5"><UserLink id={p.userId} /></td>
                        <td data-label="Score" className="py-1.5 font-mono">{fmtNum(p.score)}</td>
                        <td data-label="Accuracy" className="py-1.5">{p.accuracy.toFixed(2)}%</td>
                        <td data-label="pp" className="py-1.5">{map.status === 'ranked' ? p.pp : 'n/a'}</td>
                        <td data-label="Diff" className="py-1.5 muted">{p.diffName}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="text-sm muted">No plays yet.</div>
              )}
              {map.status === 'qualified' && <p className="mt-2 text-xs muted">Qualified maps award no pp until they rank.</p>}
            </Card>
          )}

          <Card title="Status timeline">
            <ol className="relative space-y-2 border-l border-ink-600 pl-4">
              {timeline(s, map).map((it, i) => (
                <li key={i} className="text-sm">
                  <span className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full bg-ink-500" />
                  <span className="mr-2 font-mono text-xs text-slate-500">{fmtDate(it.at)}</span>
                  <span className={it.tone}>{it.label}</span>
                </li>
              ))}
            </ol>
          </Card>

          <Card title="Event history">
            <EventList events={mapEvents(s, map.id)} limit={40} />
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Nominations">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-2xl font-bold text-white">
                {noms.length}/{req}
              </span>
              <AvatarStack ids={noms.map((n) => n.userId)} />
            </div>
            <Meter value={noms.length} max={req} color="bg-lab-violet" />
            {noms.length > 0 && (
              <ul className="mt-3 space-y-1 text-sm">
                {noms.map((n) => (
                  <li key={n.id} className="flex justify-between gap-2">
                    <UserLink id={n.userId} />
                    <span className="text-xs muted">{fmtDate(n.at)}{n.viaOverride && ' · override'}</span>
                  </li>
                ))}
              </ul>
            )}
            {map.dqCount > 0 && <div className="mt-2 text-xs text-lab-red">Disqualified {map.dqCount}× before</div>}
            {map.category && (map.status === 'pending' || map.status === 'wip') && (
              <div className="mt-2 text-xs muted">Category {noms.length ? 'locked by the first nomination' : 'editable by the mapper until the first nomination'}.</div>
            )}
          </Card>

          {pet && (
            <Card title="Override petition">
              <div className="mb-2 text-sm">
                <span className={cx('font-semibold', pet.status === 'awaiting_nat' ? 'text-lab-amber' : 'text-white')}>{pet.status === 'awaiting_nat' ? 'Awaiting NAT' : 'Collecting signatures'}</span>
                <span className="muted"> · {activeSignatures(pet).length}/{req}</span>
                {pet.deadlineAt && <div className="text-xs muted">NAT deadline {fmtDateTime(pet.deadlineAt)} ({fmtDuration(pet.deadlineAt - s.now)})</div>}
              </div>
              <ul className="space-y-2 text-sm">
                {activeSignatures(pet).map((x) => (
                  <li key={x.userId} className="rounded-lg bg-ink-850 p-2">
                    <UserLink id={x.userId} />
                    <p className="mt-1 text-slate-300">“{x.reason}”</p>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card title="Mapset Verifier">
            <IssueList issues={map.mvIssues} />
            {!v.ok && map.status === 'pending' && <p className="mt-2 text-xs text-lab-red">Unrankable issues block regular nominations; BNs can sign an override petition.</p>}
          </Card>

          {map.status === 'qualified' && (
            <Card title="Flags">
              <div className="grid grid-cols-2 gap-2">
                <Stat label="BN flags" value={`${bnFlagCount}/${s.params.bnFlagsToOpenCase}`} />
                <Stat label="Player reports" value={`${playerFlagCount}/${s.params.playerFlagsToOpenCase}`} />
              </div>
              {c && <p className="mt-2 text-sm text-lab-sky">Case open since {fmtDate(c.openedAt)} ({flags.filter((f) => f.caseId === c.id).length} flags under review).</p>}
            </Card>
          )}

          <Card title="Engagement">
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Play time" value={`${fmtNum(playTimeHours(s, map.id), 1)} h`} />
              <Stat label="Unique downloads" value={fmtNum(uniqueDownloads(s, map.id))} />
            </div>
            <div className="mt-2 text-xs text-slate-500">Legacy play count (includes retries): {fmtNum(legacyPlayCount(s, map.id))}</div>
            {showStars && ld && <div className="mt-1 text-xs text-slate-500">Each star here gives +1 leaderboard point to each nominator.</div>}
          </Card>
        </div>
      </div>
    </div>
  );
}
