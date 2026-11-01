import { Link, useParams } from 'react-router-dom';
import { RoleHint } from '../components/Shell';
import { ActionButton, Avatar, Card, CategoryBadge, cx, Empty, fmtNum, MapLink, Meter, RoleBadges, Stat, StatusBadge, UserLink, useMeUser } from '../components/ui';
import {
  bnCriteriaStatus,
  canVouch,
  categoryName,
  fmtDate,
  fmtDuration,
  isNominator,
  leaderboard,
  mapperPoints,
  mapperTier,
  mapsBy,
  natTenureTier,
  natTenureYears,
  nominatorStats,
  seasonFor,
  starWallet,
  userBadges,
  userPlays,
  vouch,
  vouchesReceived,
  type BadgeType,
} from '../engine';
import { useLab, useLabState } from '../store';

const BADGE_LABEL: Record<BadgeType, string> = {
  bn_top_main: 'Top nominator',
  bn_top_fa: 'Top FA nominator',
  best_of_ld: 'Best of LD cleared',
  mapper_tier: 'Mapper tier',
};

export function ProfilePage() {
  const { id } = useParams();
  const s = useLabState();
  const me = useMeUser();
  const dispatch = useLab((st) => st.dispatch);
  const u = s.users[id ?? ''];
  if (!u) return <Empty>User not found.</Empty>;
  const pts = mapperPoints(s, u.id);
  const tier = mapperTier(s.params, pts);
  const maps = mapsBy(s, u.id);
  const badges = userBadges(s, u.id);
  const vouches = vouchesReceived(s, u.id);
  const season = seasonFor(s.now, s.params);
  const main = leaderboard(s, season, 'main').find((r) => r.userId === u.id);
  const fa = leaderboard(s, season, 'fa').find((r) => r.userId === u.id);
  const nom = isNominator(u) ? nominatorStats(s, u.id) : null;
  const ns = s.nominators[u.id];
  const natTier = natTenureTier(s.params, u, s.now);
  const plays = userPlays(s, u.id);
  const chatBanned = u.chatBanUntil !== null && u.chatBanUntil > s.now;
  const criteria = !isNominator(u) && !u.isAdmin ? bnCriteriaStatus(s, u.id) : null;
  const statuses = ['ranked', 'qualified', 'pending', 'wip', 'graveyard'] as const;
  const prevTier = tier.tier;
  const span = Math.max(1, tier.next - prevTier);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-ink-700 bg-ink-900 p-5">
        <Avatar user={u} size={72} />
        <div className="min-w-0 flex-1">
          <h1 className="h1 flex flex-wrap items-center gap-2">
            {u.username} <RoleBadges user={u} />
          </h1>
          {u.title && <div className="font-semibold text-lab-amber">{u.title}</div>}
          <div className="text-sm muted">
            {u.country} · {fmtNum(u.pp)} pp{s.params.ldPpStat && ` · ${fmtNum(u.ldPp)} ${s.params.categoryNames.levelDesign} pp`}
            {u.bnSince && ` · BN since ${fmtDate(u.bnSince)}${u.bnQualifiedVia ? ` (via ${u.bnQualifiedVia})` : ''}`}
            {u.natSince && u.isNAT && ` · NAT since ${fmtDate(u.natSince)}`}
          </div>
          <div className="mt-1 flex flex-wrap gap-2 text-xs">
            {chatBanned && <span className="rounded bg-lab-red/20 px-2 py-0.5 font-semibold text-lab-red">Chat banned · {fmtDuration(u.chatBanUntil! - s.now)} left</span>}
            {u.tournamentBanned && <span className="rounded bg-lab-red/20 px-2 py-0.5 font-semibold text-lab-red">Tournament ban flag</span>}
            {u.playerStrikes > 0 && <span className="rounded bg-lab-amber/20 px-2 py-0.5 text-lab-amber">{u.playerStrikes} player abuse strike(s)</span>}
            {ns && ns.flagStrikes > 0 && <span className="rounded bg-lab-amber/20 px-2 py-0.5 text-lab-amber">{ns.flagStrikes} BN abuse strike(s)</span>}
          </div>
        </div>
        {!isNominator(u) && !u.isAdmin && isNominator(me) && (
          <ActionButton check={canVouch(s, me.id, u.id)} onClick={() => dispatch(vouch, { candidateId: u.id })}>
            Vouch for {u.username}
          </ActionButton>
        )}
      </div>
      <RoleHint hints={{ bn: 'You can vouch for one aspiring BN every 15 days from their profile. Vouches are public.' }} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Favourites received" value={fmtNum(u.favouritesReceived)} />
        <Stat label="Mapping subscribers" value={fmtNum(u.mappingSubscribers)} />
        <Stat label="Plays on own maps" value={fmtNum(u.totalPlays)} />
        <Stat label="Simulated plays" value={fmtNum(plays.length)} sub={`${fmtNum(plays.reduce((a, p) => a + p.durationSec, 0) / 3600, 1)} h played`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
        <Card title="Mapper badge">
          <div className="flex items-end gap-2">
            <span className="text-3xl font-bold text-white">{tier.tier ? `Tier ${tier.tier}` : 'No tier yet'}</span>
          </div>
          <div className="mt-1 text-sm muted">
            {pts} point{pts === 1 ? '' : 's'} · next tier at {tier.next}
          </div>
          <Meter className="mt-2" value={pts - prevTier} max={span} color="bg-lab-amber" />
          <p className="mt-2 text-xs muted">+1 point each time one of this mapper's maps first enters the home top {s.params.homeTopN}. Tier {s.params.legendaryTitleTier} grants “Legendary Mapping Master”.</p>
        </Card>
        <Card title="Badges">
          {badges.length || natTier ? (
            <ul className="flex flex-wrap gap-1.5">
              {natTier > 0 && <li className="chip border-lab-red/50 text-lab-red">NAT {natTier}-year ({natTenureYears(u, s.now).toFixed(1)} y)</li>}
              {badges.map((b) => (
                <li key={b.id} className={cx('chip', b.type === 'mapper_tier' && 'border-lab-amber/50 text-lab-amber', b.type.startsWith('bn_top') && 'border-lab-violet/50 text-lab-violet')}>
                  {BADGE_LABEL[b.type]}
                  {b.tier ? ` ${b.tier}` : ''}
                  {b.season ? ` · ${b.season.replace('-S', ' Q')}` : ''}
                  {b.rank ? ` #${b.rank}` : ''}
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-sm muted">No badges yet.</div>
          )}
        </Card>
        </div>
        {nom ? (
          <Card title="Nominator">
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Season points" value={main?.points ?? 0} sub={main ? `main #${main.rank}` : 'main'} />
              <Stat label="FA points" value={fa?.points ?? 0} sub={fa ? `FA #${fa.rank}` : 'FA'} />
              <Stat label="Nominations" value={nom.total} sub={`${nom.activity} in 90 d`} />
              <Stat label="Ratio (180 d)" value={nom.ratio.toFixed(2)} sub={`${nom.rankedCount} ranked / ${nom.dqs} DQ${nom.ratioEligible ? '' : ' · <5 noms'}`} />
            </div>
            <div className="mt-2 text-xs muted">
              {ns?.allowanceAvailable ?? 0} nominations available · {starWallet(s, u.id).available} stars
            </div>
          </Card>
        ) : criteria ? (
          <Card title="BN eligibility" action={me.id === u.id ? <Link to="/bn/apply" className="text-sm">Apply</Link> : undefined}>
            <ul className="space-y-1 text-sm">
              {criteria.map((c) => (
                <li key={c.key} className="flex justify-between gap-2">
                  <span className={c.met ? 'text-lab-mint' : 'muted'}>{c.label}</span>
                  <span className="font-mono">{typeof c.value === 'boolean' ? (c.value ? 'yes' : 'no') : `${fmtNum(c.value)}/${fmtNum(c.threshold as number)}`}</span>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card title={`Maps (${maps.length})`}>
          {maps.length ? (
            <div className="space-y-3">
              {statuses.map((st) => {
                const list = maps.filter((m) => m.status === st);
                if (!list.length) return null;
                return (
                  <div key={st}>
                    <div className="mb-1">
                      <StatusBadge status={st} />
                    </div>
                    <ul className="space-y-1">
                      {list.map((m) => (
                        <li key={m.id} className="flex items-center justify-between gap-2 text-sm">
                          <MapLink map={m} className="truncate" />
                          <span className="flex shrink-0 items-center gap-1">
                            {m.mapperId !== u.id && <span className="text-xs muted">guest</span>}
                            <CategoryBadge category={m.category} />
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-sm muted">No maps.</div>
          )}
        </Card>
        <Card title={`Vouches received (${vouches.length})`}>
          {vouches.length ? (
            <ul className="space-y-1 text-sm">
              {vouches.map((v) => (
                <li key={v.id} className="flex justify-between gap-2">
                  <UserLink id={v.voucherId} />
                  <span className="text-xs muted">{fmtDate(v.at)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-sm muted">None.</div>
          )}
          {s.bnProfiles[u.id] && isNominator(u) && (
            <div className="mt-4 border-t border-ink-700 pt-3 text-sm">
              <div className="label">Directory</div>
              <div className={s.bnProfiles[u.id].open ? 'text-lab-mint' : 'muted'}>{s.bnProfiles[u.id].open ? 'Open for requests' : 'Closed'}</div>
              <div className="text-xs muted">{s.bnProfiles[u.id].categories.map((c) => categoryName(s.params, c)).join(', ')}</div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
