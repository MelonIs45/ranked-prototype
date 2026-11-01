// Shooting stars at ranked Level Design maps.
import { assertCheck, emit, fail, nextId, OK, run, type Check, type Ctx } from './core';
import { mapLabel, name } from './pipeline';
import { checkHomeTop } from './rewards';
import { bonusActive, everNominated, isNominator, mapStars, starWallet } from './selectors';
import { DAY, fmtDuration } from './time';
import type { Action, Id, Ms, State } from './types';

type S = State;

export function canCastStar(s: S, actorId: Id, mapId: Id, now: Ms = s.now): Check {
  const map = s.maps[mapId];
  const u = s.users[actorId];
  if (!map) return fail('no_map', 'That beatmap does not exist.');
  if (!isNominator(u)) return fail('not_bn', 'Only BNs and NAT members can shoot stars.');
  if (map.status !== 'ranked' || map.category !== 'level_design')
    return fail('not_ld', `Stars can only be cast at ranked ${s.params.categoryNames.levelDesign} maps.`);
  if (map.mapperId === actorId) return fail('own_map', "You can't star a map you mapped.");
  if (map.guestMapperIds.includes(actorId)) return fail('guest_map', "You can't star a map you guested on.");
  if (everNominated(s, actorId, mapId)) return fail('nominated', "You can't star a map you nominated.");
  const mine = mapStars(s, mapId).filter((st) => st.castorId === actorId).length;
  if (mine >= s.params.stars.perCasterPerMap)
    return fail('already_starred', s.params.stars.perCasterPerMap === 1 ? 'You have already cast a star at this map.' : `You have already cast ${mine} stars at this map (limit ${s.params.stars.perCasterPerMap}).`);
  const w = starWallet(s, actorId, now);
  if (w.available < 1)
    return fail('no_stars', w.nextReturnAt ? `You have no stars left. Next one returns in ${fmtDuration(w.nextReturnAt - now)}.` : 'You have no stars left.');
  return OK;
}

export function castStarInternal(ctx: Ctx, actorId: Id, mapId: Id) {
  const s = ctx.s;
  const p = s.params;
  // Spend bonus stars first (soonest to expire), since they don't come back.
  const grant = Object.values(s.bonusGrants)
    .filter((g) => g.userId === actorId && bonusActive(g, ctx.now))
    .sort((a, b) => (a.expiresAt ?? Infinity) - (b.expiresAt ?? Infinity))[0];
  const id = nextId(ctx, 's');
  if (grant) {
    grant.remaining -= 1;
    s.stars[id] = { id, castorId: actorId, mapId, at: ctx.now, replenishAt: null, fromBonus: grant.id };
  } else {
    s.stars[id] = { id, castorId: actorId, mapId, at: ctx.now, replenishAt: ctx.now + p.stars.replenishDays * DAY, fromBonus: null };
  }
  return s.stars[id];
}

export const castStar: Action<{ mapId: Id }> = (state, actorId, { mapId }, now) => {
  assertCheck(canCastStar(state, actorId, mapId, now));
  return run(state, now, (ctx) => {
    const st = castStarInternal(ctx, actorId, mapId);
    const total = mapStars(ctx.s, mapId).length;
    emit(
      ctx,
      'star_cast',
      `${name(ctx.s, actorId)} shot a ${st.fromBonus ? 'bonus ' : ''}star at ${mapLabel(ctx.s.maps[mapId])} (${total} all-time)${st.replenishAt ? `; it returns in ${ctx.s.params.stars.replenishDays} days` : ''}.`,
      { actorId, mapId },
    );
    checkHomeTop(ctx);
  });
};
