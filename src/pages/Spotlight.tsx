import { RoleHint } from '../components/Shell';
import { Card, cx, Empty, MapLink, Meter, useMeUser } from '../components/ui';
import { fmtDate, fmtDuration, playlistProgress, previousSeason, seasonFor, seasonPlaylist, type Season } from '../engine';
import { useLabState } from '../store';

function Playlist({ season, live }: { season: Season; live: boolean }) {
  const s = useLabState();
  const me = useMeUser();
  const list = seasonPlaylist(s, season, live ? s.now : season.endsAt);
  const pr = playlistProgress(s, me.id, list, live ? s.now : season.endsAt);
  const earned = Object.values(s.badges).filter((b) => b.type === 'best_of_ld' && b.season === season.id);
  const mine = earned.some((b) => b.userId === me.id);
  return (
    <Card title={`${season.label} playlist`} action={<span className="text-xs muted">{live ? `ends in ${fmtDuration(season.endsAt - s.now)}` : `ended ${fmtDate(season.endsAt)}`}</span>}>
      {list.length ? (
        <>
          <div className="mb-1 flex justify-between text-sm">
            <span>
              {me.username}: {pr.cleared}/{pr.total} cleared
            </span>
            {mine && <span className="font-semibold text-lab-mint">badge earned</span>}
          </div>
          <Meter value={pr.cleared} max={pr.total} color={pr.cleared === pr.total ? 'bg-lab-mint' : 'bg-lab-pink'} />
          <ul className="mt-3 space-y-1">
            {list.map((m) => (
              <li key={m.id} className="flex items-center gap-2 text-sm">
                <span className={cx('w-16 shrink-0 text-[10px] font-semibold uppercase tracking-wider', pr.clearedIds.has(m.id) ? 'text-lab-mint' : 'text-slate-500')}>{pr.clearedIds.has(m.id) ? 'Cleared' : 'Not yet'}</span>
                <MapLink map={m} className="truncate" />
              </li>
            ))}
          </ul>
        </>
      ) : (
        <Empty>No Best of {s.params.categoryNames.levelDesign} maps yet for this season. The first monthly snapshot lands {s.params.pack.snapshotDelayDays} days after a month ends.</Empty>
      )}
      {!live && <p className="mt-3 text-xs muted">{earned.length} player(s) earned the best_of_ld badge.</p>}
      {live && list.length > 0 && <p className="mt-3 text-xs muted">Clear every map with the Play button before the season ends to earn the badge. More maps join as the season's packs are snapshotted.</p>}
    </Card>
  );
}

export function SpotlightPage() {
  const s = useLabState();
  const cur = seasonFor(s.now, s.params);
  const prev = previousSeason(s.now, s.params);
  return (
    <div className="space-y-4">
      <h1 className="h1">Seasonal spotlight · Best of {s.params.categoryNames.levelDesign}</h1>
      <RoleHint hints={{ player: 'Every Best of Level Design map from the season\'s monthly packs. Play them all by season end for a badge.' }} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Playlist season={cur} live />
        <Playlist season={prev} live={false} />
      </div>
    </div>
  );
}
