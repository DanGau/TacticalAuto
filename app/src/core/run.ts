import { BASE_STATS, createBattle, type Battle, type Stats } from './battle'
import { CLASSES, type ClassId } from './classes'
import { random, randomInt } from './rng'
import { AID, FACILITIES, RARITY_CHANCE, type AidId, type FacilityId, type Lasting, type Rarity } from './base'

/** Rounds before the final assault. */
export const ROUNDS = 20
export const REGIONS = ['North America', 'South America', 'Europe', 'Africa', 'Asia', 'Oceania']
/** A region at this threat forces a last stand. */
export const THREAT_MAX = 5
export const START_THREAT = 1
/** Regions the aliens strike each round; the player answers one. */
export const STRIKES = 3
/** Threat a skipped strike adds to its region. */
export const SKIP_THREAT = 1
/** Threat a lost strike adds to its region. */
export const LOSS_THREAT = 2
/** Threat a won strike removes from its region. */
export const WIN_THREAT = 1
export const BASE_SQUAD = 4
export const OFFERS = 3
export const START_SUPPLIES = 3
/** Supplies a won mission pays; a hard strike pays HARD_SUPPLIES more. */
export const WIN_SUPPLIES = 2
export const HARD_SUPPLIES = 1

/** Experience needed for each rank; a soldier earns one per battle survived. */
export const RANK_XP = [0, 1, 3, 6, 10]
export const RANK_NAMES = ['Rookie', 'Squaddie', 'Corporal', 'Sergeant', 'Captain']
/** What each rank adds to a soldier's stats. */
export const RANK_STATS: Partial<Stats> = { hp: 1, aim: 0.03 }

const NAMES = ['Vega', 'Okafor', 'Lindqvist', 'Tanaka', 'Reyes', 'Novak', 'Haddad', 'Brandt', 'Silva', 'Kowalski', 'Mbeki', 'Dufour', 'Ivanov', 'Castillo', 'Ng', 'Shaw']

export interface Soldier {
  id: number
  name: string
  xp: number
  /** Null for a rookie; drawn at random on first promotion. */
  cls: ClassId | null
}

/**
 * A battle on offer. A strike is optional; a last stand or the final assault is the round's only mission,
 * and losing it loses the run.
 */
export interface Mission {
  kind: 'strike' | 'lastStand' | 'final'
  /** Index into REGIONS; -1 for the final assault. */
  region: number
  aliens: number
  /** A hard strike has one more alien, pays more supplies, and guarantees a rare or better offer. */
  hard: boolean
}

/** What the last battle changed, for the player to review. */
export interface Report {
  won: boolean
  /** Threat before the mission, after its outcome, and after the skipped strikes then landed. */
  threat: { before: number[]; afterMission: number[]; afterAliens: number[] }
  /** Supplies the mission paid. */
  supplies: number
  /** Every soldier in the squad when the battle began. */
  /** `cls` is the class after the battle. */
  soldiers: { name: string; cls: ClassId | null; xpBefore: number; xpAfter: number; died: boolean }[]
}

export interface Run {
  seed: number
  rng: number
  /** Starts at 1; past ROUNDS, the round is the final assault. */
  round: number
  phase: 'map' | 'battle' | 'reward' | 'won' | 'lost'
  /** Threat per region, in REGIONS order. */
  threat: number[]
  /** Missions on offer this round. */
  missions: Mission[]
  /** The mission being fought or last fought. */
  mission: Mission | null
  /** The battle being fought or last fought. */
  battle: Battle | null
  /** Null until a battle ends. */
  report: Report | null
  soldiers: Soldier[]
  nextSoldier: number
  supplies: number
  /** Facilities built, one entry per level. */
  built: FacilityId[]
  /** Aid taken. */
  aid: AidId[]
  /** Aid to choose from in the reward phase. */
  offers: AidId[]
}

export function rank(soldier: { xp: number }): number {
  return RANK_XP.findLastIndex((xp) => soldier.xp >= xp)
}

/** The sum of one lasting effect over every facility level built and aid taken. */
function total(run: Run, effect: (source: Lasting) => number | undefined): number {
  const sources: Lasting[] = [...run.built.map((id) => FACILITIES[id]), ...run.aid.map((id) => AID[id])]
  return sources.reduce((sum, source) => sum + (effect(source) ?? 0), 0)
}

export function level(run: Run, id: FacilityId): number {
  return run.built.filter((b) => b === id).length
}

/** Supplies the facility's next level costs, or null at its maximum. */
export function buildCost(run: Run, id: FacilityId): number | null {
  const facility = FACILITIES[id]
  return level(run, id) < facility.max ? facility.cost * (level(run, id) + 1) : null
}

/** Builds the facility's next level. The caller checks it is affordable. */
export function build(run: Run, id: FacilityId): void {
  run.supplies -= buildCost(run, id)!
  run.built.push(id)
  recruit(run)
}

/** Supplies winning the mission pays. */
export function payout(mission: Mission): number {
  return mission.kind === 'final' ? 0 : WIN_SUPPLIES + (mission.hard ? HARD_SUPPLIES : 0)
}

export function squadSize(run: Run): number {
  return BASE_SQUAD + total(run, (u) => u.squad)
}

/** A soldier's stats in battle: base, plus class, plus rank, plus facilities and aid. */
export function soldierStats(run: Run, soldier: Soldier): Stats {
  const stats = { ...BASE_STATS }
  for (const key of Object.keys(stats) as (keyof Stats)[]) {
    const fromClass = soldier.cls ? (CLASSES[soldier.cls].stats[key] ?? 0) : 0
    stats[key] += fromClass + rank(soldier) * (RANK_STATS[key] ?? 0) + total(run, (u) => u.stats?.[key])
  }
  return stats
}

/** Alien stats grow every three rounds. */
function alienStats(round: number): Stats {
  const tier = Math.floor((round - 1) / 3)
  return { ...BASE_STATS, hp: BASE_STATS.hp + 3 * tier, aim: BASE_STATS.aim + 0.05 * tier }
}

function alienCount(round: number, kind: Mission['kind'], hard: boolean): number {
  const extra = { strike: 0, lastStand: 2, final: 3 }[kind]
  return 4 + Math.floor((round - 1) / 3) + extra + (hard ? 1 : 0)
}

/** Gives every promoted soldier still without a class one at random. */
function assignClasses(run: Run): void {
  const ids = Object.keys(CLASSES) as ClassId[]
  for (const soldier of run.soldiers) {
    if (soldier.cls === null && rank(soldier) > 0) soldier.cls = ids[randomInt(run, ids.length)]
  }
}

/** Fills the squad with recruits, each named unlike the living. */
function recruit(run: Run): void {
  const xp = RANK_XP[Math.min(total(run, (u) => u.recruitRank), RANK_XP.length - 1)]
  while (run.soldiers.length < squadSize(run)) {
    const free = NAMES.filter((name) => !run.soldiers.some((s) => s.name === name))
    run.soldiers.push({ id: run.nextSoldier++, name: free[randomInt(run, free.length)], xp, cls: null })
  }
  assignClasses(run)
}

/** Sets the missions for the current round and opens the map. */
function beginRound(run: Run): void {
  run.phase = 'map'
  const mission = (kind: Mission['kind'], region: number, hard: boolean): Mission => ({
    kind,
    region,
    hard,
    aliens: alienCount(run.round, kind, hard),
  })
  const overrun = run.threat.indexOf(THREAT_MAX)
  if (run.round > ROUNDS) {
    run.missions = [mission('final', -1, false)]
  } else if (overrun >= 0) {
    run.missions = [mission('lastStand', overrun, false)]
  } else {
    const regions = REGIONS.map((_, i) => i)
    run.missions = []
    while (run.missions.length < STRIKES) {
      const [region] = regions.splice(randomInt(run, regions.length), 1)
      run.missions.push(mission('strike', region, random(run) < 0.5))
    }
  }
}

export function createRun(seed: number): Run {
  const run: Run = {
    seed,
    rng: seed,
    round: 1,
    phase: 'map',
    threat: REGIONS.map(() => START_THREAT),
    missions: [],
    mission: null,
    battle: null,
    report: null,
    soldiers: [],
    nextSoldier: 1,
    supplies: START_SUPPLIES,
    built: [],
    aid: [],
    offers: [],
  }
  recruit(run)
  beginRound(run)
  return run
}

/** `threat` with `amount` added to one region, or to every region when `region` is 'all', kept within bounds. */
function addThreat(threat: number[], region: number | 'all', amount: number): number[] {
  return threat.map((t, i) => (region === 'all' || region === i ? Math.min(Math.max(t + amount, 0), THREAT_MAX) : t))
}

/** `threat` once every mission on offer other than `mission` has gone unanswered. */
function threatOnSkipping(threat: number[], run: Run, mission: Mission): number[] {
  return run.missions.reduce((t, other) => (other === mission ? t : addThreat(t, other.region, SKIP_THREAT)), threat)
}

/** Threat once `mission` is fought, or null when losing it ends the run. The final assault leaves threat alone. */
function threatOnOutcome(threat: number[], mission: Mission, won: boolean): number[] | null {
  if (mission.kind === 'final') return won ? threat : null
  if (mission.kind === 'lastStand') return won ? addThreat(threat, mission.region, -THREAT_MAX) : null
  return addThreat(threat, mission.region, won ? -WIN_THREAT : LOSS_THREAT)
}

/** What choosing a mission on offer leads to: threat per region after a win and after a loss; null ends the run. */
export function preview(run: Run, mission: Mission): { won: number[]; lost: number[] | null } {
  const after = (won: boolean) => {
    const threat = threatOnOutcome(run.threat, mission, won)
    return threat && threatOnSkipping(threat, run, mission)
  }
  return { won: after(true)!, lost: after(false) }
}

/** Starts the battle for a mission on offer. */
export function startMission(run: Run, mission: Mission): void {
  run.mission = mission
  run.phase = 'battle'
  const aliens = Array.from({ length: mission.aliens }, () => alienStats(run.round))
  const reserve = run.soldiers.map((s) => ({
    soldier: s.id,
    stats: soldierStats(run, s),
    ability: s.cls && CLASSES[s.cls].ability,
    charges: s.cls ? CLASSES[s.cls].charges : 0,
  }))
  run.battle = createBattle(randomInt(run, 2 ** 31), aliens, reserve)
}

/** Three different aid cards; a hard mission's first is rare or better. */
function drawOffers(run: Run, hard: boolean): AidId[] {
  const offers: AidId[] = []
  while (offers.length < OFFERS) {
    let roll = random(run)
    if (hard && offers.length === 0) roll = RARITY_CHANCE.common + roll * (1 - RARITY_CHANCE.common)
    const rarity: Rarity = roll < RARITY_CHANCE.common ? 'common' : roll < RARITY_CHANCE.common + RARITY_CHANCE.rare ? 'rare' : 'epic'
    const pool = (Object.keys(AID) as AidId[]).filter((id) => AID[id].rarity === rarity && !offers.includes(id))
    if (pool.length > 0) offers.push(pool[randomInt(run, pool.length)])
  }
  return offers
}

function nextRound(run: Run): void {
  run.round++
  beginRound(run)
}

/** Settles a finished battle: experience, casualties, threat, the strikes left unanswered, and what comes next. */
export function endBattle(run: Run): void {
  const battle = run.battle!
  const mission = run.mission!
  const dead = new Set(run.soldiers.map((s) => s.id))
  for (const survivor of [...battle.units, ...battle.reserve]) if (survivor.soldier !== null) dead.delete(survivor.soldier)
  const fought = new Set(battle.units.map((u) => u.soldier))
  const xpBefore = run.soldiers.map((s) => s.xp)
  for (const s of run.soldiers) if (fought.has(s.id)) s.xp++
  assignClasses(run)
  const soldiers = run.soldiers.map((s, i) => ({ name: s.name, cls: s.cls, xpBefore: xpBefore[i], xpAfter: s.xp, died: dead.has(s.id) }))
  run.soldiers = run.soldiers.filter((s) => !dead.has(s.id))
  recruit(run)

  const won = battle.winner === 'human'
  const before = run.threat
  const afterMission = threatOnOutcome(before, mission, won)
  if (afterMission) run.threat = threatOnSkipping(afterMission, run, mission)
  const supplies = won ? payout(mission) : 0
  run.supplies += supplies
  run.report = { won, threat: { before, afterMission: afterMission ?? before, afterAliens: run.threat }, supplies, soldiers }

  if (!afterMission) {
    run.phase = 'lost'
  } else if (mission.kind === 'final') {
    run.phase = 'won'
  } else if (won) {
    run.offers = drawOffers(run, mission.hard)
    run.phase = 'reward'
  } else {
    nextRound(run)
  }
}

/** Takes offered aid, applies what it does at once, and moves to the next round. */
export function takeAid(run: Run, id: AidId): void {
  const aid = AID[id]
  run.aid.push(id)
  run.offers = []
  run.supplies += aid.supplies ?? 0
  if (aid.threat) run.threat = addThreat(run.threat, 'all', aid.threat)
  for (const soldier of run.soldiers) soldier.xp += aid.xp ?? 0
  if (aid.promote) {
    const lowest = run.soldiers.reduce((low, soldier) => (soldier.xp < low.xp ? soldier : low))
    lowest.xp = Math.max(lowest.xp, RANK_XP[aid.promote])
  }
  assignClasses(run)
  nextRound(run)
}
