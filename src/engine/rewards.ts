// Rewards jobs: home top N, mapper badge, monthly LD packs, FA packs, season rollover, NAT invite cycles.
import { emit, nextId, type Ctx } from './core';
import { inviteToNat } from './membership';
import { mapLabel, name } from './pipeline';
import {
  homeTop,
  leaderboard,
  mapperPoints,
  mapperTier,
  mapStars,
  natInviteEligible,
  playlistProgress,
  seasonPlaylist,
} from './selectors';
import { DAY, monthEnd, monthKey, monthLabel, monthStart, fmtDate } from './time';
import type { BadgeType, Beatmapset, Id, Ms, PackType, Season } from './types';

function award(ctx: Ctx, userId: Id, type: BadgeType, season: string | null, tier: number | null, rank: number | null) {
  const id = nextId(ctx, 'b');
  ctx.s.badges[id] = { id, userId, type, season, tier, rank, awardedAt: ctx.now };
}

/** Award a mapper point the first time a map enters the home top N. */
export function checkHomeTop(ctx: Ctx) {
  const s = ctx.s;
  for (const m of homeTop(s, ctx.now)) {
    if (s.homeTopEntered[m.id] !== undefined) continue;
    const before = mapperTier(s.params, mapperPoints(s, m.mapperId)).tier;
    s.homeTopEntered[m.id] = ctx.now;
    const pts = mapperPoints(s, m.mapperId);
    emit(ctx, 'home_top', `${mapLabel(m)} entered the home top ${s.params.homeTopN}. ${name(s, m.mapperId)} earns a mapper badge point (${pts} total).`, {
      mapId: m.id,
      targetUserId: m.mapperId,
    });
    const after = mapperTier(s.params, pts).tier;
    if (after > before) {
      award(ctx, m.mapperId, 'mapper_tier', null, after, null);
      emit(ctx, 'badge', `${name(s, m.mapperId)} reached mapper badge tier ${after}.`, { targetUserId: m.mapperId });
      if (after >= s.params.legendaryTitleTier) {
        s.users[m.mapperId].title = 'Legendary Mapping Master';
        emit(ctx, 'badge', `${name(s, m.mapperId)} earned the title "Legendary Mapping Master".`, { targetUserId: m.mapperId });
      }
    }
  }
}

function starsAt(ctx: Ctx, mapId: Id, at: Ms) {
  return mapStars(ctx.s, mapId).filter((st) => st.at <= at).length;
}

function makePacks(ctx: Ctx, maps: Beatmapset[], at: Ms, types: [PackType, PackType], periodKey: string, periodLabel: string, inRankedPlay: boolean) {
  const totals: Record<Id, number> = {};
  for (const m of maps) totals[m.id] = starsAt(ctx, m.id, at);
  const sorted = maps.filter((m) => totals[m.id] > 0).sort((a, b) => totals[b.id] - totals[a.id] || (a.rankedAt ?? 0) - (b.rankedAt ?? 0));
  if (sorted.length === 0) return [];
  const half = sorted.slice(0, Math.ceil(sorted.length / 2));
  const quarter = sorted.slice(0, Math.ceil(sorted.length / 4));
  const made = [];
  for (const [type, list] of [
    [types[0], half],
    [types[1], quarter],
  ] as const) {
    const id = nextId(ctx, 'pk');
    const starTotals: Record<Id, number> = {};
    for (const m of list) starTotals[m.id] = totals[m.id];
    ctx.s.packs[id] = { id, type, periodKey, periodLabel, mapIds: list.map((m) => m.id), starTotals, createdAt: at, inRankedPlay };
    made.push(ctx.s.packs[id]);
  }
  return made;
}

/** Monthly Level Design packs, snapshotted after the configured delay. */
export function runMonthlyPack(ctx: Ctx, key: string, at: Ms) {
  const s = ctx.s;
  s.jobs.ldPacksDone[key] = true;
  const from = monthStart(key);
  const to = monthEnd(key);
  const maps = Object.values(s.maps).filter((m) => m.category === 'level_design' && m.status === 'ranked' && (m.rankedAt ?? 0) >= from && (m.rankedAt ?? 0) < to);
  const made = makePacks(ctx, maps, at, ['ld_top_half', 'ld_top_quarter'], key, monthLabel(key), false);
  if (made.length) {
    emit(
      ctx,
      'pack_created',
      `${monthLabel(key)} ${s.params.categoryNames.levelDesign} packs: top half (${made[0].mapIds.length} maps) and top quarter (${made[1].mapIds.length}), labelled "Best of ${s.params.categoryNames.levelDesign}".`,
    );
  } else {
    emit(ctx, 'pack_created', `No ${s.params.categoryNames.levelDesign} maps with stars were ranked in ${monthLabel(key)}; no pack this month.`);
  }
}

export function ldPackSnapshotAt(params: Ctx['s']['params'], key: string): Ms {
  return monthEnd(key) + (params.interp.packSnapshotDelayed ? params.pack.snapshotDelayDays * DAY : 0);
}

/** Featured Artist packs over a 30-day window, added to the Ranked Play pool. */
export function runFaPack(ctx: Ctx, from: Ms, to: Ms) {
  const s = ctx.s;
  const maps = Object.values(s.maps).filter((m) => m.isFA && m.category === 'level_design' && m.status === 'ranked' && (m.rankedAt ?? 0) > from && (m.rankedAt ?? 0) <= to);
  const label = `${fmtDate(from)} – ${fmtDate(to)}`;
  const made = makePacks(ctx, maps, to, ['fa_top_half', 'fa_top_quarter'], String(from), label, true);
  emit(
    ctx,
    'pack_created',
    made.length
      ? `Featured Artist packs for ${label}: top half (${made[0].mapIds.length}) and top quarter (${made[1].mapIds.length}) added to the Ranked Play pool.`
      : `No starred Featured Artist maps ranked ${label}; no FA pack this window.`,
  );
}

export function seasonRollover(ctx: Ctx, season: Season) {
  const s = ctx.s;
  if (s.jobs.seasonsRolled[season.id]) return;
  s.jobs.seasonsRolled[season.id] = true;
  const cutoff = s.params.leaderboard.badgeCutoff;
  let count = 0;
  for (const board of ['main', 'fa'] as const) {
    const rows = leaderboard(s, season, board, season.endsAt - 1).filter((r) => r.points > 0).slice(0, cutoff);
    for (const r of rows) {
      award(ctx, r.userId, board === 'main' ? 'bn_top_main' : 'bn_top_fa', season.id, null, r.rank);
      count++;
    }
  }
  const playlist = seasonPlaylist(s, season);
  let cleared = 0;
  if (playlist.length) {
    for (const u of Object.values(s.users)) {
      const pr = playlistProgress(s, u.id, playlist, season.endsAt);
      if (pr.cleared === pr.total) {
        award(ctx, u.id, 'best_of_ld', season.id, null, null);
        cleared++;
      }
    }
  }
  emit(
    ctx,
    'season_rollover',
    `Season ${season.label} ended: ${count} nominator badges awarded (top ${cutoff} per board), ${cleared} players cleared the Best of ${s.params.categoryNames.levelDesign} playlist. Leaderboards reset.`,
  );
}

export function runInviteCycle(ctx: Ctx, label: string) {
  const s = ctx.s;
  if (s.jobs.inviteCyclesDone[label]) return;
  s.jobs.inviteCyclesDone[label] = true;
  const eligible = natInviteEligible(s, ctx.now).filter((id) => {
    const inv = s.natInvites[id];
    const openCand = Object.values(s.candidacies).some((c) => c.userId === id && c.status === 'open');
    return !openCand && (!inv || inv.status === 'declined' || inv.cycle !== label) && !(inv && (inv.status === 'pending' || inv.status === 'accepted'));
  });
  for (const id of eligible) inviteToNat(ctx, id, label);
  emit(ctx, 'nat_invite', `NAT invite cycle ${label}: ${eligible.length} BN(s) in the top ${s.params.natInvite.ratioTopPercent}% by ratio and top ${s.params.natInvite.activityTopPercent}% by activity were invited.`);
}

export { monthKey };
