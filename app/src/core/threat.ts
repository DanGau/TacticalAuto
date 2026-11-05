// How much a hero gains by shooting an alien: the harm it stops each turn, over the shots it takes to stop it.
import { ACID_DAMAGE, isSoldier, PSI_COOLDOWN, SPIT_DAMAGE, type Battle, type Unit } from './battle'
import { fury } from './brawlers'
import { distance } from './grid'

/** What an alien that can strike no hero next turn counts of its harm. */
const DISTANT = 0.5

/** What a shot that kills is worth beyond its threat. */
const KILL_WORTH = 0.5

/**
 * The damage `alien` will deal next turn: all of it if it shoots or can reach a hero, else DISTANT of it. A spitter's acid counts,
 * and a psion's panic costs a turn of the hardest-hitting hero, once a cooldown. Every alien counts some, so a nest is still shot.
 */
export function harm(battle: Battle, alien: Unit): number {
  const heroes = battle.units.filter(isSoldier)
  const near = alien.stats.range > 1 || heroes.some((h) => distance(h, alien) <= alien.stats.move + alien.stats.range)
  const dealt =
    alien.kind === 'spitter'
      ? SPIT_DAMAGE + ACID_DAMAGE
      : alien.kind === 'psion'
        ? alien.stats.damage + Math.max(0, ...heroes.map((h) => h.stats.damage)) / PSI_COOLDOWN
        : alien.stats.damage + Math.max(0, ...heroes.map((h) => fury(battle, alien, h)))
  return Math.max(1, dealt) * (near ? 1 : DISTANT)
}

/** What a hero's hit of `dealt` is worth against `alien`: its harm over the hits it takes to kill, more if this one kills. */
export function threat(battle: Battle, alien: Unit, dealt: number): number {
  const hits = Math.ceil(alien.hp / Math.max(1, dealt))
  return (harm(battle, alien) / hits) * (hits <= 1 ? 1 + KILL_WORTH : 1)
}
