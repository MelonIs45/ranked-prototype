import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { RoleHint } from '../components/Shell';
import { ActionButton, Card, CategoryBadge, cx, Empty, Field, MapLink, UserLink, useMeUser } from '../components/ui';
import {
  activeSignatures,
  canDecideCase,
  canDecidePetition,
  canMarkAbusive,
  candidacyTally,
  decideCase,
  decidePetition,
  fmtDate,
  fmtDuration,
  markFlagAbusive,
  qualifiedDaysElapsed,
  runVerifier,
  type CaseOutcome,
  type FlagCase,
  type OverridePetition,
} from '../engine';
import { useLab, useLabState } from '../store';
import { IssueList } from './Beatmap';

type Item = { kind: 'case'; c: FlagCase } | { kind: 'petition'; p: OverridePetition };

function CaseReview({ c }: { c: FlagCase }) {
  const s = useLabState();
  const me = useMeUser();
  const dispatch = useLab((st) => st.dispatch);
  const [note, setNote] = useState('');
  const [abusive, setAbusive] = useState<string[]>([]);
  const map = s.maps[c.mapId];
  const flags = Object.values(s.flags).filter((f) => f.caseId === c.id);
  const bn = flags.filter((f) => f.source === 'bn');
  const players = flags.filter((f) => f.source === 'player');
  const byReason = players.reduce<Record<string, number>>((a, f) => ({ ...a, [f.reasonCategory]: (a[f.reasonCategory] ?? 0) + 1 }), {});
  const decide = (outcome: CaseOutcome) => {
    const r = dispatch(decideCase, { caseId: c.id, outcome, note, abusiveFlagIds: outcome === 'dismissed' ? abusive : [] });
    if (r) {
      setNote('');
      setAbusive([]);
    }
  };
  const check = canDecideCase(s, me.id, c.id);
  const toggle = (id: string) => setAbusive((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]));
  return (
    <div className="space-y-4">
      <div>
        <MapLink map={map} className="text-lg" />
        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm muted">
          <CategoryBadge category={map.category} /> mapped by <UserLink id={map.mapperId} /> · frozen at qualified day {qualifiedDaysElapsed(map).toFixed(1)}
        </div>
        <div className={cx('mt-1 text-sm', c.overdue ? 'font-semibold text-lab-red' : 'muted')}>
          Opened {fmtDate(c.openedAt)} by {c.trigger === 'bn' ? 'BN flags' : 'player reports'} · deadline {fmtDate(c.deadlineAt)} {c.overdue ? '(overdue)' : `(${fmtDuration(c.deadlineAt - s.now)} left)`}
        </div>
      </div>
      {bn.length > 0 && (
        <div>
          <div className="label">BN flags</div>
          <ul className="space-y-2">
            {bn.map((f) => (
              <li key={f.id} className="rounded-lg bg-ink-850 p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    <UserLink id={f.userId} /> <span className="muted">· {f.reasonCategory}</span>
                  </span>
                  {c.outcome === null && (
                    <label className="flex items-center gap-1.5 text-xs text-lab-red">
                      <input type="checkbox" checked={abusive.includes(f.id)} onChange={() => toggle(f.id)} /> mark abusive on dismiss
                    </label>
                  )}
                </div>
                <p className="mt-1 text-slate-300">“{f.reasonText}”</p>
              </li>
            ))}
          </ul>
        </div>
      )}
      {players.length > 0 && (
        <div>
          <div className="label">Player reports ({players.length})</div>
          <div className="mb-2 flex flex-wrap gap-1">
            {Object.entries(byReason).map(([r, n]) => (
              <span key={r} className="chip">
                {r}: {n}
              </span>
            ))}
          </div>
          <ul className="max-h-48 space-y-1 overflow-y-auto pr-1 text-sm">
            {players.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-2 rounded bg-ink-850 px-2 py-1">
                <span className="truncate">
                  <UserLink id={f.userId} avatar={false} /> <span className="muted">· {f.reasonText}</span>
                </span>
                {c.outcome === null && (
                  <label className="flex shrink-0 items-center gap-1 text-xs text-lab-red">
                    <input type="checkbox" checked={abusive.includes(f.id)} onChange={() => toggle(f.id)} /> abusive
                  </label>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div>
        <div className="label">Mapset Verifier</div>
        <IssueList issues={map.mvIssues} />
      </div>
      <div className="border border-ink-600 bg-ink-850 p-3 text-sm text-slate-200">
        Category reminder: give {s.params.categoryNames.mechanics} a wide berth and {s.params.categoryNames.levelDesign} a narrow one. Only DQ for category when the map is clearly in the wrong one.
      </div>
      <Field label="Decision note (required to DQ)">
        <textarea className="input min-h-[70px]" value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <div className="flex flex-wrap gap-2">
        <ActionButton check={check} onClick={() => decide('dismissed')}>
          Dismiss{abusive.length ? ` + mark ${abusive.length} abusive` : ''}
        </ActionButton>
        <ActionButton variant="danger" check={check} onClick={() => decide('dq_criteria')}>
          DQ for criteria
        </ActionButton>
        <ActionButton variant="danger" check={check} onClick={() => decide('dq_category')}>
          DQ for misclassified category
        </ActionButton>
      </div>
    </div>
  );
}

function PetitionReview({ p }: { p: OverridePetition }) {
  const s = useLabState();
  const me = useMeUser();
  const dispatch = useLab((st) => st.dispatch);
  const [note, setNote] = useState('');
  const map = s.maps[p.mapId];
  const check = canDecidePetition(s, me.id, p.id);
  return (
    <div className="space-y-4">
      <div>
        <MapLink map={map} className="text-lg" />
        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm muted">
          <CategoryBadge category={map.category} /> mapped by <UserLink id={map.mapperId} />
        </div>
        <div className={cx('mt-1 text-sm', p.deadlineAt && p.deadlineAt < s.now ? 'font-semibold text-lab-red' : 'muted')}>
          Submitted {p.submittedAt ? fmtDate(p.submittedAt) : 'not yet'} · deadline {p.deadlineAt ? `${fmtDate(p.deadlineAt)} (${fmtDuration(p.deadlineAt - s.now)} left)` : 'not set'}
        </div>
      </div>
      <div>
        <div className="label">Verifier failures</div>
        <div className="rounded-lg border border-lab-red/30 bg-lab-red/5 p-3">
          <IssueList issues={runVerifier(map).unrankable} />
        </div>
      </div>
      <div>
        <div className="label">Signatures</div>
        <ul className="space-y-2">
          {activeSignatures(p).map((x) => (
            <li key={x.userId} className="rounded-lg bg-ink-850 p-3 text-sm">
              <UserLink id={x.userId} /> <span className="text-xs muted">· {fmtDate(x.at)}</span>
              <p className="mt-1 text-slate-300">“{x.reason}”</p>
            </li>
          ))}
        </ul>
      </div>
      <Field label="Decision note">
        <textarea className="input min-h-[60px]" value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <p className="text-xs muted">
        Approve: the signatures count as nominations and the map is Qualified{s.params.interp.overrideApprovalStartsClock ? ' (clock starts today)' : ' (clock backdated to submission)'}. Deny: signatures voided, map stays Pending.
      </p>
      <div className="flex gap-2">
        <ActionButton check={check} onClick={() => dispatch(decidePetition, { petitionId: p.id, approve: true, note })}>
          Approve override
        </ActionButton>
        <ActionButton variant="danger" check={check} onClick={() => dispatch(decidePetition, { petitionId: p.id, approve: false, note })}>
          Deny
        </ActionButton>
      </div>
    </div>
  );
}

export function NATQueuePage() {
  const s = useLabState();
  const me = useMeUser();
  const dispatch = useLab((st) => st.dispatch);
  const [params, setParams] = useSearchParams();
  const items: Item[] = [
    ...Object.values(s.cases)
      .filter((c) => c.outcome === null)
      .map((c) => ({ kind: 'case' as const, c })),
    ...Object.values(s.petitions)
      .filter((p) => p.status === 'awaiting_nat')
      .map((p) => ({ kind: 'petition' as const, p })),
  ].sort((a, b) => (a.kind === 'case' ? a.c.deadlineAt : a.p.deadlineAt ?? 0) - (b.kind === 'case' ? b.c.deadlineAt : b.p.deadlineAt ?? 0));
  const itemId = (i: Item) => (i.kind === 'case' ? i.c.id : i.p.id);
  const selected = items.find((i) => itemId(i) === params.get('item')) ?? items[0];
  const recentlyDecided = [
    ...Object.values(s.cases).filter((c) => c.outcome !== null),
  ]
    .sort((a, b) => (b.decidedAt ?? 0) - (a.decidedAt ?? 0))
    .slice(0, 8);
  const overdueHistory = Object.values(s.petitions).filter((p) => p.overdue);
  const myVotes = Object.values(s.candidacies).filter((c) => c.status === 'open' && c.userId !== me.id && !c.votes.some((v) => v.userId === me.id));
  const myRemovals = Object.values(s.removalVotes).filter((r) => r.status === 'open' && !r.votes.some((v) => v.userId === me.id));
  const abusiveCandidates = Object.values(s.flags).filter((f) => f.caseId && s.cases[f.caseId]?.outcome === 'dismissed' && !f.markedAbusive && f.source === 'bn').slice(0, 6);

  if (!me.isNAT) return <Empty>The NAT queue is for NAT members. Switch to Arbiter in the header.</Empty>;

  return (
    <div className="space-y-4">
      <h1 className="h1">NAT queue</h1>
      <RoleHint hints={{ nat: `Flag cases and override petitions sorted by deadline; you have ${s.params.natReviewDays} days for each. Overdue items are red. NAT votes on candidates are required.` }} />
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="space-y-2">
          {items.length === 0 && <Empty>The queue is empty.</Empty>}
          {items.map((i) => {
            const id = itemId(i);
            const deadline = i.kind === 'case' ? i.c.deadlineAt : i.p.deadlineAt ?? 0;
            const overdue = deadline < s.now;
            const map = s.maps[i.kind === 'case' ? i.c.mapId : i.p.mapId];
            return (
              <button
                key={id}
                onClick={() => setParams({ item: id })}
                className={cx(
                  'block w-full rounded-xl border p-3 text-left transition-colors',
                  selected && itemId(selected) === id ? 'border-lab-pink bg-ink-800' : 'border-ink-700 bg-ink-900 hover:bg-ink-850',
                  overdue && 'border-lab-red/60',
                )}
              >
                <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider">
                  <span className={i.kind === 'case' ? 'text-lab-sky' : 'text-lab-amber'}>{i.kind === 'case' ? `Flag case · ${i.c.trigger === 'bn' ? 'BN flags' : 'player reports'}` : 'Override petition'}</span>
                  <span className={overdue ? 'text-lab-red' : 'muted'}>{overdue ? `overdue ${fmtDuration(s.now - deadline)}` : `${fmtDuration(deadline - s.now)} left`}</span>
                </div>
                <div className="mt-1 truncate font-medium text-white">{map.title}</div>
                <div className="truncate text-xs muted">{map.artist}</div>
              </button>
            );
          })}
        </div>
        <Card>{selected ? selected.kind === 'case' ? <CaseReview key={selected.c.id} c={selected.c} /> : <PetitionReview key={selected.p.id} p={selected.p} /> : <div className="muted">Nothing to review.</div>}</Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="My outstanding votes" action={<Link to="/votes" className="text-sm">All votes</Link>}>
          {myVotes.length + myRemovals.length === 0 ? (
            <div className="text-sm text-lab-mint">You're up to date.</div>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {myVotes.map((c) => {
                const t = candidacyTally(s, c);
                return (
                  <li key={c.id} className="flex items-center justify-between gap-2 rounded-lg bg-lab-red/10 px-2 py-1.5">
                    <span>
                      NAT candidacy: <UserLink id={c.userId} />
                    </span>
                    <span className="text-xs text-lab-red">required · closes in {fmtDuration(c.closesAt - s.now)} · {t.natMissing.length} NAT missing</span>
                  </li>
                );
              })}
              {myRemovals.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 rounded-lg bg-ink-850 px-2 py-1.5">
                  <span>
                    Removal vote: <UserLink id={r.targetUserId} />
                  </span>
                  <span className="text-xs muted">closes in {fmtDuration(r.closesAt - s.now)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Recently decided cases">
          {recentlyDecided.length ? (
            <ul className="space-y-1.5 text-sm">
              {recentlyDecided.map((c) => (
                <li key={c.id} className="flex justify-between gap-2">
                  <MapLink map={s.maps[c.mapId]} className="truncate" />
                  <span className={cx('shrink-0 text-xs', c.outcome === 'dismissed' ? 'text-lab-mint' : 'text-lab-red')}>{c.outcome?.replace('_', ' ')}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-sm muted">None yet.</div>
          )}
          {overdueHistory.length > 0 && <p className="mt-3 text-xs text-lab-red">{overdueHistory.length} override petition(s) expired past their NAT deadline.</p>}
          {abusiveCandidates.length > 0 && (
            <div className="mt-3">
              <div className="label">Flags on dismissed cases</div>
              <ul className="space-y-1 text-xs">
                {abusiveCandidates.map((f) => (
                  <li key={f.id} className="flex items-center justify-between gap-2">
                    <span className="truncate">
                      {s.users[f.userId]?.username} on {s.maps[f.mapId]?.title}
                    </span>
                    <ActionButton variant="ghost" className="px-2 py-0.5 text-xs" check={canMarkAbusive(s, me.id, f.id)} onClick={() => dispatch(markFlagAbusive, { flagId: f.id })}>
                      Mark abusive
                    </ActionButton>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
