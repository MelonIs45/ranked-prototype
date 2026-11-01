import { useMemo, useState } from 'react';
import { ClockWidget, EventList, RoleHint } from '../components/Shell';
import { ActionButton, Card, Empty, Field, useMeUser } from '../components/ui';
import { cloneParams, defaultParams, paramOrigin, type Params } from '../config/params';
import {
  DAY,
  editUserStats,
  OK,
  fail,
  setParams,
  simulateDownloads,
  simulatePlayerReports,
  simulatePlays,
  simulateStarCasts,
  type Event,
  type EventType,
} from '../engine';
import { useLab, useLabState } from '../store';

const ENUMS: Record<string, string[]> = {
  removalRounding: ['floor', 'round', 'ceil', 'exact'],
  overrideDeadline: ['expire_as_denied', 'auto_approve', 'stay_open'],
  flagCaseDeadline: ['stay_frozen', 'auto_dismiss'],
  bonusStars: ['pool', 'permanent'],
  voteBasis: ['membership', 'cast'],
  natInviteCadence: ['season', 'month'],
};

type Json = number | string | boolean | Json[] | { [k: string]: Json };

function ParamInput({ path, value, onChange }: { path: string[]; value: Json; onChange: (v: Json) => void }) {
  const key = path[path.length - 1];
  if (typeof value === 'boolean')
    return (
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} /> {value ? 'on' : 'off'}
      </label>
    );
  if (typeof value === 'number') return <input type="number" step="any" className="input w-32" value={value} onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))} />;
  if (typeof value === 'string')
    return ENUMS[key] ? (
      <select className="input w-auto" value={value} onChange={(e) => onChange(e.target.value)}>
        {ENUMS[key].map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    ) : (
      <input className="input" value={value} onChange={(e) => onChange(e.target.value)} />
    );
  if (Array.isArray(value) && value.every((x) => typeof x === 'number'))
    return (
      <input
        className="input"
        defaultValue={value.join(', ')}
        onBlur={(e) => onChange(e.target.value.split(',').map((x) => Number(x.trim())).filter((x) => !Number.isNaN(x)))}
        title="Comma-separated numbers"
      />
    );
  if (Array.isArray(value))
    return (
      <div className="space-y-1">
        {value.map((v, i) => (
          <div key={i} className="rounded-lg border border-ink-700 p-2">
            <ParamGroup path={[...path, String(i)]} value={v as Record<string, Json>} onChange={(nv) => onChange(value.map((x, k) => (k === i ? nv : x)))} />
          </div>
        ))}
      </div>
    );
  return <ParamGroup path={path} value={value as Record<string, Json>} onChange={onChange} />;
}

function ParamGroup({ path, value, onChange }: { path: string[]; value: Record<string, Json>; onChange: (v: Json) => void }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {Object.entries(value).map(([k, v]) => (
        <div key={k} className={typeof v === 'object' && !(Array.isArray(v) && v.every((x) => typeof x === 'number')) ? 'sm:col-span-2' : ''}>
          <div className="mb-0.5 text-xs text-slate-400">{k}</div>
          <ParamInput path={[...path, k]} value={v} onChange={(nv) => onChange({ ...value, [k]: nv })} />
        </div>
      ))}
    </div>
  );
}

function ConfigEditor() {
  const s = useLabState();
  const dispatch = useLab((st) => st.dispatch);
  const [draft, setDraft] = useState<Params>(() => cloneParams(s.params));
  const [q, setQ] = useState('');
  const dirty = JSON.stringify(draft) !== JSON.stringify(s.params);
  const entries = Object.entries(draft as unknown as Record<string, Json>).filter(([k]) => !q || k.toLowerCase().includes(q.toLowerCase()));
  return (
    <Card
      title="Config parameters"
      action={
        <div className="flex gap-2">
          <button className="btn-ghost text-xs" onClick={() => setDraft(cloneParams(defaultParams))}>
            Defaults
          </button>
          <button className="btn-ghost text-xs" onClick={() => setDraft(cloneParams(s.params))} disabled={!dirty}>
            Revert
          </button>
          <button className="btn-primary text-xs" disabled={!dirty} onClick={() => dispatch(setParams, { params: draft })}>
            Apply live
          </button>
        </div>
      }
    >
      <input className="input mb-3" placeholder="Filter keys…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
        {entries.map(([k, v]) => (
          <div key={k} className="rounded-lg bg-ink-850 p-3">
            <div className="mb-1 flex items-center justify-between">
              <span className="font-mono text-sm text-white">{k}</span>
              {paramOrigin[k] && <span className={paramOrigin[k] === 'Proposal' ? 'chip border-lab-mint/40 text-lab-mint' : 'chip'}>{paramOrigin[k]}</span>}
            </div>
            <ParamInput path={[k]} value={v} onChange={(nv) => setDraft((d) => ({ ...d, [k]: nv }) as Params)} />
          </div>
        ))}
      </div>
    </Card>
  );
}

function CrowdSim() {
  const s = useLabState();
  const dispatch = useLab((st) => st.dispatch);
  const [mapId, setMapId] = useState('');
  const [count, setCount] = useState(20);
  const [q, setQ] = useState('');
  const map = s.maps[mapId];
  const maps = useMemo(
    () =>
      Object.values(s.maps)
        .filter((m) => m.status !== 'wip' && m.status !== 'graveyard')
        .filter((m) => !q || `${m.title} ${m.artist}`.toLowerCase().includes(q.toLowerCase()))
        .sort((a, b) => a.status.localeCompare(b.status) || a.title.localeCompare(b.title)),
    [s.maps, q],
  );
  const ld = map && map.status === 'ranked' && map.category === 'level_design';
  return (
    <Card title="Crowd simulation">
      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <Field label="Map">
          <input className="input mb-1" placeholder="Search maps…" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="input" value={mapId} onChange={(e) => setMapId(e.target.value)}>
            <option value="">All ranked/qualified maps (plays, downloads)</option>
            {maps.map((m) => (
              <option key={m.id} value={m.id}>
                [{m.status}] {m.title} by {m.artist}
              </option>
            ))}
          </select>
        </Field>
        <Field label="N">
          <input type="number" min={1} className="input w-24" value={count} onChange={(e) => setCount(Math.max(1, Number(e.target.value)))} />
        </Field>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <ActionButton variant="secondary" check={OK} onClick={() => dispatch(simulatePlays, { mapId: mapId || undefined, count })}>
          Simulate {count} plays
        </ActionButton>
        <ActionButton variant="secondary" check={OK} onClick={() => dispatch(simulateDownloads, { mapId: mapId || undefined, count })}>
          Simulate {count} downloads
        </ActionButton>
        <ActionButton variant="secondary" check={map?.status === 'qualified' ? OK : fail('x', 'Pick a Qualified map to simulate player reports.')} onClick={() => dispatch(simulatePlayerReports, { mapId, count })}>
          Simulate {count} player reports
        </ActionButton>
        <ActionButton variant="secondary" check={ld ? OK : fail('x', 'Pick a ranked Level Design map to simulate star casts.')} onClick={() => dispatch(simulateStarCasts, { mapId, count })}>
          Simulate {count} star casts
        </ActionButton>
      </div>
      <p className="mt-2 text-xs muted">Reports use real players first, then synthetic crowd users. Star casts use eligible BNs/NAT with stars left.</p>
    </Card>
  );
}

function UserEditor() {
  const s = useLabState();
  const dispatch = useLab((st) => st.dispatch);
  const [q, setQ] = useState('');
  const [userId, setUserId] = useState('');
  const u = s.users[userId];
  const [form, setForm] = useState<Record<string, number | boolean>>({});
  const pickUser = (id: string) => {
    setUserId(id);
    const x = s.users[id];
    if (x) setForm({ favouritesReceived: x.favouritesReceived, mappingSubscribers: x.mappingSubscribers, totalPlays: x.totalPlays, mapperPointsAdjust: x.mapperPointsAdjust, isLegacyBN: x.isLegacyBN, allowance: s.nominators[id]?.allowanceAvailable ?? 0 });
  };
  const matches = Object.values(s.users).filter((x) => !x.isCrowd && q && x.username.toLowerCase().includes(q.toLowerCase())).slice(0, 8);
  return (
    <Card title="Edit user stats">
      <input className="input" placeholder="Search a user…" value={q} onChange={(e) => setQ(e.target.value)} />
      {matches.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {matches.map((m) => (
            <button key={m.id} className="chip" onClick={() => pickUser(m.id)}>
              {m.username}
            </button>
          ))}
        </div>
      )}
      {u ? (
        <div className="mt-3 space-y-2">
          <div className="font-semibold text-white">{u.username}</div>
          <div className="grid grid-cols-2 gap-2">
            {(['favouritesReceived', 'mappingSubscribers', 'totalPlays', 'mapperPointsAdjust'] as const).map((k) => (
              <Field key={k} label={k}>
                <input type="number" className="input" value={Number(form[k] ?? 0)} onChange={(e) => setForm((f) => ({ ...f, [k]: Number(e.target.value) }))} />
              </Field>
            ))}
            {s.nominators[u.id] && (
              <Field label="allowance">
                <input type="number" className="input" value={Number(form.allowance ?? 0)} onChange={(e) => setForm((f) => ({ ...f, allowance: Number(e.target.value) }))} />
              </Field>
            )}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!!form.isLegacyBN} onChange={(e) => setForm((f) => ({ ...f, isLegacyBN: e.target.checked }))} /> Legacy BN
          </label>
          <button
            className="btn-primary"
            onClick={() =>
              dispatch(editUserStats, {
                userId: u.id,
                patch: {
                  favouritesReceived: Number(form.favouritesReceived),
                  mappingSubscribers: Number(form.mappingSubscribers),
                  totalPlays: Number(form.totalPlays),
                  mapperPointsAdjust: Number(form.mapperPointsAdjust),
                  isLegacyBN: !!form.isLegacyBN,
                },
                allowance: s.nominators[u.id] ? Number(form.allowance) : undefined,
              })
            }
          >
            Save
          </button>
        </div>
      ) : (
        <p className="mt-2 text-sm muted">Search and pick a user to edit their seeded stats.</p>
      )}
    </Card>
  );
}

function EventLog() {
  const s = useLabState();
  const [type, setType] = useState<EventType | ''>('');
  const [q, setQ] = useState('');
  const [user, setUser] = useState('');
  const types = useMemo(() => [...new Set(s.events.map((e) => e.type))].sort(), [s.events]);
  const uid = user ? Object.values(s.users).find((u) => u.username.toLowerCase() === user.toLowerCase())?.id : undefined;
  const events: Event[] = s.events.filter(
    (e) => (!type || e.type === type) && (!q || e.message.toLowerCase().includes(q.toLowerCase())) && (!user || (uid && (e.actorId === uid || e.targetUserId === uid))),
  );
  return (
    <Card title={`Event log (${events.length} of ${s.events.length})`}>
      <div className="mb-3 grid gap-2 sm:grid-cols-3">
        <select className="input" value={type} onChange={(e) => setType(e.target.value as EventType | '')} aria-label="Event type">
          <option value="">All types</option>
          {types.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <input className="input" placeholder="Exact username" value={user} onChange={(e) => setUser(e.target.value)} />
        <input className="input" placeholder="Search text" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="max-h-[60vh] overflow-y-auto pr-1">
        <EventList events={events} limit={400} />
      </div>
    </Card>
  );
}

export function AdminPage() {
  const me = useMeUser();
  const reset = useLab((st) => st.reset);
  const advance = useLab((st) => st.advance);
  const [days, setDays] = useState(3);
  const [confirm, setConfirm] = useState(false);
  if (!me.isAdmin) return <Empty>The admin panel is for the Lab Admin persona. Switch to it in the header.</Empty>;
  return (
    <div className="space-y-4">
      <RoleHint hints={{ admin: 'Operator tools for the prototype, not part of the proposal. Config changes apply live to every rule and page.' }} />
      <Card title="Clock">
        <ClockWidget />
        <div className="mt-3 flex items-center gap-2">
          <input type="number" min={1} className="input w-24" value={days} onChange={(e) => setDays(Math.max(1, Number(e.target.value)))} />
          <button className="btn-secondary" onClick={() => advance(days * DAY)}>
            Advance {days} days
          </button>
          <span className="flex-1" />
          {confirm ? (
            <>
              <span className="text-sm text-lab-red">Discard everything and reseed?</span>
              <button className="btn-danger" onClick={() => { reset(); setConfirm(false); }}>
                Reset
              </button>
              <button className="btn-ghost" onClick={() => setConfirm(false)}>
                Cancel
              </button>
            </>
          ) : (
            <button className="btn-danger" onClick={() => setConfirm(true)}>
              Reset to seed
            </button>
          )}
        </div>
      </Card>
      <div className="grid gap-4 xl:grid-cols-2">
        <ConfigEditor />
        <div className="space-y-4">
          <CrowdSim />
          <UserEditor />
        </div>
      </div>
      <EventLog />
    </div>
  );
}
