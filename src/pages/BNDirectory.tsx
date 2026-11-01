import { useState } from 'react';
import { RoleHint } from '../components/Shell';
import { Card, cx, Empty, RoleBadges, UserLink } from '../components/ui';
import { GENRES, SKILL_TAGS } from '../data/words';
import { allNominators, categoryName, starWallet, type Category } from '../engine';
import { useLabState } from '../store';

export function BNDirectoryPage() {
  const s = useLabState();
  const [openOnly, setOpenOnly] = useState(true);
  const [genre, setGenre] = useState('');
  const [skill, setSkill] = useState('');
  const [cat, setCat] = useState<Category | ''>('');
  const list = allNominators(s)
    .map((u) => ({ u, p: s.bnProfiles[u.id] }))
    .filter(({ p }) => p && (!openOnly || p.open) && (!genre || p.genres.includes(genre)) && (!skill || p.skillsets.includes(skill)) && (!cat || p.categories.includes(cat)))
    .sort((a, b) => Number(b.p.open) - Number(a.p.open) || a.u.username.localeCompare(b.u.username));
  return (
    <div>
      <h1 className="h1 mb-1">BN directory</h1>
      <p className="mb-4 text-sm muted">Find a nominator whose genres, skillsets and category match your map.</p>
      <RoleHint
        hints={{
          mapper: 'Filter by your map\'s genre and category, then follow the BN\'s request instructions.',
          player: 'Mappers use this page to find a matching BN.',
          bn: 'Edit your own entry from the BN dashboard.',
        }}
      />
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-ink-700 bg-ink-900/60 p-3">
        <button className={cx('chip', openOnly && 'chip-on')} onClick={() => setOpenOnly((x) => !x)}>
          Open only
        </button>
        <select className="input w-auto py-1 text-xs" value={cat} onChange={(e) => setCat(e.target.value as Category | '')} aria-label="Category">
          <option value="">Any category</option>
          <option value="mechanics">{s.params.categoryNames.mechanics}</option>
          <option value="level_design">{s.params.categoryNames.levelDesign}</option>
        </select>
        <select className="input w-auto py-1 text-xs" value={genre} onChange={(e) => setGenre(e.target.value)} aria-label="Genre">
          <option value="">Any genre</option>
          {GENRES.map((g) => (
            <option key={g}>{g}</option>
          ))}
        </select>
        <select className="input w-auto py-1 text-xs" value={skill} onChange={(e) => setSkill(e.target.value)} aria-label="Skillset">
          <option value="">Any skillset</option>
          {SKILL_TAGS.map((g) => (
            <option key={g}>{g}</option>
          ))}
        </select>
        <span className="ml-auto text-xs muted">{list.length} nominators</span>
      </div>
      {list.length ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map(({ u, p }) => (
            <Card key={u.id}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <UserLink id={u.id} />
                  <div className="mt-1">
                    <RoleBadges user={u} />
                  </div>
                </div>
                <span className={cx('rounded-full px-2 py-0.5 text-xs font-semibold', p.open ? 'bg-lab-mint/15 text-lab-mint' : 'bg-ink-700 text-slate-400')}>{p.open ? 'Open' : 'Closed'}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-1">
                {p.categories.map((c) => (
                  <span key={c} className="chip">{categoryName(s.params, c)}</span>
                ))}
                {p.genres.map((g) => (
                  <span key={g} className="chip">{g}</span>
                ))}
                {p.skillsets.map((g) => (
                  <span key={g} className="chip border-lab-violet/40 text-violet-200">{g}</span>
                ))}
              </div>
              {p.requestInstructions && <p className="mt-3 text-sm text-slate-300">{p.requestInstructions}</p>}
              <div className="mt-2 text-xs muted">
                {s.nominators[u.id]?.allowanceAvailable ?? 0} nominations available · ★ {starWallet(s, u.id).available}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Empty>No nominators match those filters.</Empty>
      )}
    </div>
  );
}
