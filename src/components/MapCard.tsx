// Beatmap card in the shape of osu-web's beatmapset-panel: cover behind, a play area on the
// left, and the info block over a b4 gradient. Copyright (c) ppy Pty Ltd; AGPL-3.0, see LICENCE.
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
import { AvatarStack, CategoryBadge, fmtCompact, MapCover, StatusBadge } from './ui';

export const WINDOW_LABEL: Record<StarWindow, string> = { recent: '30 d', season: 'season', year: 'year', all: 'all time' };

function StatItem({ label, value, title }: { label: string; value: string | number; title?: string }) {
  return (
    <span className="whitespace-nowrap" title={title}>
      <span className="font-bold text-white">{value}</span> <span className="text-slate-400">{label}</span>
    </span>
  );
}

export function MapCard({ map, starWindow = 'recent', rank }: { map: Beatmapset; starWindow?: StarWindow; rank?: number }) {
  const s = useLabState();
  const showStars = map.category !== null && map.status === 'ranked' && categoryFeatures(map.category).stars;
  const noms = activeNominations(s, map.id);
  const best = isBestOfLD(s, map.id);
  return (
    <Link to={`/beatmaps/${map.id}`} className="group relative block h-[120px] overflow-hidden rounded-xl bg-ink-700 text-slate-200 shadow transition-transform hover:text-slate-200">
      <MapCover map={map} className="absolute inset-0" />
      {/* beatmapset-panel__play: darkens on hover like osu-web's preview button. */}
      <div className="absolute inset-y-0 left-0 flex w-[90px] items-center justify-center transition-colors group-hover:bg-ink-950/70">
        {rank !== undefined && <span className="text-3xl font-extrabold text-white drop-shadow">#{rank}</span>}
      </div>
      <div
        className="relative ml-[90px] flex h-full flex-col justify-between rounded-xl px-3 py-2 transition-colors"
        style={{ background: 'linear-gradient(to right, hsl(var(--hsl-b4)), hsla(var(--hsl-b4), 0.85))' }}
      >
        <div className="min-w-0">
          <div className="truncate text-[15px] font-bold text-white group-hover:text-lab-rose">{map.title}</div>
          <div className="truncate text-[13px] text-slate-300">by {map.artist}</div>
          <div className="truncate text-xs text-slate-400">
            mapped by <span className="font-semibold text-slate-200">{s.users[map.mapperId]?.username}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
          {showStars ? (
            <StatItem label={`stars ${WINDOW_LABEL[starWindow]}`} value={starCount(s, map.id, starWindow)} title="Stars cast in this window" />
          ) : (
            <StatItem label="SR" value={maxStarRating(map).toFixed(2)} />
          )}
          <StatItem label="h played" value={fmtCompact(playTimeHours(s, map.id))} />
          <StatItem label="DLs" value={fmtCompact(uniqueDownloads(s, map.id))} title="Unique downloads" />
          {map.status === 'pending' && <StatItem label="noms" value={`${noms.length}/${s.params.nominationsRequired}`} />}
          {map.status === 'qualified' && <span className="text-lab-sky">{map.frozen ? 'frozen' : `ranks in ${fmtDuration(qualifiedRemainingMs(s, map))}`}</span>}
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap gap-1">
            <StatusBadge status={map.status} frozen={map.frozen} />
            <CategoryBadge category={map.category} />
            {map.isFA && <span className="beatmapset-status" style={{ background: 'hsl(var(--hsl-orange-1))' }}>FA</span>}
            {best && <span className="beatmapset-status" style={{ background: 'hsl(var(--hsl-pink-1))' }}>Best of LD</span>}
          </div>
          <AvatarStack ids={noms.map((n) => n.userId)} max={3} link={false} />
        </div>
      </div>
    </Link>
  );
}
