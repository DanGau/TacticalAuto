// The challenge lab: plays each challenge alone, for each party size and rung, with each utility, and prints what it costs.
import { gainRelic } from '../core/rewards'
import { parseArgs } from 'node:util'
import { apply } from '../core/apply'
import { CHALLENGES, forceOf, type ChallengeId } from '../core/challenges'
import type { ClassId } from '../core/classes'
import { generateGear } from '../core/gear'
import { roots } from '../core/skills'
import { GOALS, type Goal } from '../core/goals'
import { fuelTanks } from '../core/objects'
import { offerable } from '../core/relics'
import { randomInt } from '../core/rng'
import { road } from '../core/roads'
import { createRun, legOf } from '../core/run'
import { type Run } from '../core/run-state'
import { hire, skillOffers, soldierStats, xpFor } from '../core/squad'
import { timedFlow } from '../core/step'
import { carries, UTILITY_IDS, type UtilityId } from '../core/utilities'

const { values } = parseArgs({ options: { runs: { type: 'string', default: '30' }, challenge: { type: 'string', default: '' }, party: { type: 'string', default: '1,2,3' }, rung: { type: 'string', default: '0,1,2' }, goal: { type: 'string', default: 'exterminate' }, cls: { type: 'string', default: '' }, none: { type: 'boolean', default: false } } })

/** The level a party of each size has reached by the time it meets a rung, about what a careful run has. */
const levelAt = (party: number, rung: number) => party * 2 - 1 + rung

/** One battle alone: a fresh party of `party`, levelled for where it stands, with a relic a leg, at full health. */
function battle(seed: number, party: number, rung: number, challenge: ChallengeId, utility: UtilityId | null, goal: Goal): { won: boolean; hurt: number; seconds: number } {
  const run = createRun(seed)
  apply(run, { type: 'recruit', index: seed % run.recruits.length })
  apply(run, { type: 'boons', picks: [0, 1] })
  if (values.cls) {
    run.soldiers[0].cls = values.cls as ClassId
    run.soldiers[0].skills = [roots(values.cls as ClassId)[0]]
  }
  while (run.soldiers.length < party) hire(run)
  run.keys = party - 1
  run.stop = rung * 3
  for (const soldier of run.soldiers) {
    soldier.xp = xpFor(levelAt(party, rung))
    while (skillOffers(soldier).length > 0) soldier.skills.push(skillOffers(soldier)[randomInt(run, skillOffers(soldier).length)])
    soldier.gear = generateGear(run, run.nextGear++, party === 1 ? 'common' : 'rare')
  }
  for (let i = 0; i < party - 1; i++) gainRelic(run, offerable(run.relics)[randomInt(run, offerable(run.relics).length)], true)
  run.phase = 'overworld'
  const stop = { kind: 'battle' as const, risk: 'standard' as const, goal, terrain: 'town' as const, challenge, twist: null, aliens: forceOf(challenge, party, rung, GOALS[goal].force) }
  legOf(run).path = Array<number>(run.stop).fill(-1)
  road(run, [stop])
  apply(run, { type: 'advance' })
  const held = utility ? [utility] : []
  run.utilities = held
  const usable = utility !== 'tank' || fuelTanks(run.battle!).length > 0
  apply(run, held.length > 0 && usable ? { type: 'enter', utility: 0, tank: Math.max(0, fuelTanks(run.battle!).length - 1) } : { type: 'enter' })
  let clock = { next: 0, done: 0 }
  while ((run.phase as Run['phase']) === 'battle') clock = timedFlow(run, clock).clock
  const hp = run.report!.soldiers.reduce((sum, s) => sum + s.hp, 0)
  const most = run.soldiers.reduce((sum, s) => sum + soldierStats(run, s).hp, 0)
  return { won: run.report!.won, hurt: 1 - hp / most, seconds: clock.done / 1000 }
}

const runs = Number(values.runs)
const challenges = (values.challenge ? values.challenge.split(',') : Object.keys(CHALLENGES)) as ChallengeId[]
const pct = (n: number) => `${Math.round(100 * n)}%`.padStart(5)
console.log('challenge    party rung utility       won  health lost  seconds')
for (const challenge of challenges) {
  for (const party of values.party.split(',').map(Number)) {
    for (const rung of values.rung.split(',').map(Number)) {
      const answers = CHALLENGES[challenge].answers
      const others = UTILITY_IDS.filter((id) => !carries(id, answers))
      for (const utility of (values.none ? [null] : [null, ...answers, 'other']) as (UtilityId | 'other' | null)[]) {
        const results = Array.from({ length: runs }, (_, i) => battle(1000 + i, party, rung, challenge, utility === 'other' ? others[i % others.length] : utility, values.goal as Goal))
        const mean = (value: (r: (typeof results)[number]) => number) => results.reduce((sum, r) => sum + value(r), 0) / runs
        console.log(`${challenge.padEnd(12)} ${party}     ${rung}    ${(utility ?? 'none').padEnd(13)}${pct(mean((r) => (r.won ? 1 : 0)))}${pct(mean((r) => r.hurt)).padStart(10)}${mean((r) => r.seconds).toFixed(0).padStart(9)}`)
      }
    }
  }
}
