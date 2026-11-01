import { Link } from 'react-router-dom';
import { MapCard } from '../components/MapCard';
import { RoleHint } from '../components/Shell';
import { Card, Empty } from '../components/ui';
import { fmtDate, fmtDuration, homeTop, listMaps, seasonFor } from '../engine';
import { useLabState } from '../store';

const CHANGES = [
  ['Three nominations, then 15 days', 'Any three BNs qualify a map. It then spends 15 days under NAT supervision, and flags pause that clock while NAT review them.'],
  ['A daily nomination allowance', 'BNs earn one nomination a day, up to five. Too many disqualifications slow the rate. Staying a BN has no activity requirement.'],
  ['A Mapset Verifier gate', 'Unrankable checks block a normal nomination. Three BNs can sign an override petition with written reasons for NAT to approve or deny.'],
  ['Two ranked categories', 'Mechanics and Level Design both get leaderboards and pp. Stars, the Best sorts and the rewards apply to Level Design.'],
  ['Stars from BNs', 'BNs get 10 stars a week and NAT get 25. Each one returns 7 days after it is cast. Stars decide the Best sorts and the top 5 on this page.'],
  ['Points for nominators', "Each star at a map gives its nominators a leaderboard point for the season, and each month's most-starred maps become packs."],
];

export function HomePage() {
  const s = useLabState();
  const top = homeTop(s);
  const season = seasonFor(s.now, s.params);
  const latestLD = listMaps(s, { status: 'ranked', category: 'level_design', sort: 'recent' }).slice(0, 4);
  const latestMech = listMaps(s, { status: 'ranked', category: 'mechanics', sort: 'recent' }).slice(0, 4);
  return (
    <div className="space-y-6">
      <RoleHint
        hints={{
          player: 'Browse the top Level Design maps, play and download them. Switch personas in the header to try other roles.',
          mapper: 'Your maps live under My maps. Push a WIP to Pending and pick a category to start collecting nominations.',
          bn: 'Your allowance and star wallet are on the BN dashboard. Stars you cast decide what appears in the top 5 below.',
          nat: 'Flag cases and override petitions wait in the NAT queue, sorted by deadline.',
          admin: 'Use the clock to fast-forward, and the admin panel to change rules live or simulate crowd behaviour.',
        }}
      />
      <section className="grid gap-4 md:grid-cols-[1fr_240px]">
        <div>
          <div className="mb-3 flex items-end justify-between">
            <div>
              <h1 className="h1">Top {s.params.homeTopN} · {s.params.categoryNames.levelDesign}</h1>
              <p className="text-sm muted">By Best (recent): stars cast in the last {s.params.sort.recentWindowDays} days{s.params.sort.decayOn ? `, halving every ${s.params.sort.decayHalfLifeDays} days` : ''}.</p>
            </div>
            <Link to="/beatmaps" className="text-sm">
              All beatmaps
            </Link>
          </div>
          {top.length ? (
            <div className="grid gap-2">
              {top.map((m, i) => (
                <MapCard key={m.id} map={m} rank={i + 1} />
              ))}
            </div>
          ) : (
            <Empty>No Level Design maps have stars in the last {s.params.sort.recentWindowDays} days.</Empty>
          )}
        </div>
        <Card title="Season" className="self-start">
          <div className="text-3xl font-bold text-white">{season.label}</div>
          <div className="mt-1 text-sm muted">
            {fmtDate(season.startsAt)} – {fmtDate(season.endsAt - 1)}
          </div>
          <div className="mt-3 rounded-lg bg-ink-850 p-3">
            <div className="text-xs uppercase tracking-wide muted">Ends in</div>
            <div className="text-xl font-semibold text-lab-pink">{fmtDuration(season.endsAt - s.now)}</div>
          </div>
          <p className="mt-3 text-sm muted">
            At rollover the top {s.params.leaderboard.badgeCutoff} nominators on each board get a badge and the leaderboards reset.{' '}
            <Link to="/rewards">See the leaderboards</Link>
          </p>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {[
          ['level_design', latestLD],
          ['mechanics', latestMech],
        ].map(([cat, maps]) => (
          <div key={cat as string}>
            <h2 className="h2 mb-2">Latest ranked · {cat === 'level_design' ? s.params.categoryNames.levelDesign : s.params.categoryNames.mechanics}</h2>
            <div className="grid gap-2">
              {(maps as typeof latestLD).map((m) => (
                <MapCard key={m.id} map={m} />
              ))}
            </div>
          </div>
        ))}
      </section>

      <section>
        <h2 className="h2 mb-3">What changes in this proposal</h2>
        <ol className="space-y-0.5">
          {CHANGES.map(([t, d]) => (
            <li key={t} className="forum-item">
              <span className="forum-item-stripe" />
              <div>
                <div className="text-lg text-white">{t}</div>
                <p className="text-[13px] text-slate-300">{d}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
