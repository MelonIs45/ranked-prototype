import { useMemo, useState } from 'react';
import { MapCard } from '../components/MapCard';
import { RoleHint } from '../components/Shell';
import { cx, Empty, Tabs } from '../components/ui';
import { GENRES, LANGUAGES, SKILL_TAGS } from '../data/words';
import { categoryFeatures, listMaps, type Category, type MapQuery, type MapStatus, type SortKey, type StarWindow } from '../engine';
import { useLabState } from '../store';

const SORT_LABEL: Record<SortKey, string> = {
  best_recent: 'Best (recent)',
  best_season: 'Best (seasonal)',
  best_year: 'Best (yearly)',
  best_all: 'Best (all time)',
  recent: 'Recent',
  plays: 'Plays',
  star_rating: 'Star rating',
  title: 'Title',
};
const SORT_WINDOW: Partial<Record<SortKey, StarWindow>> = { best_recent: 'recent', best_season: 'season', best_year: 'year', best_all: 'all' };
const STATUSES: MapStatus[] = ['ranked', 'qualified', 'pending', 'wip', 'graveyard'];

function readCategory(): Category | null {
  try {
    const v = sessionStorage.getItem('rl-category');
    return v === 'mechanics' || v === 'level_design' ? v : null;
  } catch {
    return null;
  }
}

export function BeatmapsPage() {
  const s = useLabState();
  const [category, setCategoryState] = useState<Category | null>(readCategory);
  const [status, setStatus] = useState<MapStatus>('ranked');
  const [sort, setSort] = useState<SortKey | null>(null);
  const [filters, setFilters] = useState<Omit<MapQuery, 'status' | 'category' | 'sort'>>({});
  const setCategory = (c: Category) => {
    setCategoryState(c);
    setSort(null);
    try {
      sessionStorage.setItem('rl-category', c);
    } catch {
      /* ignore */
    }
  };
  const features = category ? categoryFeatures(category) : null;
  const effectiveSort: SortKey = sort && features?.sorts.includes(sort) ? sort : status === 'ranked' && features ? features.defaultSort : 'recent';
  const maps = useMemo(
    () => (category ? listMaps(s, { status, category, sort: status === 'ranked' ? effectiveSort : 'recent', ...filters }) : []),
    [s, category, status, effectiveSort, filters],
  );

  if (!category) {
    return (
      <div className="mx-auto max-w-3xl py-6">
        <h1 className="h1 mb-1 text-center">Choose a ranked category</h1>
        <p className="mb-6 text-center muted">Ranked is split in two. Both have leaderboards and pp; you can switch any time with the tabs.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <button onClick={() => setCategory('mechanics')} className="card text-left transition-colors hover:border-lab-sky/60">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-lab-sky">Ranked</div>
            <div className="text-2xl font-bold text-white">{s.params.categoryNames.mechanics}</div>
            <p className="mt-2 text-sm muted">Maps built to test skill: aim, streams, speed, precision. Plain sorts by recency, plays and star rating.</p>
          </button>
          <button onClick={() => setCategory('level_design')} className="card text-left transition-colors hover:border-lab-violet/60">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-lab-violet">Ranked</div>
            <div className="text-2xl font-bold text-white">{s.params.categoryNames.levelDesign}</div>
            <p className="mt-2 text-sm muted">Maps built around expression and design. BNs shoot stars at the best ones, which drive the Best sorts, packs and rewards.</p>
          </button>
        </div>
      </div>
    );
  }

  const counts = Object.fromEntries(STATUSES.map((st) => [st, listMaps(s, { status: st, category }).length]));
  const toggleTag = (t: string) =>
    setFilters((f) => ({ ...f, skillTags: f.skillTags?.includes(t) ? f.skillTags.filter((x) => x !== t) : [...(f.skillTags ?? []), t] }));

  return (
    <div>
      <RoleHint
        hints={{
          player: 'Open a map to play or download it. Qualified maps can be reported if something looks wrong.',
          bn: category === 'level_design' ? 'Shoot stars at ranked Level Design maps you did not map or nominate. Pending maps wait for your nomination.' : 'Pending maps here wait for nominations. Mechanics maps have no stars.',
          mapper: 'Find a BN who likes your genre in the BN directory, then wait for nominations on your Pending map.',
        }}
      />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs<Category>
          value={category}
          onChange={setCategory}
          options={[
            { value: 'level_design', label: `Ranked · ${s.params.categoryNames.levelDesign}` },
            { value: 'mechanics', label: `Ranked · ${s.params.categoryNames.mechanics}` },
          ]}
        />
        <input className="input max-w-xs" placeholder="Search title, artist, mapper" value={filters.search ?? ''} onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value || undefined }))} />
      </div>
      <div className="mb-3">
        <Tabs<MapStatus> value={status} onChange={setStatus} options={STATUSES.map((st) => ({ value: st, label: st === 'wip' ? 'WIP' : st[0].toUpperCase() + st.slice(1), count: counts[st] }))} />
      </div>
      {(status === 'wip' || status === 'graveyard') && <p className="mb-3 text-xs muted">WIP and graveyard maps are listed across both categories (the mapper picks one when moving to Pending).</p>}

      <div className="mb-4 grid gap-3 rounded bg-ink-900 p-3 shadow md:grid-cols-[auto_1fr]">
        {status === 'ranked' && (
          <div>
            <div className="label">Sort</div>
            <div className="flex flex-wrap gap-1">
              {features!.sorts.map((k) => (
                <button key={k} className={cx('chip', k === effectiveSort && 'chip-on')} onClick={() => setSort(k)}>
                  {SORT_LABEL[k]}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="flex flex-wrap items-end gap-2">
          {category === 'level_design' && status === 'ranked' && (
            <button className={cx('chip', filters.bestOfLD && 'chip-on')} onClick={() => setFilters((f) => ({ ...f, bestOfLD: !f.bestOfLD || undefined }))}>
              Best of {s.params.categoryNames.levelDesign}
            </button>
          )}
          <button className={cx('chip', filters.faOnly && 'chip-on')} onClick={() => setFilters((f) => ({ ...f, faOnly: !f.faOnly || undefined }))}>
            FA only
          </button>
          <select className="input w-auto py-1 text-xs" value={filters.genre ?? ''} onChange={(e) => setFilters((f) => ({ ...f, genre: e.target.value || undefined }))} aria-label="Genre">
            <option value="">Any genre</option>
            {GENRES.map((g) => (
              <option key={g}>{g}</option>
            ))}
          </select>
          <select className="input w-auto py-1 text-xs" value={filters.language ?? ''} onChange={(e) => setFilters((f) => ({ ...f, language: e.target.value || undefined }))} aria-label="Language">
            <option value="">Any language</option>
            {LANGUAGES.map((g) => (
              <option key={g}>{g}</option>
            ))}
          </select>
          <span className="flex items-center gap-1 text-xs muted">
            SR
            <input type="number" step="0.5" min="0" className="input w-16 py-1 text-xs" placeholder="min" value={filters.srMin ?? ''} onChange={(e) => setFilters((f) => ({ ...f, srMin: e.target.value ? Number(e.target.value) : undefined }))} />
            –
            <input type="number" step="0.5" min="0" className="input w-16 py-1 text-xs" placeholder="max" value={filters.srMax ?? ''} onChange={(e) => setFilters((f) => ({ ...f, srMax: e.target.value ? Number(e.target.value) : undefined }))} />
          </span>
        </div>
        <div className="flex flex-wrap gap-1 md:col-span-2">
          {SKILL_TAGS.map((t) => (
            <button key={t} className={cx('chip', filters.skillTags?.includes(t) && 'chip-on')} onClick={() => toggleTag(t)}>
              {t}
            </button>
          ))}
        </div>
      </div>
      {category === 'mechanics' && status === 'ranked' && (
        <p className="mb-3 text-xs muted">
          {s.params.categoryNames.mechanics} has plain sorts only. Its visibility and rewards are left to that community; stars and the Best sorts apply to {s.params.categoryNames.levelDesign}.
        </p>
      )}
      {maps.length ? (
        <div className="grid gap-2.5 md:grid-cols-2">
          {maps.map((m) => (
            <MapCard key={m.id} map={m} starWindow={SORT_WINDOW[effectiveSort] ?? 'recent'} />
          ))}
        </div>
      ) : (
        <Empty>No maps match.</Empty>
      )}
    </div>
  );
}
