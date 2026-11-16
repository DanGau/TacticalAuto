// Battle twists: fog, night, fuel and the rest, and drawing one.
import { random, randomInt } from './rng'

/** Tiles of sight fog takes, and of noticing night takes. */
export const FOG_SIGHT = 8
export const NIGHT_DETECT = 6
/** Damage a fuel tank does to each unit beside it. */
export const FUEL_DAMAGE = 3

/** Something about a battle's ground or weather that changes how it is fought. A battle has at most one. */
export type Twist = 'narrow' | 'crumbling' | 'fuel' | 'fog' | 'rain' | 'night'

/** Each twist: what the map tells of it, and the leg from which it may appear. */
export const TWISTS: Record<Twist, { name: string; icon: string; text: string; from: number }> = {
  narrow: { name: 'Narrow Ground', icon: '🧱', text: 'The battlefield is a corridor, a corner or an island, with few ways around.', from: 1 },
  crumbling: { name: 'Crumbling Ruins', icon: '🏚️', text: 'Each hit breaks down 1 level of whatever stands beside its target.', from: 1 },
  fuel: { name: 'Fuel Tanks', icon: '🛢️', text: `A hit on a unit beside a fuel tank sets it off. It deals ${FUEL_DAMAGE} damage to each unit beside it and sets the ground on fire.`, from: 2 },
  fog: { name: 'Fog', icon: '🌫️', text: `Everyone sees ${FOG_SIGHT} fewer tiles.`, from: 3 },
  rain: { name: 'Rain', icon: '🌧️', text: 'Nothing can Burn.', from: 3 },
  night: { name: 'Night', icon: '🌙', text: `Everyone notices enemies ${NIGHT_DETECT} tiles nearer.`, from: 3 },
}

/** Chance a battle has a twist, by leg: none on the first, so each kind of twist arrives a leg at a time. */
const CHANCE = [0, 0.4, 0.6, 0.75]

/** A twist for a battle in leg `leg`, or none. */
export function drawTwist(rng: { rng: number }, leg: number): Twist | null {
  if (random(rng) >= CHANCE[Math.min(leg, CHANCE.length - 1)]) return null
  const open = (Object.keys(TWISTS) as Twist[]).filter((t) => TWISTS[t].from <= leg)
  return open[randomInt(rng, open.length)]
}
