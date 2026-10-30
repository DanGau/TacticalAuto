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
  narrow: { name: 'Narrow ground', icon: '🧱', text: 'The battlefield is a corridor, a corner or an island; there are fewer ways around', from: 1 },
  crumbling: { name: 'Crumbling cover', icon: '🏚️', text: 'A hit on a unit in cover breaks that cover down a level', from: 1 },
  fuel: { name: 'Fuel tanks', icon: '🛢️', text: `A shot that misses a unit beside a fuel tank sets it off: ${FUEL_DAMAGE} damage and fire to all beside it`, from: 2 },
  fog: { name: 'Fog', icon: '🌫️', text: `Everyone sees ${FOG_SIGHT} tiles less far`, from: 3 },
  rain: { name: 'Rain', icon: '🌧️', text: 'Nothing burns', from: 3 },
  night: { name: 'Night', icon: '🌙', text: `Everyone notices enemies ${NIGHT_DETECT} tiles nearer`, from: 3 },
}

/** Chance a battle has a twist, by leg: none on the first, so each kind of twist arrives a leg at a time. */
const CHANCE = [0, 0.4, 0.6, 0.75]

/** A twist for a battle in leg `leg`, or none. */
export function drawTwist(rng: { rng: number }, leg: number): Twist | null {
  if (random(rng) >= CHANCE[Math.min(leg, CHANCE.length - 1)]) return null
  const open = (Object.keys(TWISTS) as Twist[]).filter((t) => TWISTS[t].from <= leg)
  return open[randomInt(rng, open.length)]
}
