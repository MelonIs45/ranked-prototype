import { useState } from 'react';
import { Link } from 'react-router-dom';
import { RoleHint } from '../components/Shell';
import { ActionButton, Card, cx, Empty, Field, MapLink, Meter, Stat, useMeUser } from '../components/ui';
import { GENRES, SKILL_TAGS } from '../data/words';
import {
  accrualIntervalDays,
  canRespondInvite,
  canSubmitPortfolio,
  effectiveCooldownLevel,
  fmtDate,
  fmtDateTime,
  fmtDuration,
  isNominator,
  leaderboard,
  nextAccrualAt,
  nextVouchAt,
  respondNatInvite,
  seasonFor,
  starWallet,
  submitPortfolio,
  updateBNProfile,
  userNominations,
  type Category,
} from '../engine';
import { useLab, useLabState } from '../store';

function ProfileEditor() {
  const s = useLabState();
  const me = useMeUser();
  const dispatch = useLab((st) => st.dispatch);
  const p = s.bnProfiles[me.id] ?? { userId: me.id, open: false, genres: [], skillsets: [], categories: [], requestInstructions: '' };
  const [draft, setDraft] = useState(p);
  const toggle = <K extends 'genres' | 'skillsets' | 'categories'>(k: K, v: string) =>
    setDraft((d) => ({ ...d, [k]: (d[k] as string[]).includes(v) ? (d[k] as string[]).filter((x) => x !== v) : [...(d[k] as string[]), v] }));
  return (
    <Card title="My directory profile" action={<Link to="/bn/directory" className="text-sm">Directory →</Link>}>
      <label className="mb-3 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={draft.open} onChange={(e) => setDraft({ ...draft, open: e.target.checked })} /> Open for requests
      </label>
      <div className="label">Categories</div>
      <div className="mb-3 flex gap-1">
        {(['mechanics', 'level_design'] as Category[]).map((c) => (
          <button key={c} className={cx('chip', draft.categories.includes(c) && 'chip-on')} onClick={() => toggle('categories', c)}>
            {c === 'mechanics' ? s.params.categoryNames.mechanics : s.params.categoryNames.levelDesign}
          </button>
        ))}
      </div>
      <div className="label">Genres</div>
      <div className="mb-3 flex flex-wrap gap-1">
        {GENRES.map((g) => (
          <button key={g} className={cx('chip', draft.genres.includes(g) && 'chip-on')} onClick={() => toggle('genres', g)}>
            {g}
          </button>
        ))}
      </div>
      <div className="label">Skillsets</div>
      <div className="mb-3 flex flex-wrap gap-1">
        {SKILL_TAGS.map((g) => (
          <button key={g} className={cx('chip', draft.skillsets.includes(g) && 'chip-on')} onClick={() => toggle('skillsets', g)}>
            {g}
          </button>
        ))}
      </div>
      <Field label="Request instructions">
        <textarea className="input min-h-[60px]" value={draft.requestInstructions} onChange={(e) => setDraft({ ...draft, requestInstructions: e.target.value })} />
      </Field>
      <div className="mt-3 flex justify-end">
        <button className="btn-primary" onClick={() => dispatch(updateBNProfile, { open: draft.open, genres: draft.genres, skillsets: draft.skillsets, categories: draft.categories, requestInstructions: draft.requestInstructions })}>
          Save profile
        </button>
      </div>
    </Card>
  );
}

function NatInviteCard() {
  const s = useLabState();
  const me = useMeUser();
  const dispatch = useLab((st) => st.dispatch);
  const inv = s.natInvites[me.id];
  const [text, setText] = useState('');
  const [links, setLinks] = useState('');
  if (!inv || me.isNAT || inv.status === 'declined') return null;
  const linkList = links.split(/\s+/).filter(Boolean);
  return (
    <Card title="NAT invitation" className="border-lab-pink/40">
      {inv.status === 'pending' && (
        <>
          <p className="mb-3 text-sm">
            You were invited to the NAT on {fmtDate(inv.invitedAt)} ({inv.cycle === 'founding' ? 'founding cycle for legacy BNs: accepting joins directly' : `cycle ${inv.cycle}: accepting leads to a portfolio and a ${s.params.natVoteDays}-day vote`}).
          </p>
          <div className="flex gap-2">
            <ActionButton check={canRespondInvite(s, me.id)} onClick={() => dispatch(respondNatInvite, { accept: true })}>
              Accept
            </ActionButton>
            <ActionButton variant="secondary" check={canRespondInvite(s, me.id)} onClick={() => dispatch(respondNatInvite, { accept: false })}>
              Decline
            </ActionButton>
          </div>
        </>
      )}
      {inv.status === 'accepted' && (
        <>
          <p className="mb-3 text-sm muted">Submit a modding portfolio. Submission opens a {s.params.natVoteDays}-day vote where either a BN or a NAT majority accepts you.</p>
          <Field label="Portfolio">
            <textarea className="input min-h-[90px]" value={text} onChange={(e) => setText(e.target.value)} placeholder="What have you modded, and how?" />
          </Field>
          <div className="mt-2">
            <Field label="Map links (up to 10, space separated)" hint={`${linkList.length}/10`}>
              <input className="input" value={links} onChange={(e) => setLinks(e.target.value)} placeholder="#/beatmaps/m12 #/beatmaps/m40" />
            </Field>
          </div>
          <div className="mt-3 flex justify-end">
            <ActionButton check={canSubmitPortfolio(s, me.id, text, linkList)} onClick={() => dispatch(submitPortfolio, { text, links: linkList })}>
              Submit portfolio
            </ActionButton>
          </div>
        </>
      )}
      {inv.status === 'submitted' && (
        <p className="text-sm">
          Your candidacy vote is open. <Link to="/votes">See the tally →</Link>
        </p>
      )}
    </Card>
  );
}

export function BNDashboardPage() {
  const s = useLabState();
  const me = useMeUser();
  if (!isNominator(me)) return <Empty>The BN dashboard is for BNs and NAT. Switch to LegacyNom, FreshBN or ProblemNom in the header, or <Link to="/bn/apply">apply</Link>.</Empty>;
  const ns = s.nominators[me.id];
  const p = s.params;
  const w = starWallet(s, me.id);
  const lvl = effectiveCooldownLevel(p, ns, s.now);
  const interval = accrualIntervalDays(p, ns, s.now);
  const next = nextAccrualAt(p, ns, s.now);
  const noms = userNominations(s, me.id).sort((a, b) => b.at - a.at);
  const myFlags = Object.values(s.flags).filter((f) => f.userId === me.id && f.source === 'bn').sort((a, b) => b.at - a.at);
  const vouchAt = nextVouchAt(s, me.id);
  const season = seasonFor(s.now, p);
  const mainRow = leaderboard(s, season, 'main').find((r) => r.userId === me.id);
  const faRow = leaderboard(s, season, 'fa').find((r) => r.userId === me.id);
  const outcome = (n: (typeof noms)[number]) => {
    const m = s.maps[n.mapId];
    if (n.voidedAt) {
      const dq = Object.values(s.dqs).find((d) => d.mapId === n.mapId && d.at === n.voidedAt);
      return dq ? <span className="text-lab-red">DQ'd {fmtDate(n.voidedAt)}</span> : <span className="muted">voided {fmtDate(n.voidedAt)}</span>;
    }
    if (m.status === 'ranked') return <span className="text-lab-mint">Ranked</span>;
    if (m.status === 'qualified') return <span className="text-lab-sky">Qualified{m.frozen ? ' (frozen)' : ''}</span>;
    return <span className="text-lab-amber">Pending</span>;
  };

  return (
    <div className="space-y-4">
      <h1 className="h1">BN dashboard</h1>
      <RoleHint hints={{ bn: 'Nominations accrue +1 per day up to the cap. Stars return 7 days after you cast them; bonus stars expire.', nat: 'As NAT you also nominate and get 25 stars a week. Your review queue is under NAT.' }} />
      <NatInviteCard key={me.id} />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Nomination allowance">
          <div className="flex items-end gap-2">
            <span className="text-4xl font-bold text-white">{ns.allowanceAvailable}</span>
            <span className="mb-1 muted">/ {p.allowanceCap}</span>
          </div>
          <Meter className="my-2" value={ns.allowanceAvailable} max={p.allowanceCap} color="bg-lab-violet" />
          <div className="text-sm muted">
            {ns.allowanceAvailable >= p.allowanceCap ? 'Full. Spending one restarts the accrual timer.' : `Next +1 in ${fmtDuration(next - s.now)} (${fmtDateTime(next)}).`}
          </div>
          <div className="mt-1 text-sm muted">Accrual: every {interval} day{interval === 1 ? '' : 's'}.</div>
        </Card>
        <Card title="Cooldown">
          {lvl === 0 ? (
            <div className="text-lab-mint">No cooldown. Accrual at the normal rate.</div>
          ) : (
            <div className="space-y-1 text-sm">
              <div className="text-2xl font-bold text-lab-amber">Level {lvl}</div>
              {ns.cooldownLevel > 0 && (
                <div>
                  DQ cooldown level {ns.cooldownLevel}, resets {ns.cooldownUntil ? `in ${fmtDuration(ns.cooldownUntil - s.now)}` : ''} without a new trigger.
                </div>
              )}
              {ns.abuseSlowUntil && ns.abuseSlowUntil > s.now && <div>Flag-abuse slowdown +{ns.abuseSlowLevels} level(s) until {fmtDate(ns.abuseSlowUntil)}.</div>}
            </div>
          )}
          <p className="mt-2 text-xs muted">
            Triggers: {p.dqCooldownTriggers.map((t) => `≥${t.count} DQs in ${t.days} days`).join(' or ')}. Levels accrue every {p.cooldownAccrualDays.join(' / ')} days.
          </p>
          {ns.flagStrikes > 0 && <p className="mt-2 text-sm text-lab-red">Flag-abuse strikes: {ns.flagStrikes}</p>}
        </Card>
        <Card title="Star wallet">
          <div className="flex items-end gap-2">
            <span className="text-4xl font-bold text-lab-amber">★ {w.available}</span>
            <span className="mb-1 muted">available</span>
          </div>
          <div className="mt-1 text-sm muted">
            {w.availableBase}/{w.weekly} weekly{w.availableBonus ? ` + ${w.availableBonus} bonus` : ''}
          </div>
          {w.spentBase.length > 0 && (
            <div className="mt-2">
              <div className="label">Returning</div>
              <ul className="max-h-28 space-y-0.5 overflow-y-auto text-xs">
                {w.spentBase.map((st) => (
                  <li key={st.id} className="flex justify-between gap-2">
                    <span className="truncate muted">{s.maps[st.mapId]?.title}</span>
                    <span>returns {fmtDateTime(st.replenishAt!)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {w.bonus.length > 0 && (
            <div className="mt-2">
              <div className="label">Bonus</div>
              <ul className="space-y-0.5 text-xs">
                {w.bonus.map((g) => (
                  <li key={g.id} className="flex justify-between gap-2">
                    <span>+{g.remaining} from {s.maps[g.sourceMapId]?.title}</span>
                    <span className="text-lab-amber">{g.expiresAt ? `expires ${fmtDateTime(g.expiresAt)}` : 'permanent'}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Season points (main)" value={mainRow?.points ?? 0} sub={mainRow ? `rank #${mainRow.rank}` : 'not ranked yet'} />
        <Stat label="Season points (FA)" value={faRow?.points ?? 0} sub={faRow ? `rank #${faRow.rank}` : 'not ranked yet'} />
        <Stat label="Vouches" value={vouchAt && vouchAt > s.now ? '0 left' : '1 available'} sub={vouchAt && vouchAt > s.now ? `next in ${fmtDuration(vouchAt - s.now)}` : 'Vouch from a user\'s profile'} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={`My nominations (${noms.length})`}>
          {noms.length ? (
            <table className="responsive w-full text-sm">
              <thead className="text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="pb-2">Map</th>
                  <th className="pb-2">Date</th>
                  <th className="pb-2">Outcome</th>
                </tr>
              </thead>
              <tbody>
                {noms.slice(0, 40).map((n) => (
                  <tr key={n.id} className="table-row">
                    <td data-label="Map" className="max-w-[220px] truncate py-1.5"><MapLink map={s.maps[n.mapId]} /></td>
                    <td data-label="Date" className="py-1.5 muted">{fmtDate(n.at)}{n.viaOverride && ' · override'}</td>
                    <td data-label="Outcome" className="py-1.5">{outcome(n)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <Empty>No nominations yet. <Link to="/beatmaps">Find a Pending map →</Link></Empty>
          )}
        </Card>
        <div className="space-y-4">
          <Card title={`My flags (${myFlags.length})`}>
            {myFlags.length ? (
              <ul className="space-y-1.5 text-sm">
                {myFlags.map((f) => (
                  <li key={f.id} className="rounded-lg bg-ink-850 p-2">
                    <MapLink map={s.maps[f.mapId]} />
                    <div className="text-xs muted">
                      {fmtDate(f.at)} · {f.reasonCategory} · {f.caseId ? `case ${s.cases[f.caseId]?.outcome ?? 'open'}` : 'no case yet'}
                      {f.markedAbusive && <span className="text-lab-red"> · marked abusive</span>}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-sm muted">No flags raised.</div>
            )}
          </Card>
          <ProfileEditor key={me.id} />
        </div>
      </div>
    </div>
  );
}
