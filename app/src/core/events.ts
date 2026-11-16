// Unknown stops' events: their choices and what each does.
import { CLASSES, type ClassId } from './classes'
import { DOCTRINES, type DoctrineId } from './doctrines'
import { powerOf } from './skills'
import { offerable } from './relics'
import { random, randomInt } from './rng'
import { advance, current, legOf, nextStop, passStop } from './run'
import { type Run } from './run-state'
import { drawBattle } from './missions'
import { dropGear, gainRelic, loseRelic } from './rewards'
import { settle } from './rewards'
import { stockShop } from './rewards'
import { mend } from './hero'
import { level } from './hero'
import { xpFor } from './hero'
import { STOP_THREAT } from './progress'
import { THREAT_MAX } from './progress'
import { LEG_STOPS } from './progress'

/** One way to meet an event: the hero's quip, what it does, whether the hero can, and doing it. */
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
/** What a shop's medkit costs, and the health it heals the hero: less than a safehouse's full rest. */
export const MEDKIT = { price: 3, heal: 6 }
/** How likely an unknown stop is to be a battle, and a shop; otherwise it is an event. */
const UNKNOWN_CHANCE = { battle: 0.3, shop: 0.3 }

const raise = (run: Run, threat: number) => (run.threat = Math.max(0, Math.min(run.threat + threat, THREAT_MAX)))
/** Adopts a doctrine; a weapon doctrine sets aside the one the hero fought with. */
const adopt = (run: Run, id: DoctrineId) => {
  if (DOCTRINES[id].weapon) run.doctrines = run.doctrines.filter((held) => !DOCTRINES[held].weapon)
  run.doctrines.push(id)
}
const gain = (supplies: number, quip: string): Option => ({ quip, text: `Salvage it: +${supplies} supplies`, take: (run) => (run.supplies += supplies) })
const leave = (quip: string): Option => ({ quip, text: 'Move on', take: () => {} })
/** Relics the hero may be offered. */
const unheld = (run: Run) => offerable(run.relics)
const pick = <T>(run: Run, options: T[]): T => options[randomInt(run, options.length)]
/** Moves a hero `levels` up or down, never below level 1. */
const train = (soldier: Run['hero'], levels: number) => (soldier.xp = xpFor(Math.max(1, level(soldier) + levels)))
/** Whether `n` more stops lie between this one and the satellite. */
const ahead = (run: Run, n = 1) => run.stop + n < LEG_STOPS

/** Wounds the hero `amount`, never below 1 health. */
const hurt = (run: Run, amount: number) => (run.hero.wounds += amount)

const encounters = {
  exosuits: {
    name: 'Power Armor Prototype',
    text: 'A crashed transport holds four suits of power armor, still in their packing foam. The manual has one page: DO NOT CROUCH. Underneath, in pen: seriously, the knees.',
    options: [{ quip: 'Suit up. Walking is for people without a reactor on their back.', text: `Power Armor: ${DOCTRINES.exosuits.text}`, take: (run) => adopt(run, 'exosuits') }, gain(4, 'Sell the suits on the black market as very large toasters.')],
  },
  bunker: {
    name: 'Bunker Plans',
    text: 'A filing cabinet of bunker blueprints, stamped TOP SECRET and, below that, ALSO FILED ON THE PUBLIC WIKI. Whatever the hero learns from them, the aliens will have read too.',
    options: [{ quip: 'Sandbag everything. Sandbag the sandbags.', text: `Iron Skin: ${DOCTRINES.fortified.text}`, take: (run) => adopt(run, 'fortified') }, leave('Leave the cabinet for the aliens. Let them do the reading.')],
  },
  shotguns: {
    name: 'Smuggled Gauntlets',
    text: 'A crate rattles in the back of an abandoned pickup. The label says MEDICAL SUPPLIES. Inside: blast gauntlets, built to reach about as far as a lunchbox. One has "CLOSER" scratched across the knuckles.',
    options: [{ quip: 'Range is a state of mind.', text: `Brawlers: ${DOCTRINES.scatterguns.text}`, take: (run) => adopt(run, 'scatterguns') }, gain(4, 'Return them to the medical supply chain, for a fee.')],
  },
  armory: {
    name: 'Ancient Armory',
    text: `The city museum's Hall of Arms stands untouched, because aliens do not do culture. Katanas, claymores, one suspiciously modern chainsword. The placard: PLEASE DO NOT TOUCH THE EXHIBITS.`,
    options: [{ quip: 'Touch the exhibits. Touch all of them.', text: `Blademasters: ${DOCTRINES.blades.text}`, take: (run) => adopt(run, 'blades') }, gain(4, 'Pawn the chainsword. It is clearly a replica. Probably.')],
  },
  awakening: {
    name: 'Psionic Awakening',
    text: "An alien broadcast leaks into the hero's radio, and now it can hear what the aliens are thinking. Mostly it is about lunch. With practice, it could be about killing things through walls.",
    options: [{ quip: 'Think violent thoughts, together, in unison.', text: `Psi Operatives: ${DOCTRINES.psionics.text}`, take: (run) => adopt(run, 'psionics') }, leave('Switch the radios off and agree never to discuss what anyone heard.')],
  },
  quarry: {
    name: 'Demolition Crew',
    text: 'A quarry crew in hard hats waves the hero over, surrounded by crates marked EXPLOSIVE and FRAGILE and, on one, SORRY. "You lot stand behind walls a lot," says the foreman. "Have you tried not having walls?"',
    options: [{ quip: 'Yes. Yes, we have not tried not having walls.', text: `Demolitions: ${DOCTRINES.demolitions.text}`, take: (run) => adopt(run, 'demolitions') }, gain(4, 'Buy the SORRY crate off them, then sell it to someone you dislike.')],
  },
  creed: {
    name: "Gunslinger's Creed",
    text: 'A drifter in a long coat leans on a burned-out car, a pistol in each hand, spinning both. "Care," they drawl, "is for people with one gun."',
    options: [{ quip: 'Two guns. Zero plans. Infinite style.', text: `Gunslingers: ${DOCTRINES.gunslingers.text}`, take: (run) => adopt(run, 'gunslingers') }, leave('Point out that they just dropped one. Walk away while they look.')],
  },
  headsman: {
    name: 'The Headsman',
    text: 'A hooded figure sharpens an axe on the steps of the courthouse, counting under its breath. "Glory is for one," it says. "Count your dead together, and the third is for all."',
    options: [{ quip: 'We count together.', text: `Executioner's Oath: ${DOCTRINES.reckoning.text}`, take: (run) => adopt(run, 'reckoning') }, leave('Back away. Do not let it count you.')],
  },
  refugees: {
    name: 'Refugees',
    text: 'A column of survivors blocks the road: grandparents, a goat, a teenager livestreaming. The aliens are not far behind, and the goat is very loud.',
    options: [
      { quip: 'Feed the goat. The goat has earned this.', text: 'Shelter them: -4 supplies, -2 threat', can: (run) => run.supplies >= 4, take: (run) => ((run.supplies -= 4), raise(run, -2)) },
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
          gainRelic(run, relics[randomInt(run, relics.length)])
          raise(run, 2)
        },
      },
      leave('Some ringtones are best left unanswered.'),
    ],
  },
  loanShark: {
    name: 'Loan Shark',
    text: 'A man in a tracksuit runs a lending business from the boot of a hatchback. Interest rates are written on a napkin. The napkin has been laminated.',
    options: [
      { quip: 'Sign the napkin. In crayon, so it does not count.', text: 'Borrow: +7 supplies; +2 threat', take: (run) => ((run.supplies += 7), raise(run, 2)) },
      leave('"We are good, thanks." He writes your names down anyway.'),
    ],
  },
  salesman: {
    name: 'Door-to-Door Salesman',
    text: 'A salesman steps out of a crater, brushing off ash, briefcase already open. "Have you got a minute to hear about heroic gear?" He has been following the hero for three stops.',
    options: [
      { quip: '"Fine. Fine! Just stop standing so close."', text: 'Buy: -2 supplies; a random piece of gear', can: (run) => run.supplies >= 2, take: (run) => ((run.supplies -= 2), dropGear(run, false)) },
      { quip: 'Slam the door. There is no door. Slam it anyway.', text: 'Refuse: +1 threat, as he yells about you across the valley', take: (run) => raise(run, 1) },
    ],
  },
  retraining: {
    name: 'Career Fair',
    text: 'In a gutted shopping centre, a careers fair carries on, staffed by one very committed volunteer. "Ever thought about a change? The aliens certainly have."',
    options: [
      {
        quip: 'Fill in the form. Leave "previous experience" blank.',
        text: 'Your hero takes a random other class, forgets its powers and gains a level',
        take: (run) => {
          const cls = pick(run, (Object.keys(CLASSES) as ClassId[]).filter((id) => id !== run.hero.cls))
          run.hero.cls = cls
          run.hero.skills = [powerOf(cls)]
          run.hero.lost = []
          train(run.hero, 1)
        },
      },
      leave('Take a free pen. Take all the free pens.'),
    ],
  },
  collector: {
    name: 'The Collector',
    text: 'An eccentric collector in a fur coat appraises the hero through a monocle. "Your trinkets. I simply must. I have a little trade in mind, or cash, darling, cash."',
    options: [
      {
        quip: '"Surprise us." He claps, delighted, which is worrying.',
        text: 'Swap: a random relic you hold for a random one you do not',
        can: (run) => run.relics.length > 0 && unheld(run).length > 0,
        take: (run) => {
          // What is given up is gone before the new one is drawn, so the new one needs no relic given up.
          const old = loseRelic(run, randomInt(run, run.relics.length))
          gainRelic(run, pick(run, unheld(run).filter((id) => id !== old)) ?? old)
        },
      },
      { quip: 'Cash, darling.', text: 'Sell: a random relic you hold; +8 supplies', can: (run) => run.relics.length > 0, take: (run) => (loseRelic(run, randomInt(run, run.relics.length)), (run.supplies += 8)) },
      leave('Tell him the monocle is fake. Watch his heart break.'),
    ],
  },
  fallen: {
    name: 'Fallen Heroes',
    text: 'Another team got here first, and did not leave. Their gear is still good. Whatever got them is probably not still here. Probably.',
    options: [
      { quip: 'Loot the bodies. Respectfully. With gloves.', text: 'Search: a piece of rare or better gear; +1 threat', take: (run) => (dropGear(run, true), raise(run, 1)) },
      leave('Bow your head, and leave before you find out what "probably" means.'),
    ],
  },
  raiders: {
    name: 'Masked Raiders',
    text: 'Raiders in hockey masks block the road with a burning sofa. "Toll," says the leader, who has clearly practiced this. "All your stuff. Or we find out how tough you are, at the next stop."',
    options: [
      {
        quip: '"We are very tough." Squeak, goes someone\'s boot.',
        text: 'Refuse: every stop the road leads to next becomes an Overrun battle',
        can: (run) => ahead(run),
        take: (run) => {
          for (const i of current(run)!.next) legOf(run).columns[run.stop + 1][i].stop = drawBattle(run, 'dangerous', { ...run, stop: run.stop + 1 })
        },
      },
      { quip: 'Hand it over. The sofa was a nice touch.', text: 'Pay: lose all your supplies', take: (run) => (run.supplies = 0) },
    ],
  },
  fightPit: {
    name: 'Fight Pit',
    text: 'Bookies have caught an alien and a very angry badger, and are taking bets. The crowd is mostly rats and one accountant. The odds are even. The badger looks confident.',
    options: [
      {
        quip: 'Everything on the badger.',
        text: 'Bet: -4 supplies; half the time, +9 supplies',
        can: (run) => run.supplies >= 4,
        take: (run) => (run.supplies += random(run) < 0.5 ? 5 : -4),
      },
      leave('Gambling is wrong. Also, the accountant is giving you a look.'),
    ],
  },
  reactor: {
    name: 'Leaking Reactor',
    text: 'A power plant leaks a warm green glow. Whoever stands in it comes out sharper, faster and very faintly humming. Every alien for miles can see the glow too.',
    options: [
      {
        quip: 'Bring sunscreen.',
        text: 'Bathe: your hero gains a level; +2 threat',
        take: (run) => {
          train(run.hero, 1)
          raise(run, 2)
        },
      },
      leave('Nobody here wants to glow. Not even a bit.'),
    ],
  },
  depot: {
    name: 'Flooded Depot',
    text: 'A supply depot sits under a metre of something that is not water. The crates are fine. Whoever fetches them will come back older and wiser and smelling of regret.',
    options: [
      {
        quip: 'Hold your nose. Hold everything.',
        text: 'Wade in: +6 supplies; your hero loses a level',
        take: (run) => {
          train(run.hero, -1)
          run.supplies += 6
        },
      },
      leave('Nothing in there is worth that smell.'),
    ],
  },
  bloodBank: {
    name: 'Blood Bank',
    text: 'A clinic pays in canned goods for blood, no questions asked, though the nurse does ask whether anyone is part alien. Nobody is sure.',
    options: [
      { quip: 'Roll up your sleeves. Both of them.', text: 'Donate: your hero loses 4 HP; +6 supplies', take: (run) => (hurt(run, 4), (run.supplies += 6)) },
      leave('Keep your blood on the inside, where it works best.'),
    ],
  },
  stims: {
    name: 'Stim Lab',
    text: 'A pharmacist in a hazmat suit sells hero stims from a vending machine he has hot-wired. "Side effects include feeling great. Also, they glow. The aliens love the glow."',
    options: [
      { quip: 'One for now. One for later.', text: 'Buy: -3 supplies; your hero heals 6', can: (run) => run.supplies >= 3, take: (run) => ((run.supplies -= 3), mend(run, 6)) },
      { quip: 'Take the whole machine.', text: 'Steal: your hero heals fully; +3 threat', take: (run) => (mend(run, Infinity), raise(run, 3)) },
      leave('Nothing that glows goes in anyone.'),
    ],
  },
  tunnel: {
    name: 'Smugglers\' Tunnel',
    text: 'A tunnel runs under the next two stops, signposted EXIT and, in smaller letters, MOSTLY. It skips every fight there, and every prize. The aliens will notice the hero has gone missing.',
    options: [
      {
        quip: 'Mind your heads. Mind your everything.',
        text: 'Take it: skip the next two stops and come out at any of the third; +1 threat',
        can: (run) => ahead(run, 2),
        take: (run) => {
          legOf(run).path.push(-1, -1)
          run.stop += 2
          raise(run, 1)
        },
      },
      leave('Tunnels are how horror films start.'),
    ],
  },
} satisfies Record<string, Encounter>

export type EventId = keyof typeof encounters
export const EVENTS: Record<EventId, Encounter> = encounters

/** Opens a shop: gear, relics, and a medkit. */
function openShop(run: Run): void {
  run.shop = stockShop(run)
  run.phase = 'shop'
}

/**
 * Arrives at a shop or an unknown stop. An unknown one is revealed: a battle begins at once, or the hero enters a
 * shop or meets an event not met before this run. Either adds threat as a stop does.
 */
export function arrive(run: Run): void {

  const unknown = nextStop(run) === 'unknown'
  const roll = random(run)
  if (unknown && roll < UNKNOWN_CHANCE.battle) {
    current(run)!.stop = drawBattle(run, 'standard')
    advance(run)
    return
  }
  raise(run, STOP_THREAT)
  run.report = null
  const fresh = (Object.keys(EVENTS) as EventId[]).filter((id) => !run.met.includes(id))
  if (!unknown || roll < UNKNOWN_CHANCE.battle + UNKNOWN_CHANCE.shop || fresh.length === 0) return openShop(run)
  const id = fresh[randomInt(run, fresh.length)]
  run.met.push(id)
  meet(run, id)
}

function meet(run: Run, id: EventId): void {
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
