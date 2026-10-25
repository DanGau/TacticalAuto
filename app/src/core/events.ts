import { CLASSES, type ClassId } from './classes'
import { DOCTRINES, type DoctrineId } from './doctrines'
import { RELICS, type RelicId } from './relics'
import { random, randomInt } from './rng'
import { advance, drawBattle, hire, level, nextStop, passStop, settle, STOP_THREAT, THREAT_MAX, xpFor, type Run } from './run'

/** One way to meet an event: the squad's quip, what it does, whether the squad can, and doing it. */
interface Option {
  quip: string
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
const gain = (supplies: number, quip: string): Option => ({ quip, text: `Salvage it: +${supplies} supplies`, take: (run) => (run.supplies += supplies) })
const leave = (quip: string): Option => ({ quip, text: 'Move on', take: () => {} })
/** Relics the squad does not hold. */
const unheld = (run: Run) => (Object.keys(RELICS) as RelicId[]).filter((id) => !run.relics.includes(id))

const encounters = {
  vats: {
    name: 'Cloning Vats',
    text: `An abandoned cloning plant hums away, a sticky note on the console: SET TO 'ECONOMY' TO SAVE POWER. The vats can push out clones twice as fast. Nobody asks what economy skips.`,
    options: [
      {
        quip: 'Crank it to eleven. What could a few skipped organs hurt?',
        text: 'Mass Cloning: two new clones join, and every soldier has 2 less health for the run',
        take: (run) => {
          hire(run)
          hire(run)
          adopt(run, 'massCloning')
        },
      },
      gain(5, 'Strip the vats for parts before they make anything weird.'),
    ],
  },
  survivor: {
    name: 'The Last Survivor',
    text: 'A grizzled veteran sits on a pile of alien helmets, chewing an unlit cigar. "Squads," they spit. "Squads are just people to get you killed. Pick your best. Send the rest home."',
    options: [
      {
        quip: '"You. The one who still has eyebrows. You\'re with me."',
        text: `Lone Wolf: only your highest-level soldier stays. ${DOCTRINES.loneWolf.text}`,
        take: (run) => {
          const best = run.soldiers.reduce((top, s) => (level(s) > level(top) ? s : top))
          run.soldiers = [best]
          adopt(run, 'loneWolf')
        },
      },
      leave("Thank them for their service and back away slowly."),
    ],
  },
  instructor: {
    name: 'Rogue Instructor',
    text: 'A drill instructor in mirrored shades blocks the road with a whiteboard. It reads SYNERGY, underlined four times. "Four soldiers, four jobs. If two of you do the same thing, one of you is furniture."',
    options: [
      {
        quip: 'Drop and give me twenty, each in a different discipline.',
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
      leave('"We are a team of generalists." The whiteboard weeps.'),
    ],
  },
  exosuits: {
    name: 'Exosuit Prototype',
    text: 'A crashed military transport holds four exosuits, still in their packing foam. The manual has one page: DO NOT CROUCH. Underneath, in pen: seriously, the knees.',
    options: [{ quip: 'Suit up. Cover is for people without a reactor on their back.', text: 'Exosuits: every soldier has +3 armor, but cover gives soldiers no defense', take: (run) => adopt(run, 'exosuits') }, gain(4, 'Sell the suits on the black market as very large toasters.')],
  },
  bunker: {
    name: 'Bunker Plans',
    text: 'A filing cabinet of bunker blueprints, stamped TOP SECRET and, below that, ALSO FILED ON THE PUBLIC WIKI. Whatever the squad learns from them, the aliens will have read too.',
    options: [{ quip: 'Sandbag everything. Sandbag the sandbags.', text: 'Fortification Doctrine: low cover stops 30% of shots and high cover 60%, for both sides', take: (run) => adopt(run, 'fortified') }, leave('Leave the cabinet for the aliens. Let them do the reading.')],
  },
  shotguns: {
    name: 'Smuggled Shotguns',
    text: 'A crate rattles in the back of an abandoned pickup. The label says MEDICAL SUPPLIES. Inside: shotguns, sawn short enough to fit in a lunchbox. One has "AIM? NO." carved into the stock.',
    options: [{ quip: 'Range is a state of mind.', text: 'Scatterguns: every soldier has +2 damage and 2 less range', take: (run) => adopt(run, 'scatterguns') }, gain(4, 'Return them to the medical supply chain, for a fee.')],
  },
  armory: {
    name: 'Ancient Armory',
    text: `The city museum's Hall of Arms stands untouched, because aliens do not do culture. Katanas, claymores, one suspiciously modern chainsword. The placard: PLEASE DO NOT TOUCH THE EXHIBITS.`,
    options: [{ quip: 'Touch the exhibits. Touch all of them.', text: `Blademasters: ${DOCTRINES.blades.text}`, take: (run) => adopt(run, 'blades') }, gain(4, 'Pawn the chainsword. It is clearly a replica. Probably.')],
  },
  awakening: {
    name: 'Psionic Awakening',
    text: "An alien broadcast leaks into the squad's radios, and now everyone can hear what everyone else is thinking. Mostly it is about lunch. With practice, it could be about killing things through walls.",
    options: [{ quip: 'Think violent thoughts, together, in unison.', text: `Psi Operatives: ${DOCTRINES.psionics.text}`, take: (run) => adopt(run, 'psionics') }, leave('Switch the radios off and agree never to discuss what anyone heard.')],
  },
  quarry: {
    name: 'Demolition Crew',
    text: 'A quarry crew in hard hats waves the squad over, surrounded by crates marked EXPLOSIVE and FRAGILE and, on one, SORRY. "You lot hide behind walls a lot," says the foreman. "Have you tried not having walls?"',
    options: [{ quip: 'Yes. Yes, we have not tried not having walls.', text: `Demolitions: ${DOCTRINES.demolitions.text}`, take: (run) => adopt(run, 'demolitions') }, gain(4, 'Buy the SORRY crate off them, then sell it to someone you dislike.')],
  },
  creed: {
    name: "Gunslinger's Creed",
    text: 'A drifter in a long coat leans on a burned-out car, a pistol in each hand, spinning both. "Aiming," they drawl, "is for people with one gun."',
    options: [{ quip: 'Two guns. Zero plans. Infinite style.', text: `Gunslingers: ${DOCTRINES.gunslingers.text}`, take: (run) => adopt(run, 'gunslingers') }, leave('Point out that they just dropped one. Walk away while they look.')],
  },
  refugees: {
    name: 'Refugees',
    text: 'A column of survivors blocks the road: grandparents, a goat, a teenager livestreaming. The aliens are not far behind, and the goat is very loud.',
    options: [
      { quip: 'Feed the goat. The goat has earned this.', text: 'Shelter them: -4 supplies, -2 threat', can: (run) => run.supplies >= 4, take: (run) => ((run.supplies -= 4), raise(run, -2)) },
      { quip: '"Anyone who can lift a rifle, step forward." The goat steps forward.', text: 'Recruit the fit: a new clone joins; +2 threat', take: (run) => (hire(run), raise(run, 2)) },
      leave('Wave, smile, and take the other road very quickly.'),
    ],
  },
  artifact: {
    name: 'Alien Artifact',
    text: 'Something glows at the bottom of a fresh crater, humming a tune that is almost a ringtone. It is definitely a trap. It is also definitely shiny.',
    options: [
      {
        quip: 'Pocket the glowing thing. Ignore the countdown.',
        text: 'Take it: a random relic; +2 threat',
        can: (run) => unheld(run).length > 0,
        take: (run) => {
          const relics = unheld(run)
          run.relics.push(relics[randomInt(run, relics.length)])
          raise(run, 2)
        },
      },
      leave('Some ringtones are best left unanswered.'),
    ],
  },
  market: {
    name: 'Black Market',
    text: `Behind a laundromat, a trader in a very nice suit runs a stall with no sign. "Clones, organs, alien sidearms, warranties void. I'll pay well for a trained one. I don't ask what happens to them, and neither should you."`,
    options: [
      {
        quip: 'Everybody chip in for a new paint job. Somebody has to be the chip.',
        text: 'Sell a clone: your lowest-level soldier leaves; +10 supplies',
        can: (run) => run.soldiers.length > 1,
        take: (run) => {
          const worst = run.soldiers.reduce((low, s) => (level(s) < level(low) ? s : low))
          run.soldiers = run.soldiers.filter((s) => s !== worst)
          run.supplies += 10
        },
      },
      leave('"We don\'t sell our own." Out loud, anyway.'),
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
