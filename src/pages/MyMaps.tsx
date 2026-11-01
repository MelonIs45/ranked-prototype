import { useState } from 'react';
import { Link } from 'react-router-dom';
import { RoleHint } from '../components/Shell';
import { ActionButton, Card, CategoryBadge, cx, Empty, Field, Meter, Modal, StatusBadge, useMeUser } from '../components/ui';
import { DIFF_NAMES, GENRES, LANGUAGES, MV_CATALOGUE, SKILL_TAGS } from '../data/words';
import {
  activeNominations,
  canMoveToPending,
  canRevive,
  categoryName,
  createMap,
  DAY,
  fmtDuration,
  mapsBy,
  moveToPending,
  openPetition,
  activeSignatures,
  qualifiedRemainingMs,
  reviveMap,
  touchMap,
  canEditMap,
  type Category,
  type Difficulty,
  type MVIssue,
} from '../engine';
import { useLab, useLabState } from '../store';

const blankDiff = (i: number): Difficulty => ({ name: DIFF_NAMES[Math.min(i + 2, 5)], starRating: 3 + i, skillTags: [], lengthSec: 180 });

function CreateMapForm({ onDone }: { onDone: () => void }) {
  const dispatch = useLab((st) => st.dispatch);
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [genre, setGenre] = useState(GENRES[0]);
  const [language, setLanguage] = useState(LANGUAGES[0]);
  const [isFA, setFA] = useState(false);
  const [description, setDescription] = useState('');
  const [diffs, setDiffs] = useState<Difficulty[]>([blankDiff(0), blankDiff(1)]);
  const [issues, setIssues] = useState<string[]>([]);
  const upd = (i: number, patch: Partial<Difficulty>) => setDiffs((d) => d.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  const submit = () => {
    const mvIssues: MVIssue[] = MV_CATALOGUE.filter((m) => issues.includes(m.check)).map((m) => ({ ...m }));
    const r = dispatch(createMap, { title, artist, genre, language, isFA, description, difficulties: diffs.map((d) => ({ ...d, lengthSec: diffs[0].lengthSec })), mvIssues });
    if (r) onDone();
  };
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Artist">
          <input className="input" value={artist} onChange={(e) => setArtist(e.target.value)} placeholder="Invented artist" />
        </Field>
        <Field label="Title">
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Invented song title" />
        </Field>
        <Field label="Genre">
          <select className="input" value={genre} onChange={(e) => setGenre(e.target.value)}>
            {GENRES.map((g) => (
              <option key={g}>{g}</option>
            ))}
          </select>
        </Field>
        <Field label="Language">
          <select className="input" value={language} onChange={(e) => setLanguage(e.target.value)}>
            {LANGUAGES.map((g) => (
              <option key={g}>{g}</option>
            ))}
          </select>
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={isFA} onChange={(e) => setFA(e.target.checked)} /> Featured Artist track
      </label>
      <Field label="Description">
        <textarea className="input min-h-[60px]" value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>
      <div>
        <div className="label">Difficulties</div>
        <div className="space-y-2">
          {diffs.map((d, i) => (
            <div key={i} className="rounded-lg bg-ink-850 p-2">
              <div className="flex flex-wrap items-center gap-2">
                <input className="input w-32" value={d.name} onChange={(e) => upd(i, { name: e.target.value })} aria-label="Difficulty name" />
                <input type="number" step="0.1" min="0" className="input w-20" value={d.starRating} onChange={(e) => upd(i, { starRating: Number(e.target.value) })} aria-label="Star rating" />
                <span className="text-xs muted">SR</span>
                {i === 0 && (
                  <>
                    <input type="number" min="30" className="input w-20" value={d.lengthSec} onChange={(e) => upd(0, { lengthSec: Number(e.target.value) })} aria-label="Length in seconds" />
                    <span className="text-xs muted">sec</span>
                  </>
                )}
                {diffs.length > 1 && (
                  <button className="btn-ghost ml-auto px-2 text-xs" onClick={() => setDiffs((x) => x.filter((_, k) => k !== i))}>
                    Remove
                  </button>
                )}
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {SKILL_TAGS.map((t) => (
                  <button key={t} type="button" className={cx('chip', d.skillTags.includes(t) && 'chip-on')} onClick={() => upd(i, { skillTags: d.skillTags.includes(t) ? d.skillTags.filter((x) => x !== t) : [...d.skillTags, t] })}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <button className="btn-secondary mt-2 text-xs" onClick={() => setDiffs((x) => [...x, blankDiff(x.length)])}>
          + Add difficulty
        </button>
      </div>
      <div>
        <div className="label">Seed Mapset Verifier issues (optional)</div>
        <div className="flex flex-wrap gap-1">
          {MV_CATALOGUE.map((m) => (
            <button key={m.check} type="button" className={cx('chip', issues.includes(m.check) && 'chip-on')} onClick={() => setIssues((x) => (x.includes(m.check) ? x.filter((y) => y !== m.check) : [...x, m.check]))}>
              {m.check} <span className={m.severity === 'unrankable' ? 'text-lab-red' : 'muted'}>({m.severity})</span>
            </button>
          ))}
        </div>
      </div>
      <div className="flex justify-end">
        <button className="btn-primary" onClick={submit}>
          Create map (WIP)
        </button>
      </div>
    </div>
  );
}

export function MyMapsPage() {
  const s = useLabState();
  const me = useMeUser();
  const dispatch = useLab((st) => st.dispatch);
  const [creating, setCreating] = useState(false);
  const [pick, setPick] = useState<{ mapId: string; mode: 'pending' | 'revive' } | null>(null);
  const [cat, setCat] = useState<Category>('level_design');
  const mine = mapsBy(s, me.id).sort((a, b) => b.lastActivityAt - a.lastActivityAt);
  const order = ['wip', 'pending', 'qualified', 'ranked', 'graveyard'] as const;
  const req = s.params.nominationsRequired;

  if (me.isAdmin) return <Empty>The admin persona doesn't map. Switch to a mapper persona such as PastelWaltz.</Empty>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="muted">Your maps across every status.</span>
        <button className="btn-primary" onClick={() => setCreating(true)}>
          + Create map
        </button>
      </div>
      <RoleHint
        hints={{
          player: 'Every user can map. Create a WIP, then move it to Pending with a category so BNs can nominate it.',
          mapper: 'Move WIPs to Pending with a category (editable until the first nomination). Idle WIP/Pending maps graveyard after ' + s.params.graveyardDays + ' days; bump or revive them here.',
        }}
      />
      {mine.length === 0 && <Empty>No maps yet.</Empty>}
      {order.map((st) => {
        const list = mine.filter((m) => m.status === st);
        if (!list.length) return null;
        return (
          <Card key={st} title={<span className="flex items-center gap-2"><StatusBadge status={st} /> <span className="text-sm muted">{list.length}</span></span>}>
            <div className="space-y-2">
              {list.map((m) => {
                const noms = activeNominations(s, m.id).length;
                const pet = openPetition(s, m.id);
                const idle = s.now - m.lastActivityAt;
                return (
                  <div key={m.id} className="flex flex-wrap items-center gap-3 rounded-lg bg-ink-850 p-3">
                    <div className="min-w-0 flex-1">
                      <Link to={`/beatmaps/${m.id}`} className="font-semibold text-white hover:text-lab-rose">
                        {m.title} <span className="font-normal muted">· {m.artist}</span>
                      </Link>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs muted">
                        <CategoryBadge category={m.category} />
                        {m.mapperId !== me.id && <span>guest difficulty</span>}
                        {(st === 'wip' || st === 'pending') && <span>idle {fmtDuration(idle)} · graveyards in {fmtDuration(m.lastActivityAt + s.params.graveyardDays * DAY - s.now)}</span>}
                        {st === 'qualified' && <span>{m.frozen ? 'frozen by a NAT case' : `ranks in ${fmtDuration(qualifiedRemainingMs(s, m))}`}</span>}
                        {pet && <span className="text-lab-amber">override petition {activeSignatures(pet).length}/{req}</span>}
                        {m.dqCount > 0 && <span className="text-lab-red">{m.dqCount} DQ</span>}
                      </div>
                      {st === 'pending' && <Meter className="mt-2 max-w-xs" value={noms} max={req} color="bg-lab-violet" />}
                    </div>
                    {st === 'pending' && <span className="text-sm font-semibold text-white">{noms}/{req}</span>}
                    {m.mapperId === me.id && st === 'wip' && (
                      <ActionButton check={canMoveToPending(s, me.id, m.id, 'mechanics')} onClick={() => { setCat(m.category ?? 'level_design'); setPick({ mapId: m.id, mode: 'pending' }); }}>
                        Move to Pending
                      </ActionButton>
                    )}
                    {m.mapperId === me.id && (st === 'wip' || st === 'pending') && (
                      <ActionButton variant="ghost" check={canEditMap(s, me.id, m.id)} onClick={() => dispatch(touchMap, { mapId: m.id })}>
                        Bump
                      </ActionButton>
                    )}
                    {m.mapperId === me.id && st === 'graveyard' && (
                      <ActionButton check={canRevive(s, me.id, m.id)} onClick={() => { setCat(m.category ?? 'level_design'); setPick({ mapId: m.id, mode: 'revive' }); }}>
                        Revive
                      </ActionButton>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })}

      <Modal open={creating} onClose={() => setCreating(false)} title="Create a map" wide>
        <CreateMapForm onDone={() => setCreating(false)} />
      </Modal>
      <Modal open={!!pick} onClose={() => setPick(null)} title={pick?.mode === 'revive' ? 'Revive to Pending' : 'Move to Pending'}>
        <p className="mb-3 text-sm muted">Pick a category. It stays editable until the first nomination.</p>
        <div className="grid grid-cols-2 gap-2">
          {(['mechanics', 'level_design'] as Category[]).map((c) => (
            <button key={c} onClick={() => setCat(c)} className={cx('rounded-lg border p-3 text-left', cat === c ? 'border-lab-pink bg-lab-pink/10' : 'border-ink-600')}>
              <div className="font-semibold text-white">{categoryName(s.params, c)}</div>
            </button>
          ))}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button className="btn-ghost" onClick={() => setPick(null)}>Cancel</button>
          <button
            className="btn-primary"
            onClick={() => {
              if (!pick) return;
              const r = pick.mode === 'pending' ? dispatch(moveToPending, { mapId: pick.mapId, category: cat }) : dispatch(reviveMap, { mapId: pick.mapId, category: cat });
              if (r) setPick(null);
            }}
          >
            Confirm
          </button>
        </div>
      </Modal>
    </div>
  );
}
