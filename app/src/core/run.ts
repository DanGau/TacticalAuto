import { BASE_STATS, createBattle, type Battle, type Stats } from './battle'
import { random, randomInt } from './rng'
import { RARITY_CHANCE, UPGRADES, type Rarity, type Upgrade, type UpgradeId } from './upgrades'

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
  /** A hard strike has one more alien and guarantees a rare or better offer. */
  hard: boolean
}

export interface Run {
  seed: number
  rng: number
  /** Starts at 1; past ROUNDS, the round is the final assault. */
  round: number
  phase: 'map' | 'battle' | 'reward' | 'won' | 'lost'
  /** Threat per region, in REGIONS order. */
  threat: number[]
  /** Missions to choose from in the map phase. */
  missions: Mission[]
  /** The mission being fought or last fought. */
  mission: Mission | null
  /** The battle being fought or last fought. */
  battle: Battle | null
  soldiers: Soldier[]
  nextSoldier: number
  upgrades: UpgradeId[]
  /** Upgrades to choose from in the reward phase. */
  offers: UpgradeId[]
}

export function rank(soldier: Soldier): number {
  return RANK_XP.findLastIndex((xp) => soldier.xp >= xp)
}

/** The sum over held upgrades of one numeric effect. */
function total(run: Run, effect: (upgrade: Upgrade) => number | undefined): number {
  return run.upgrades.reduce((sum, id) => sum + (effect(UPGRADES[id]) ?? 0), 0)
}

export function squadSize(run: Run): number {
  return BASE_SQUAD + total(run, (u) => u.squad)
}

/** A soldier's stats in battle: base, plus rank, plus upgrades. */
export function soldierStats(run: Run, soldier: Soldier): Stats {
  const stats = { ...BASE_STATS }
  for (const key of Object.keys(stats) as (keyof Stats)[]) {
    stats[key] += rank(soldier) * (RANK_STATS[key] ?? 0) + total(run, (u) => u.stats?.[key])
  }
  return stats
}

/** Alien stats grow every four rounds. */
function alienStats(round: number): Stats {
  const tier = Math.floor((round - 1) / 4)
  return { ...BASE_STATS, hp: BASE_STATS.hp + 2 * tier, aim: BASE_STATS.aim + 0.03 * tier }
}

function alienCount(round: number, kind: Mission['kind'], hard: boolean): number {
  const extra = { strike: 0, lastStand: 2, final: 3 }[kind]
  return 3 + Math.floor((round - 1) / 4) + extra + (hard ? 1 : 0)
}

/** Fills the squad with recruits, each named unlike the living. */
function recruit(run: Run): void {
  const xp = RANK_XP[Math.min(total(run, (u) => u.recruitRank), RANK_XP.length - 1)]
  while (run.soldiers.length < squadSize(run)) {
    const free = NAMES.filter((name) => !run.soldiers.some((s) => s.name === name))
    run.soldiers.push({ id: run.nextSoldier++, name: free[randomInt(run, free.length)], xp })
  }
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
    soldiers: [],
    nextSoldier: 1,
    upgrades: [],
    offers: [],
  }
  recruit(run)
  beginRound(run)
  return run
}

const addThreat = (run: Run, region: number, amount: number) => {
  run.threat[region] = Math.min(Math.max(run.threat[region] + amount, 0), THREAT_MAX)
}

/** Starts the battle for a mission on offer. The strikes passed over gain threat. */
export function startMission(run: Run, mission: Mission): void {
  for (const other of run.missions) if (other !== mission) addThreat(run, other.region, SKIP_THREAT)
  run.mission = mission
  run.missions = []
  run.phase = 'battle'
  const aliens = Array.from({ length: mission.aliens }, () => alienStats(run.round))
  const reserve = run.soldiers.map((s) => ({ soldier: s.id, stats: soldierStats(run, s) }))
  run.battle = createBattle(randomInt(run, 2 ** 31), aliens, reserve)
}

/** Three different upgrades the run can still take; a hard mission's first is rare or better. */
function drawOffers(run: Run, hard: boolean): UpgradeId[] {
  const held = (id: UpgradeId) => run.upgrades.filter((u) => u === id).length
  const open = (Object.keys(UPGRADES) as UpgradeId[]).filter((id) => held(id) < ((UPGRADES[id] as Upgrade).max ?? Infinity))
  const offers: UpgradeId[] = []
  while (offers.length < OFFERS) {
    let roll = random(run)
    if (hard && offers.length === 0) roll = RARITY_CHANCE.common + roll * (1 - RARITY_CHANCE.common)
    const rarity: Rarity = roll < RARITY_CHANCE.common ? 'common' : roll < RARITY_CHANCE.common + RARITY_CHANCE.rare ? 'rare' : 'epic'
    const pool = open.filter((id) => UPGRADES[id].rarity === rarity && !offers.includes(id))
    if (pool.length > 0) offers.push(pool[randomInt(run, pool.length)])
  }
  return offers
}

function nextRound(run: Run): void {
  run.round++
  beginRound(run)
}

/** Settles a finished battle: experience, casualties, threat, and what comes next. */
export function endBattle(run: Run): void {
  const battle = run.battle!
  const mission = run.mission!
  const dead = new Set(run.soldiers.map((s) => s.id))
  for (const survivor of [...battle.units, ...battle.reserve]) if (survivor.soldier !== null) dead.delete(survivor.soldier)
  for (const unit of battle.units) {
    const soldier = run.soldiers.find((s) => s.id === unit.soldier)
    if (soldier) soldier.xp++
  }
  run.soldiers = run.soldiers.filter((s) => !dead.has(s.id))
  recruit(run)

  const won = battle.winner === 'human'
  if (mission.kind === 'final') {
    run.phase = won ? 'won' : 'lost'
  } else if (!won && mission.kind === 'lastStand') {
    run.phase = 'lost'
  } else if (!won) {
    addThreat(run, mission.region, LOSS_THREAT)
    nextRound(run)
  } else {
    addThreat(run, mission.region, mission.kind === 'lastStand' ? -THREAT_MAX : -WIN_THREAT)
    run.offers = drawOffers(run, mission.hard)
    run.phase = 'reward'
  }
}

/** Takes an offered upgrade and moves to the next round. */
export function takeUpgrade(run: Run, id: UpgradeId): void {
  run.upgrades.push(id)
  run.offers = []
  const { threat } = UPGRADES[id] as Upgrade
  if (threat) REGIONS.forEach((_, region) => addThreat(run, region, threat))
  recruit(run)
  nextRound(run)
}
