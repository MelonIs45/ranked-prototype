import { useState } from 'react';
import { RoleHint } from '../components/Shell';
import { Card, Empty, MapLink, Tabs } from '../components/ui';
import { fmtDate, ldPackSnapshotAt, monthKey, monthLabel, addMonths, packsSorted, type Pack } from '../engine';
import { useLabState } from '../store';

function PackList({ pack }: { pack: Pack }) {
  const s = useLabState();
  return (
    <ol className="space-y-1">
      {pack.mapIds.map((id, i) => (
        <li key={id} className="flex items-center gap-2 text-sm">
          <span className="w-5 text-right font-mono text-slate-500">{i + 1}</span>
          <MapLink map={s.maps[id]} className="min-w-0 flex-1 truncate" />
          <span className="text-lab-amber">★ {pack.starTotals[id]}</span>
        </li>
      ))}
    </ol>
  );
}

export function PacksPage() {
  const s = useLabState();
  const [tab, setTab] = useState<'ld' | 'fa' | 'pool'>('ld');
  const packs = packsSorted(s);
  const ld = packs.filter((p) => p.type.startsWith('ld_'));
  const fa = packs.filter((p) => p.type.startsWith('fa_'));
  const months = [...new Set(ld.map((p) => p.periodKey))];
  const windows = [...new Set(fa.map((p) => p.periodKey))];
  const pool = fa.filter((p) => p.inRankedPlay);
  const poolMaps = [...new Set(pool.flatMap((p) => p.mapIds))];
  const nextMonth = monthKey(addMonths(s.now, -1));
  const nextSnap = ldPackSnapshotAt(s.params, nextMonth);
  const ldName = s.params.categoryNames.levelDesign;
  return (
    <div className="space-y-4">
      <h1 className="h1">Packs</h1>
      <RoleHint hints={{ player: `Each month's ${ldName} maps are snapshotted ${s.params.pack.snapshotDelayDays} days after month end. The top quarter is labelled "Best of ${ldName}".` }} />
      <Tabs<'ld' | 'fa' | 'pool'>
        value={tab}
        onChange={setTab}
        options={[
          { value: 'ld', label: `Monthly ${ldName}`, count: months.length },
          { value: 'fa', label: 'Featured Artist', count: windows.length },
          { value: 'pool', label: 'Ranked Play pool', count: poolMaps.length },
        ]}
      />
      {tab === 'ld' && (
        <>
          <p className="text-sm muted">
            Next snapshot: {monthLabel(nextMonth)} on {fmtDate(nextSnap)}{nextSnap < s.now ? ' (pending tick)' : ''}. Packs are ranked by stars at snapshot time.
          </p>
          {months.length ? (
            <div className="grid gap-3 lg:grid-cols-2">
              {months.map((k) => {
                const half = ld.find((p) => p.periodKey === k && p.type === 'ld_top_half');
                const quarter = ld.find((p) => p.periodKey === k && p.type === 'ld_top_quarter');
                return (
                  <Card key={k} title={monthLabel(k)} action={<span className="text-xs muted">snapshot {half ? fmtDate(half.createdAt) : ''}</span>}>
                    {quarter && (
                      <div className="mb-3 rounded-lg border border-lab-pink/40 bg-lab-pink/10 p-2">
                        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-lab-pink">Top quarter · Best of {ldName}</div>
                        <PackList pack={quarter} />
                      </div>
                    )}
                    {half && (
                      <div>
                        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Top half</div>
                        <PackList pack={half} />
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          ) : (
            <Empty>No monthly packs yet.</Empty>
          )}
        </>
      )}
      {tab === 'fa' && (
        <>
          <p className="text-sm muted">Every {s.params.pack.faPackEveryDays} days, Featured Artist {ldName} maps ranked in the window are packed by stars and added to the Ranked Play pool.</p>
          {windows.length ? (
            <div className="grid gap-3 lg:grid-cols-2">
              {windows.map((k) => {
                const half = fa.find((p) => p.periodKey === k && p.type === 'fa_top_half')!;
                const quarter = fa.find((p) => p.periodKey === k && p.type === 'fa_top_quarter');
                return (
                  <Card key={k} title={half.periodLabel}>
                    {quarter && (
                      <div className="mb-3">
                        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-lab-amber">FA top quarter</div>
                        <PackList pack={quarter} />
                      </div>
                    )}
                    <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">FA top half</div>
                    <PackList pack={half} />
                  </Card>
                );
              })}
            </div>
          ) : (
            <Empty>No FA packs yet.</Empty>
          )}
        </>
      )}
      {tab === 'pool' && (
        <Card title="Current Ranked Play pool">
          {poolMaps.length ? (
            <ul className="grid gap-1 sm:grid-cols-2">
              {poolMaps.map((id) => (
                <li key={id} className="truncate text-sm">
                  <MapLink map={s.maps[id]} />
                </li>
              ))}
            </ul>
          ) : (
            <Empty>The pool is empty.</Empty>
          )}
        </Card>
      )}
    </div>
  );
}
