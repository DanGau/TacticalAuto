// Plays each mission alone at each leg, for a weak and a strong squad, and prints win rates.
import { parseArgs } from 'node:util'
import { bots } from '../bots/bots'
import { apply } from '../core/apply'
import { CIVILIANS, type Goal } from '../core/goals'
import { generateGear, SLOTS, type Gear, type Slot } from '../core/gear'
import { offerable } from '../core/relics'
import { randomInt } from '../core/rng'
import { atKey, begun, road } from '../core/roads'
import { KEYS, legOf } from '../core/run'
import { type Run } from '../core/run-state'
import { drawBattle } from '../core/missions'
import { hire } from '../core/squad'
import { soldierStats } from '../core/squad'
import { skillOffers } from '../core/squad'
import { xpFor } from '../core/squad'
import { THREAT_MAX } from '../core/progress'
import { step } from '../core/step'
import { ENCOUNTER_BANDS, type Encounter, type Squad } from './report'

/*
 * Plays each mission in isolation at each leg, for a weak and a strong squad, and prints how often it is won against
 * ENCOUNTER_BANDS. `--mission` picks missions, comma-separated.
 */

/** A rare piece of gear for `slot`. */
function rare(run: Run, slot: Slot): Gear {
  for (;;) {
    const gear = generateGear(run, run.nextGear++, 'rare')
    if (gear.slot === slot) return gear
  }
}

/**
 * Plays one mission in isolation, from a fresh run made to stand at leg `leg` with a squad of `squad` strength:
 * as many soldiers as the leg has, a weak one at the levels a careless run reaches with no gear, a strong one levelled
 * up, in rare gear, with a relic a leg.
 */
function encounter(seed: number, mission: Encounter, leg: number, squad: Squad): { won: boolean; rescued: number | null; hurt: number } {
  const run = begun(seed)
  run.soldiers[0].skills.splice(1)
  while (run.soldiers.length < Math.min(leg, KEYS) + 1) hire(run)
  run.keys = Math.min(leg, KEYS)
  const levels = squad === 'strong' ? 2 + 2 * leg : 1 + leg
  for (const soldier of run.soldiers) {
    soldier.xp = xpFor(levels)
    // Skills owed are learned at random.
    while (skillOffers(soldier).length > 0) soldier.skills.push(skillOffers(soldier)[randomInt(run, skillOffers(soldier).length)])
    if (squad === 'strong') for (const slot of SLOTS) soldier.gear[slot] = rare(run, slot)
  }
  if (squad === 'strong') for (let i = 0; i <= leg; i++) run.relics.push(offerable(run.relics)[randomInt(run, offerable(run.relics).length)])
  run.phase = 'overworld'
  if (mission === 'key' || mission === 'final') {
    if (mission === 'final') run.keys = KEYS
    const leg = legOf(run)
    if (mission === 'final') leg.columns[0][0].stop = { kind: 'final', risk: 'standard', goal: 'exterminate', terrain: 'hive', twist: null, aliens: [] }
    atKey(run)
  } else {
    let stop = drawBattle(run, 'standard')
    const goal: Goal = mission === 'ambush' || mission === 'recover' ? 'exterminate' : mission
    for (let tries = 0; stop.goal !== goal && tries < 500; tries++) stop = drawBattle(run, 'standard')
    road(run, [stop])
    if (mission === 'ambush') run.threat = THREAT_MAX
    if (mission === 'recover') run.captives = [run.soldiers.at(-1)!.id]
  }
  apply(run, { type: 'advance' })
  const bot = bots.standard
  const rng = { rng: seed }
  while ((run.phase as Run['phase']) === 'battle') {
    if (run.battle!.phase === 'deploy') apply(run, bot(run, rng))
    else step(run)
  }
  const hp = run.report!.soldiers.reduce((sum, s) => sum + s.hp, 0)
  const most = run.soldiers.reduce((sum, s) => sum + soldierStats(run, s).hp, 0)
  return { won: run.report!.won, rescued: run.report!.rescued, hurt: 1 - hp / most }
}

{
  const { values } = parseArgs({ options: { runs: { type: 'string', default: '40' }, mission: { type: 'string', default: '' } } })
  const runs = Number(values.runs)
  const missions = (values.mission ? values.mission.split(',') : Object.keys(ENCOUNTER_BANDS)) as Encounter[]
  console.log('mission      leg  squad   won   band      health lost  saved')
  for (const mission of missions) {
    for (let leg = mission === 'final' ? KEYS : 0; leg <= (mission === 'final' ? KEYS : KEYS - 1); leg++) {
      if (mission === 'recover' && leg === 0) continue
      for (const squad of ['weak', 'strong'] as const) {
        const results = Array.from({ length: runs }, (_, seed) => encounter(seed, mission, leg, squad))
        const won = results.filter((r) => r.won).length / runs
        const [low, high] = ENCOUNTER_BANDS[mission][squad]
        const saved = mission === 'rescue' ? (results.reduce((sum, r) => sum + (r.rescued ?? 0), 0) / runs).toFixed(1) + ` of ${CIVILIANS}` : ''
        const pct = (n: number) => `${Math.round(100 * n)}%`
        const flag = won < low || won > high ? ' !' : ''
        console.log(`${mission.padEnd(12)} ${String(leg).padEnd(4)} ${squad.padEnd(7)} ${pct(won).padStart(4)}${flag.padEnd(2)} ${`${pct(low)}-${pct(high)}`.padEnd(9)} ${pct(results.reduce((sum, r) => sum + r.hurt, 0) / runs).padStart(11)}  ${saved}`)
      }
    }
  }
}
