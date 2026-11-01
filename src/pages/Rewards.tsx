import { Fragment, useMemo, useState } from 'react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { RoleHint } from '../components/Shell';
import { Card, cx, Empty, Tabs, UserLink, useMeUser } from '../components/ui';
import { DAY, fmtDate, leaderboard, nominatorIdsOf, seasonFor, type LeaderRow, type Season } from '../engine';
import { useLabState } from '../store';

const LINE_COLORS = ['#ff66aa', '#a37cff', '#66ccff', '#6fe0b0', '#ffc56b'];

function Board({ rows, cutoff }: { rows: LeaderRow[]; cutoff: number }) {
  const me = useMeUser();
  if (!rows.length) return <Empty>No points yet this season. Stars cast at nominated Level Design maps earn points.</Empty>;
  return (
    <ol className="space-y-0.5">
      {rows.slice(0, cutoff + 15).map((r) => (
        <Fragment key={r.userId}>
          <li className={cx('flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm', r.userId === me.id ? 'bg-lab-pink/15' : r.rank <= cutoff ? 'bg-ink-850' : '')}>
            <span className={cx('w-7 text-right font-mono', r.rank <= 3 ? 'font-bold text-lab-amber' : 'text-slate-500')}>{r.rank}</span>
            <UserLink id={r.userId} className="flex-1" />
            <span className="font-semibold text-white">{r.points}</span>
          </li>
          {r.rank === cutoff && rows.length > cutoff && (
            <li className="my-1 flex items-center gap-2 text-[11px] uppercase tracking-wider text-lab-pink" aria-label="Badge cutoff">
              <span className="flex-1 border-t-2 border-dashed border-lab-pink/60" /> badge cutoff (top {cutoff}) <span className="flex-1 border-t-2 border-dashed border-lab-pink/60" />
            </li>
          )}
        </Fragment>
      ))}
    </ol>
  );
}

function Trend({ season, board }: { season: Season; board: 'main' | 'fa' }) {
  const s = useLabState();
  const data = useMemo(() => {
    const end = Math.min(season.endsAt, s.now);
    const top = leaderboard(s, season, board, end).slice(0, 5).map((r) => r.userId);
    const stars = Object.values(s.stars)
      .filter((st) => st.at >= season.startsAt && st.at < end && s.maps[st.mapId]?.category === 'level_design')
      .filter((st) => (board === 'fa' ? s.maps[st.mapId].isFA : !s.maps[st.mapId].isFA || s.params.faStarsCountOnMain))
      .sort((a, b) => a.at - b.at);
    const totals: Record<string, number> = Object.fromEntries(top.map((id) => [id, 0]));
    const out: Record<string, number | string>[] = [];
    let i = 0;
    const step = Math.max(DAY, Math.ceil((end - season.startsAt) / 40 / DAY) * DAY);
    for (let t = season.startsAt; t <= end + step - 1; t += step) {
      const until = Math.min(t, end);
      while (i < stars.length && stars[i].at <= until) {
        for (const n of nominatorIdsOf(s, stars[i].mapId)) if (n in totals) totals[n]++;
        i++;
      }
      out.push({ day: fmtDate(until).replace(/, \d{4}$/, ''), ...Object.fromEntries(top.map((id) => [s.users[id].username, totals[id]])) });
    }
    return { out, names: top.map((id) => s.users[id].username) };
  }, [s, season, board]);
  if (!data.names.length) return null;
  return (
    <div className="h-56">
      <ResponsiveContainer>
        <LineChart data={data.out} margin={{ left: -20, right: 8, top: 6 }}>
          <CartesianGrid stroke="#2f2542" vertical={false} />
          <XAxis dataKey="day" tick={{ fill: '#94a3b8', fontSize: 11 }} minTickGap={24} />
          <YAxis allowDecimals={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
          <Tooltip contentStyle={{ background: '#1c1628', border: '1px solid #3d3155', borderRadius: 8 }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {data.names.map((n, i) => (
            <Line key={n} type="stepAfter" dataKey={n} stroke={LINE_COLORS[i]} dot={false} strokeWidth={2} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function RewardsPage() {
  const s = useLabState();
  const current = seasonFor(s.now, s.params);
  const seasonIds = [...new Set(Object.values(s.badges).filter((b) => b.season && b.type.startsWith('bn_top')).map((b) => b.season!))].sort().reverse();
  const [view, setView] = useState<string>(current.id);
  const [board, setBoard] = useState<'main' | 'fa'>('main');
  const season = view === current.id ? current : (() => {
    // Reconstruct a past season from its id by walking back from the current one.
    let t = current.startsAt - 1;
    for (let i = 0; i < 12; i++) {
      const se = seasonFor(t, s.params);
      if (se.id === view) return se;
      t = se.startsAt - 1;
    }
    return current;
  })();
  const cutoff = s.params.leaderboard.badgeCutoff;
  const rows = leaderboard(s, season, board, Math.min(s.now, season.endsAt - 1));
  const pastBadges = Object.values(s.badges).filter((b) => b.season === view && b.type === (board === 'main' ? 'bn_top_main' : 'bn_top_fa')).sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));
  return (
    <div className="space-y-4">
      <h1 className="h1">Nominator rewards</h1>
      <RoleHint
        hints={{
          player: 'Every star cast at a Level Design map gives +1 point to each of its nominators.',
          bn: `Finish in the top ${cutoff} of either board at season end for a badge (max 2 per season). Your own stars can't go to maps you nominated.`,
        }}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Tabs<'main' | 'fa'> value={board} onChange={setBoard} options={[{ value: 'main', label: 'Main leaderboard' }, { value: 'fa', label: 'Featured Artist' }]} />
        <select className="input w-auto" value={view} onChange={(e) => setView(e.target.value)} aria-label="Season">
          <option value={current.id}>{current.label} (current)</option>
          {seasonIds.filter((id) => id !== current.id).map((id) => (
            <option key={id} value={id}>
              {id.replace('-S', ' Q')}
            </option>
          ))}
        </select>
        <span className="text-sm muted">
          {board === 'fa' ? 'Stars at Featured Artist maps.' : s.params.faStarsCountOnMain ? 'All Level Design stars (FA stars count on both boards).' : 'Non-FA Level Design stars only.'}
        </span>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <Card title={`${season.label} · ${board === 'main' ? 'Main' : 'FA'}`} action={<span className="text-xs muted">{view === current.id ? 'live' : 'final'}</span>}>
          <Board rows={rows} cutoff={cutoff} />
        </Card>
        <div className="space-y-4">
          <Card title="Top 5 trend">
            <Trend season={season} board={board} />
            {!rows.length && <div className="text-sm muted">No data.</div>}
          </Card>
          <Card title={view === current.id ? 'Badges at rollover' : `Badge winners · ${season.label}`}>
            {view === current.id ? (
              <p className="text-sm muted">
                When {season.label} ends, the top {cutoff} on each board get {board === 'main' ? '"bn_top_main"' : '"bn_top_fa"'} badges and both boards reset. Use “End of season” in the clock bar to see it happen.
              </p>
            ) : pastBadges.length ? (
              <div className="flex flex-wrap gap-1.5">
                {pastBadges.map((b) => (
                  <span key={b.id} className="chip">
                    #{b.rank} {s.users[b.userId]?.username}
                  </span>
                ))}
              </div>
            ) : (
              <div className="text-sm muted">No badges for this board.</div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
