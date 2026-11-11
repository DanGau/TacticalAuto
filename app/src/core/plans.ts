// The picks a hero plans on: the path its weapon favors, then each row's skill that pays, and the perks worth most to it.
import type { ClassId } from './classes'
import type { PerkId } from './perks'
import type { Soldier } from './run-state'
import { committed, pathOf, type SkillId } from './skills'
import { minorOffers, skillOffers, weaponOf } from './squad'
import { WEAPONS, type WeaponId } from './weapons'

/** The path each class takes when its weapon favors none: of the paths, what wins most on the same seeds. */
export const PLANS: Record<ClassId, string> = {
  assault: 'Rampage',
  heavy: 'Bastion',
  sniper: 'Ghost',
  engineer: 'Drone Hive',
  support: 'Aegis',
  pyro: 'Ember Hide',
  cryo: 'Glacier',
  phantom: 'Shade',
}

/** Whether a skill pays for this hero's weapon. */
function pays(soldier: Soldier, id: SkillId): boolean {
  return NEEDS[id]?.(soldier.gear?.weapon, !!soldier.gear && !!WEAPONS[soldier.gear.weapon].melee) ?? true
}

/** Skills that pay only with some weapon, or in melee or at range. */
const NEEDS: Partial<Record<SkillId, (weapon: WeaponId | undefined, melee: boolean) => boolean>> = {
  shieldSlam: (w) => w === 'shield',
  projectile: (w) => w === 'hammer' || w === 'fists',
  faultLine: (_, melee) => melee,
  rimeGrip: (_, melee) => melee,
  cutthroat: (_, melee) => melee,
  tremor: (_, melee) => melee,
  concussiveForce: (_, melee) => melee,
  artillery: (_, melee) => !melee,
  iceLance: (_, melee) => !melee,
  hunker: (_, melee) => !melee,
}

/** The skill a hero plans on. At the first pick, the path with the most that pays it and the least that does not, its class's plan on a tie; then the row's first that pays. */
export function plannedSkill(soldier: Soldier): number {
  const cls = soldier.cls!
  const offers = skillOffers(soldier)
  const worth = (id: SkillId) => (pays(soldier, id) ? 0 : -10)
  const fit = (id: SkillId) => {
    const path = pathOf(cls, id)!
    return (path.name === PLANS[cls] ? 2 : 0) + path.rows.flat().reduce((sum, k) => sum + (k in NEEDS ? (pays(soldier, k) ? 1 : -1) : 0), 0)
  }
  const score = committed(cls, soldier.skills) ? worth : fit
  return offers.reduce((best, id, i) => (score(id) > score(offers[best]) ? i : best), 0)
}

/** What a perk is worth to a hero: its class's and survival first, then what suits its weapon; throws pay once it heaves. */
function perkWorth(soldier: Soldier, id: PerkId): number {
  const melee = !!weaponOf(soldier)?.melee
  const worth: Record<PerkId, number> = {
    heave: 3, extraThrow: 2, longThrow: 1, crushingThrow: 3, strongman: 2,
    springLegs: 1, crashLanding: melee ? 3 : 1, freerunner: melee ? 2 : 1, fleetFoot: melee ? 3 : 2, firemansCarry: 1,
    toughness: 4, ironGut: 4, padding: 4, keenEye: 2, longSight: melee ? 0 : 3, firstStrike: 2, finisher: 3, scavenger: 2, secondBreath: 3,
    hardCharger: 3, heavyFrame: 3, scope: 4, extraKit: 5, toolkit: 3, extraFuel: 5, frostLining: 3, deepShadow: 4,
  }
  return worth[id]
}

/** The perk a hero takes: the offer worth most to it. */
export function plannedPerk(soldier: Soldier): number {
  const offers = minorOffers(soldier)
  return offers.reduce((best, id, i) => (perkWorth(soldier, id) > perkWorth(soldier, offers[best]) ? i : best), 0)
}

/** Makes every pick `soldier` owes as it plans, those passed over lost as a player's would be: a recruit's kit by its level. */
export function kitOut(soldier: Soldier): void {
  for (let offers = skillOffers(soldier); offers.length > 0; offers = skillOffers(soldier)) {
    const index = plannedSkill(soldier)
    soldier.lost.push(...offers.filter((_, i) => i !== index))
    soldier.skills.push(offers[index])
  }
  for (let offers = minorOffers(soldier); offers.length > 0; offers = minorOffers(soldier)) soldier.perks.push(offers[plannedPerk(soldier)])
}
