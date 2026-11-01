import { useState } from 'react';
import { RoleHint } from '../components/Shell';
import { ActionButton, Card, cx, Empty, Field, Meter, UserLink, useMeUser } from '../components/ui';
import {
  bnMembers,
  canOpenRemoval,
  canVoteCandidacy,
  canVoteRemoval,
  fail,
  candidacyTally,
  fmtDate,
  fmtDuration,
  openRemovalVote,
  REMOVAL_REASONS,
  removalTally,
  voteCandidacy,
  voteRemoval,
  type NATCandidacy,
  type RemovalVote,
} from '../engine';
import { useLab, useLabState } from '../store';

function Tally({ label, yes, no, base, need, pass, note }: { label: string; yes: number; no: number; base: number; need: string; pass: boolean; note?: string }) {
  return (
    <div className="rounded-lg bg-ink-850 p-3">
      <div className="mb-1 flex justify-between text-sm">
        <span className="font-semibold text-white">{label}</span>
        <span className={pass ? 'text-lab-mint' : 'muted'}>{pass ? 'majority reached' : need}</span>
      </div>
      <Meter value={yes} max={Math.max(base, 1)} color={pass ? 'bg-lab-mint' : 'bg-lab-violet'} />
      <div className="mt-1 text-xs muted">
        {yes} yes · {no} no · base {base}
        {note && ` · ${note}`}
      </div>
    </div>
  );
}

function Candidacy({ c }: { c: NATCandidacy }) {
  const s = useLabState();
  const me = useMeUser();
  const dispatch = useLab((st) => st.dispatch);
  const t = candidacyTally(s, c);
  const thr = s.params.natVoteThreshold;
  const basis = s.params.interp.voteBasis === 'membership' ? 'members' : 'votes cast';
  const check = canVoteCandidacy(s, me.id, c.id);
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-xs uppercase tracking-wider text-lab-pink">NAT candidacy</div>
          <UserLink id={c.userId} className="text-lg" />
        </div>
        <span className={cx('rounded-full px-2 py-0.5 text-xs font-semibold', c.status === 'open' ? 'bg-lab-amber/20 text-lab-amber' : c.status === 'accepted' ? 'bg-lab-mint/20 text-lab-mint' : 'bg-ink-700 text-slate-400')}>
          {c.status === 'open' ? `open · closes in ${fmtDuration(c.closesAt - s.now)}` : `${c.status} ${fmtDate(c.closesAt)}`}
        </span>
      </div>
      <p className="mt-2 text-sm text-slate-300">{c.portfolioText}</p>
      {c.portfolioLinks.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-2 text-xs">
          {c.portfolioLinks.map((l, i) => (
            <a key={i} href={l.startsWith('#') ? l : '#'} className="underline">
              link {i + 1}
            </a>
          ))}
        </div>
      )}
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <Tally label="BN vote (optional)" yes={t.bnYes} no={t.bnNo} base={t.bnBase} pass={t.bnPass} need={`needs > ${Math.floor(thr * t.bnBase)} of ${t.bnBase} ${basis}`} />
        <Tally label="NAT vote (required)" yes={t.natYes} no={t.natNo} base={t.natBase} pass={t.natPass} need={`needs > ${Math.floor(thr * t.natBase)} of ${t.natBase} ${basis}`} />
      </div>
      <p className="mt-2 text-xs muted">Accepted if either majority passes. Only one needs to.</p>
      {t.natMissing.length > 0 && c.status === 'open' && (
        <div className="mt-2 text-xs">
          <span className="text-lab-red">NAT members who haven't voted: </span>
          {t.natMissing.map((id, i) => (
            <span key={id} className="text-lab-red">
              {i > 0 && ', '}
              {s.users[id]?.username}
            </span>
          ))}
        </div>
      )}
      {c.status === 'open' && (
        <div className="mt-3 flex gap-2">
          <ActionButton check={check} onClick={() => dispatch(voteCandidacy, { candidacyId: c.id, vote: 'yes' })}>
            Vote yes
          </ActionButton>
          <ActionButton variant="secondary" check={check} onClick={() => dispatch(voteCandidacy, { candidacyId: c.id, vote: 'no' })}>
            Vote no
          </ActionButton>
        </div>
      )}
    </Card>
  );
}

function Removal({ r }: { r: RemovalVote }) {
  const s = useLabState();
  const me = useMeUser();
  const dispatch = useLab((st) => st.dispatch);
  const t = removalTally(s, r);
  const check = canVoteRemoval(s, me.id, r.id);
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-xs uppercase tracking-wider text-lab-red">BN removal · {REMOVAL_REASONS[r.reason]}</div>
          <UserLink id={r.targetUserId} className="text-lg" />
        </div>
        <span className={cx('rounded-full px-2 py-0.5 text-xs font-semibold', r.status === 'open' ? 'bg-lab-amber/20 text-lab-amber' : r.status === 'passed' ? 'bg-lab-red/20 text-lab-red' : 'bg-ink-700 text-slate-400')}>
          {r.status === 'open' ? `open · closes in ${fmtDuration(r.closesAt - s.now)}` : r.status}
        </span>
      </div>
      <p className="mt-2 text-sm text-slate-300">{r.note}</p>
      <p className="text-xs muted">
        Opened by {s.users[r.openedBy]?.username} on {fmtDate(r.openedAt)}
      </p>
      <div className="mt-3">
        <Tally
          label="NAT votes"
          yes={t.yes}
          no={t.no}
          base={t.members}
          pass={t.passes}
          need={`needs ${t.needed} yes (${Math.round(s.params.removalThreshold * 100)}% of ${t.members} NAT, ${s.params.removalRounding})`}
        />
      </div>
      {r.status === 'open' && (
        <div className="mt-3 flex gap-2">
          <ActionButton variant="danger" check={check} onClick={() => dispatch(voteRemoval, { voteId: r.id, vote: 'yes' })}>
            Vote to remove
          </ActionButton>
          <ActionButton variant="secondary" check={check} onClick={() => dispatch(voteRemoval, { voteId: r.id, vote: 'no' })}>
            Vote to keep
          </ActionButton>
        </div>
      )}
    </Card>
  );
}

export function VotesPage() {
  const s = useLabState();
  const me = useMeUser();
  const dispatch = useLab((st) => st.dispatch);
  const [target, setTarget] = useState('');
  const [reason, setReason] = useState<'bad_faith_nominations' | 'vouch_abuse'>('bad_faith_nominations');
  const [note, setNote] = useState('');
  const cands = Object.values(s.candidacies).sort((a, b) => Number(b.status === 'open') - Number(a.status === 'open') || b.opensAt - a.opensAt);
  const removals = Object.values(s.removalVotes).sort((a, b) => Number(b.status === 'open') - Number(a.status === 'open') || b.openedAt - a.openedAt);
  const targets = bnMembers(s).sort((a, b) => a.username.localeCompare(b.username));
  return (
    <div className="space-y-4">
      <h1 className="h1">Votes</h1>
      <RoleHint
        hints={{
          bn: 'BN votes on NAT candidates are optional and tallied separately from NAT votes.',
          nat: 'Your NAT vote on candidates is required. Removal votes need yes from 2/3 of all NAT members.',
          admin: 'Watch tallies here; switch to a BN or NAT persona to vote.',
        }}
      />
      <section>
        <h2 className="h2 mb-2">NAT candidacies</h2>
        {cands.length ? <div className="grid gap-3 lg:grid-cols-2">{cands.map((c) => <Candidacy key={c.id} c={c} />)}</div> : <Empty>No candidacies yet. Invites go out at the start of each season.</Empty>}
      </section>
      <section>
        <h2 className="h2 mb-2">BN removal votes</h2>
        {removals.length ? <div className="grid gap-3 lg:grid-cols-2">{removals.map((r) => <Removal key={r.id} r={r} />)}</div> : <Empty>No removal votes.</Empty>}
      </section>
      {me.isNAT && (
        <Card title="Open a removal vote">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="BN">
              <select className="input" value={target} onChange={(e) => setTarget(e.target.value)}>
                <option value="">Choose…</option>
                {targets.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.username}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Reason">
              <select className="input" value={reason} onChange={(e) => setReason(e.target.value as typeof reason)}>
                <option value="bad_faith_nominations">{REMOVAL_REASONS.bad_faith_nominations}</option>
                <option value="vouch_abuse">{REMOVAL_REASONS.vouch_abuse}</option>
              </select>
            </Field>
            <Field label="Note">
              <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
          </div>
          <div className="mt-3 flex justify-end">
            <ActionButton variant="danger" check={target ? canOpenRemoval(s, me.id, target) : fail('choose', 'Choose a BN first.')} onClick={() => dispatch(openRemovalVote, { targetId: target, reason, note })}>
              Open {s.params.removalVoteDays}-day vote
            </ActionButton>
          </div>
        </Card>
      )}
    </div>
  );
}
