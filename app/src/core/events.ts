import { CLASSES, type ClassId } from './classes'
import { DOCTRINES, type DoctrineId } from './doctrines'
import { RELICS, type RelicId } from './relics'
import { random, randomInt } from './rng'
import { advance, drawBattle, hire, level, nextStop, passStop, settle, STOP_THREAT, THREAT_MAX, xpFor, type Run } from './run'

/** One way to meet an event: what it does, whether the squad can, and doing it. */
interface Option {
  text: string
  can?: (run: Run) => boolean
  take: (run: Run) => void
}

/** Something met on the road, after Slay the Spire's events: a scene, and options that each help and hurt. */
export interface Encounter {
  name: string
  text: string
  options: Option[]
}

/** What a shop's relic costs. */
export const RELIC_PRICE = 8
/** What a shop's bribe costs, and the threat it takes away. */
export const BRIBE = { price: 3, threat: 2 }
/** How likely an unknown stop is to be a battle, and a shop; otherwise it is an event. */
export const UNKNOWN_CHANCE = { battle: 0.3, shop: 0.3 }

const raise = (run: Run, threat: number) => (run.threat = Math.max(0, Math.min(run.threat + threat, THREAT_MAX)))
/** Adopts a doctrine; a weapon doctrine sets aside the one the squad fought with. */
const adopt = (run: Run, id: DoctrineId) => {
  if (DOCTRINES[id].weapon) run.doctrines = run.doctrines.filter((held) => !DOCTRINES[held].weapon)
  run.doctrines.push(id)
}
const gain = (supplies: number): Option => ({ text: `Salvage what you can: +${supplies} supplies`, take: (run) => (run.supplies += supplies) })
const leave: Option = { text: 'Move on', take: () => {} }
/** Relics the squad does not hold. */
const unheld = (run: Run) => (Object.keys(RELICS) as RelicId[]).filter((id) => !run.relics.includes(id))

const encounters = {
  vats: {
    name: 'Cloning Vats',
    text: 'An abandoned cloning plant still hums. Its vats could be pushed to make clones fast, at a cost to every body they make.',
    options: [
      {
        text: 'Mass Cloning: two new clones join, and every soldier has 2 less health for the run',
        take: (run) => {
          hire(run)
          hire(run)
          adopt(run, 'massCloning')
        },
      },
      gain(5),
    ],
  },
  survivor: {
    name: 'The Last Survivor',
    text: 'A veteran who outlived their whole unit offers to teach the squad to fight alone.',
    options: [
      {
        text: `Lone Wolf: only your highest-level soldier stays. ${DOCTRINES.loneWolf.text}`,
        take: (run) => {
          const best = run.soldiers.reduce((top, s) => (level(s) > level(top) ? s : top))
          run.soldiers = [best]
          adopt(run, 'loneWolf')
        },
      },
      leave,
    ],
  },
  instructor: {
    name: 'Rogue Instructor',
    text: 'A drill instructor will retrain the squad so each soldier masters a different craft, if the squad stays long enough.',
    options: [
      {
        text: 'Specialist Doctrine: every soldier retrains into a different class and gains a level, and no two soldiers share a class while one is left unused; +2 threat',
        take: (run) => {
          const classes = Object.keys(CLASSES) as ClassId[]
          const offset = randomInt(run, classes.length)
          run.soldiers.forEach((s, i) => {
            s.cls = classes[(offset + i) % classes.length]
            s.xp = xpFor(level(s) + 1)
          })
          raise(run, 2)
          adopt(run, 'specialists')
        },
      },
      leave,
    ],
  },
  exosuits: {
    name: 'Exosuit Prototype',
    text: 'A crashed transport carries powered armor. It is heavy enough that no soldier wearing it can hide behind anything.',
    options: [{ text: 'Exosuits: every soldier has +3 armor, but cover gives soldiers no defense', take: (run) => adopt(run, 'exosuits') }, gain(4)],
  },
  bunker: {
    name: 'Bunker Plans',
    text: 'Engineering notes on hardening any position. The aliens will learn them as fast as the squad does.',
    options: [{ text: 'Fortification Doctrine: low cover stops 30% of shots and high cover 60%, for both sides', take: (run) => adopt(run, 'fortified') }, leave],
  },
  shotguns: {
    name: 'Smuggled Shotguns',
    text: 'A crate of sawn-off shotguns: brutal up close, useless at range.',
    options: [{ text: 'Scatterguns: every soldier has +2 damage and 2 less range', take: (run) => adopt(run, 'scatterguns') }, gain(4)],
  },
  armory: {
    name: 'Ancient Armory',
    text: 'A museum hall of blades, untouched. Ammunition runs out; steel does not.',
    options: [{ text: `Blademasters: ${DOCTRINES.blades.text}`, take: (run) => adopt(run, 'blades') }, gain(4)],
  },
  awakening: {
    name: 'Psionic Awakening',
    text: "An alien signal stirs something in the clones' minds. It could be trained, or burned out.",
    options: [{ text: `Psi Operatives: ${DOCTRINES.psionics.text}`, take: (run) => adopt(run, 'psionics') }, leave],
  },
  quarry: {
    name: 'Demolition Crew',
    text: 'Quarry workers with crates of charges offer to show the squad how to bring the walls down.',
    options: [{ text: `Demolitions: ${DOCTRINES.demolitions.text}`, take: (run) => adopt(run, 'demolitions') }, gain(4)],
  },
  creed: {
    name: "Gunslinger's Creed",
    text: 'A drifter with two pistols offers to teach the squad to shoot with both hands.',
    options: [{ text: `Gunslingers: ${DOCTRINES.gunslingers.text}`, take: (run) => adopt(run, 'gunslingers') }, leave],
  },
  refugees: {
    name: 'Refugees',
    text: 'A column of survivors blocks the road. The aliens are not far behind them.',
    options: [
      { text: 'Shelter them: -4 supplies, -2 threat', can: (run) => run.supplies >= 4, take: (run) => ((run.supplies -= 4), raise(run, -2)) },
      { text: 'Recruit the fit: a new clone joins; +2 threat', take: (run) => (hire(run), raise(run, 2)) },
      leave,
    ],
  },
  artifact: {
    name: 'Alien Artifact',
    text: 'Something alien pulses in a crater. Taking it will not go unnoticed.',
    options: [
      {
        text: 'Take it: a random relic; +2 threat',
        can: (run) => unheld(run).length > 0,
        take: (run) => {
          const relics = unheld(run)
          run.relics.push(relics[randomInt(run, relics.length)])
          raise(run, 2)
        },
      },
      leave,
    ],
  },
  market: {
    name: 'Black Market',
    text: 'Traders who deal with anyone will pay well for a trained clone, and ask no questions.',
    options: [
      {
        text: 'Sell a clone: your lowest-level soldier leaves; +10 supplies',
        can: (run) => run.soldiers.length > 1,
        take: (run) => {
          const worst = run.soldiers.reduce((low, s) => (level(s) < level(low) ? s : low))
          run.soldiers = run.soldiers.filter((s) => s !== worst)
          run.supplies += 10
        },
      },
      leave,
    ],
  },
} satisfies Record<string, Encounter>

export type EventId = keyof typeof encounters
export const EVENTS: Record<EventId, Encounter> = encounters

/** Opens a shop: facilities, a relic, and a bribe. */
function openShop(run: Run): void {
  const relics = unheld(run)
  run.shop = { relic: relics.length > 0 ? relics[randomInt(run, relics.length)] : null, bribed: false }
  run.phase = 'shop'
}

/**
 * Arrives at a shop or an unknown stop. An unknown one is revealed: a battle begins at once, or the squad enters a
 * shop or meets an event not met before this run. Either adds threat as a stop does.
 */
export function arrive(run: Run): void {
  const unknown = nextStop(run) === 'unknown'
  const roll = random(run)
  if (unknown && roll < UNKNOWN_CHANCE.battle) {
    run.zone!.stops[run.stop] = drawBattle(run, 'standard')
    advance(run)
    return
  }
  raise(run, STOP_THREAT)
  run.report = null
  const fresh = (Object.keys(EVENTS) as EventId[]).filter((id) => !run.met.includes(id))
  if (!unknown || roll < UNKNOWN_CHANCE.battle + UNKNOWN_CHANCE.shop || fresh.length === 0) return openShop(run)
  const id = fresh[randomInt(run, fresh.length)]
  run.met.push(id)
  run.event = id
  run.phase = 'event'
}

/** Leaves a shop or event for the road. */
export function depart(run: Run): void {
  run.shop = null
  run.event = null
  passStop(run)
  settle(run)
}
