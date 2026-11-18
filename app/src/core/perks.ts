// Minor perks: small upgrades a hero picks at levels without a power, mostly to its basic actions.
import type { Stats } from './battle'
import type { ClassId } from './classes'
import { random } from './rng'
import { TUNING } from './tuning'

/** Perk effects combat applies; each is described where it does. */
export const PERK_EFFECTS = ['heave', 'extraThrow', 'longThrow', 'crushingThrow', 'crashLanding', 'freerunner', 'firstStrike', 'finisher', 'scavenger', 'secondBreath', 'quickDraw'] as const
export type PerkEffect = (typeof PERK_EFFECTS)[number]

export interface Perk<Id extends string = PerkId> {
  name: string
  text: string
  stats?: Partial<Stats>
  effect?: PerkEffect
  /** Added to the uses of the class ability each battle. */
  charges?: number
  /** A perk it must hold first. */
  needs?: Id
  /** The one class it is offered to. */
  cls?: ClassId
}

/** What the effects do, shared with combat. */
export const PERK = { throwDamage: 2, throwRange: 2, landing: 2, firstStrike: 1, finisher: 1, scavenge: 1, breath: 2 }

const perks = {
  heave: { name: 'Heave', text: 'Throw cars, loose objects and small aliens.', effect: 'heave' },
  extraThrow: { name: 'Extra Throw', text: '1 more throw each battle.', effect: 'extraThrow', needs: 'heave' },
  longThrow: { name: 'Far Throw', text: `Throw ${PERK.throwRange} tiles farther.`, effect: 'longThrow', needs: 'heave' },
  crushingThrow: { name: 'Crushing Throw', text: `Throws deal ${PERK.throwDamage} more damage.`, effect: 'crushingThrow', needs: 'heave' },
  strongman: { name: 'Strongman', text: 'Gain 1 strength. Throw trucks and bigger aliens.', stats: { strength: 1 }, needs: 'heave' },
  springLegs: { name: 'Spring Legs', text: 'Gain 1 jump.', stats: { jump: 1 } },
  crashLanding: { name: 'Crash Landing', text: `On landing a jump, deal ${PERK.landing} damage to adjacent aliens.`, effect: 'crashLanding', needs: 'springLegs' },
  freerunner: { name: 'Freerunner', text: 'Climbing, jumping and rough ground cost only the tiles crossed.', effect: 'freerunner', needs: 'springLegs' },
  fleetFoot: { name: 'Fleet Foot', text: 'Gain 1 move.', stats: { move: 1 } },
  toughness: { name: 'Toughness', text: 'Gain 2 max HP.', stats: { hp: 2 } },
  ironGut: { name: 'Iron Gut', text: 'Gain 2 max HP.', stats: { hp: 2 }, needs: 'toughness' },
  padding: { name: 'Padding', text: 'Gain 1 Armor.', stats: { armor: 1 }, needs: 'ironGut' },
  keenEye: { name: 'Sharp Eye', text: 'Gain 5% Crit chance.', stats: { crit: 0.05 } },
  longSight: { name: 'Long Sight', text: 'Ranged weapons gain 1 range.', stats: { range: 1 }, needs: 'keenEye' },
  quickDraw: { name: 'Quick Draw', text: 'Weapons with 2+ shots fire 1 more.', effect: 'quickDraw' },
  firstStrike: { name: 'First Strike', text: `First hit each battle: ${PERK.firstStrike} more damage.`, effect: 'firstStrike' },
  finisher: { name: 'Finisher', text: `Deal ${PERK.finisher} more damage to aliens at half HP or less.`, effect: 'finisher' },
  scavenger: { name: 'Scavenger', text: `On kill, heal ${PERK.scavenge}, up to ${TUNING.healCap} each battle.`, effect: 'scavenger' },
  secondBreath: { name: 'Second Breath', text: `First turn each battle started at half HP or less: heal ${PERK.breath}.`, effect: 'secondBreath' },
  hardCharger: { name: 'Hard Charger', text: 'Gain 1 move and 1 jump.', stats: { move: 1, jump: 1 }, cls: 'assault' },
  heavyFrame: { name: 'Heavy Frame', text: 'Gain 1 strength and 2 max HP.', stats: { strength: 1, hp: 2 }, cls: 'heavy' },
  scope: { name: 'Scope', text: 'Gain 5% Crit chance.', stats: { crit: 0.05 }, cls: 'sniper' },
  extraKit: { name: 'Inner Light', text: '1 more Healing Light each battle.', charges: 1, cls: 'support' },
  toolkit: { name: 'Toolkit', text: 'Gain 5% Crit chance.', stats: { crit: 0.05 }, cls: 'engineer' },
  extraFuel: { name: 'Extra Fuel', text: '1 more Fireball each battle.', charges: 1, cls: 'pyro' },
  frostLining: { name: 'Frost Lining', text: 'Gain 3 max HP.', stats: { hp: 3 }, cls: 'cryo' },
  deepShadow: { name: 'Deep Shadow', text: '1 more Cloak each battle.', charges: 1, cls: 'phantom' },
} satisfies Record<string, Perk<string>>

export type PerkId = keyof typeof perks
export const PERKS: Record<PerkId, Perk> = perks as Record<PerkId, Perk>

/** The levels at which a hero picks a perk: those between its power picks. */
export const PERK_LEVELS = [2, 4, 6, 8, 9, 10]

/** Perks on offer at each pick. */
export const PERK_OFFERS = 3

/** The perks a hero would choose from next, drawn from its seed and the perks it holds: those it has not, its class's or any, whose needs it holds. Those passed over stay in the pool. */
export function perkOffers(hero: { seed: number; cls: ClassId | null; perks: PerkId[] }): PerkId[] {
  const open = (Object.keys(PERKS) as PerkId[]).filter((id) => !hero.perks.includes(id) && (!PERKS[id].cls || PERKS[id].cls === hero.cls) && (!PERKS[id].needs || hero.perks.includes(PERKS[id].needs!)))
  const rng = { rng: hero.seed ^ Math.imul(hero.perks.length + 1, 0x9e3779b9) }
  const offers: PerkId[] = []
  while (offers.length < PERK_OFFERS && open.length > 0) offers.push(open.splice(Math.floor(random(rng) * open.length), 1)[0])
  return offers
}
