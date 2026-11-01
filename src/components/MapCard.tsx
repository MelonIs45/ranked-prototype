import { Link } from 'react-router-dom';
import {
  activeNominations,
  categoryFeatures,
  isBestOfLD,
  maxStarRating,
  playTimeHours,
  qualifiedRemainingMs,
  starCount,
  uniqueDownloads,
  fmtDuration,
  type Beatmapset,
  type StarWindow,
} from '../engine';
import { useLabState } from '../store';
import { AvatarStack, CategoryBadge, cx, fmtCompact, MapCover, StatusBadge } from './ui';

export const WINDOW_LABEL: Record<StarWindow, string> = { recent: '30 d', season: 'season', year: 'year', all: 'all time' };

export function MapCard({ map, starWindow = 'recent', rank }: { map: Beatmapset; starWindow?: StarWindow; rank?: number }) {
  const s = useLabState();
  const showStars = map.category !== null && map.status === 'ranked' && categoryFeatures(map.category).stars;
  const noms = activeNominations(s, map.id);
  const best = isBestOfLD(s, map.id);
  return (
    <Link to={`/beatmaps/${map.id}`} className="group block overflow-hidden rounded-xl border border-ink-700 bg-ink-900 text-slate-200 transition-colors hover:border-lab-pink/50 hover:text-slate-200">
      <MapCover map={map} className="h-20" />
      <div className="relative -mt-16 flex items-start justify-between gap-2 px-3">
        <div className="flex flex-wrap gap-1">
          <StatusBadge status={map.status} frozen={map.frozen} />
          {map.isFA && <span className="rounded-md bg-lab-amber/90 px-1.5 py-0.5 text-[11px] font-bold text-ink-950">FA</span>}
          {best && <span className="rounded-md bg-lab-pink/90 px-1.5 py-0.5 text-[11px] font-bold text-ink-950">Best of LD</span>}
        </div>
        {rank !== undefined && <span className="rounded-md bg-ink-950/80 px-2 py-0.5 text-sm font-bold text-white">#{rank}</span>}
      </div>
      <div className="relative mt-7 px-3 pb-3">
        <div className="truncate text-[15px] font-semibold text-white group-hover:text-lab-rose">{map.title}</div>
        <div className="truncate text-sm muted">{map.artist}</div>
        <div className="mt-1 flex items-center gap-2 text-xs muted">
          <span className="truncate">mapped by {s.users[map.mapperId]?.username}</span>
          <CategoryBadge category={map.category} />
        </div>
        <div className="mt-2 grid grid-cols-3 gap-1 text-[11px] leading-tight">
          {showStars ? (
            <div title={`Stars cast in the ${WINDOW_LABEL[starWindow]} window`}>
              <div className="text-sm font-semibold text-lab-amber">{starCount(s, map.id, starWindow)}</div>
              <div className="muted">stars, {WINDOW_LABEL[starWindow]}</div>
            </div>
          ) : (
            <div>
              <div className="text-sm font-semibold text-white">{maxStarRating(map).toFixed(2)}</div>
              <div className="muted">top SR</div>
            </div>
          )}
          <div title="Total play time across all plays">
            <div className="text-sm font-semibold text-white">{fmtCompact(playTimeHours(s, map.id))} h</div>
            <div className="muted">played</div>
          </div>
          <div title="Distinct users who downloaded">
            <div className="text-sm font-semibold text-white">{fmtCompact(uniqueDownloads(s, map.id))}</div>
            <div className="muted">unique DLs</div>
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between gap-2 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="muted">Noms</span>
            <AvatarStack ids={noms.map((n) => n.userId)} max={3} link={false} />
          </span>
          {map.status === 'qualified' && (
            <span className={cx(map.frozen ? 'text-lab-sky' : 'muted')}>{map.frozen ? 'Frozen' : `ranks in ${fmtDuration(qualifiedRemainingMs(s, map))}`}</span>
          )}
          {map.status === 'pending' && (
            <span className="muted">
              {noms.length}/{s.params.nominationsRequired}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
