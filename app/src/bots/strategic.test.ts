import { expect, test } from 'vitest'
import { CHALLENGES, type ChallengeId } from '../core/challenges'
import { drawBattle } from '../core/missions'
import { begun, road } from '../core/roads'
import { apply } from '../core/apply'
import { type Run } from '../core/run-state'
import { rows, verdicts } from '../sim/report'
import { runWith, type RunResult, type Toll } from '../sim/run'
import { plannedSkill, strategic } from './strategic'
import { CLASSES, type ClassId } from '../core/classes'
import { TREES, type SkillId } from '../core/skills'
import { MAX_SKILLS, skillOffers, xpFor } from '../core/squad'

function deploying(challenge: ChallengeId, held: Run['utilities']): Run {
  const run = begun(3)
  run.utilities = held
  road(run, [{ ...drawBattle(run, 'standard'), goal: 'exterminate', terrain: 'town', challenge, aliens: ['trooper', 'trooper'] }])
  apply(run, { type: 'advance' })
  return run
}

test.each(Object.keys(CHALLENGES) as ChallengeId[])('the strategic bot takes the answer it holds into a %s', (challenge) => {
  const [answer] = CHALLENGES[challenge].answers
  const decoy = (['hover', 'smoke', 'crack'] as const).filter((id) => !CHALLENGES[challenge].answers.includes(id))
  const run = deploying(challenge, [...decoy.slice(0, 2), answer])
  expect(strategic(run, { rng: 1 })).toMatchObject({ type: 'enter', utility: 2 })
})

test('the plan: every class names a real branch and an opener outside it, reaches tier 4 in the picks it has', () => {
  for (const cls of Object.keys(CLASSES) as ClassId[]) {
    const hero = { ...begun(3).soldiers[0], cls, skills: [] as SkillId[], xp: xpFor(20) }
    for (let i = 0; i < MAX_SKILLS; i++) hero.skills.push(skillOffers(hero)[plannedSkill(hero)])
    expect(TREES[cls].some(({ tiers }) => tiers[3].some((id) => hero.skills.includes(id)))).toBe(true)
  }
})

test('with a utility to spare, it keeps what answers the most, and plays a run to its end', () => {
  const run = deploying('swarm', ['overcharge', 'crack', 'hover'])
  run.spare = 'meleeShield'
  run.legs[0].columns[0][0].stop = { ...run.legs[0].columns[0][0].stop!, challenge: 'swarm' }
  expect(strategic(run, { rng: 1 })).toMatchObject({ type: 'keep' })
  expect(['won', 'lost']).toContain(runWith(5, strategic).won ? 'won' : 'lost')
})

const toll = (challenge: ChallengeId, answer: Toll['answer'], won: boolean, lost: number): Toll => ({ nth: 1, leg: 0, party: 1, won, goal: 'exterminate', challenge, answer, most: 100, before: 100, after: 100 - lost, downed: 0 })
const of = (tolls: Toll[]) => rows([{ tolls } as RunResult])

test('the diagnosis tells the game from the bot', () => {
  const twelve = (t: Toll) => Array<Toll>(12).fill(t)
  expect(verdicts(of(twelve(toll('slog', 'picked', false, 80))))).toContainEqual(expect.stringMatching(/^GAME: Slog .* too hard/))
  expect(verdicts(of([toll('slog', 'held', false, 80)]))).toContainEqual(expect.stringMatching(/^BOT: held an answer to Slog/))
  expect(verdicts(of(twelve(toll('slog', 'none', true, 5))))).toContainEqual(expect.stringMatching(/^GAME: a mismatch on Slog/))
  expect(verdicts(of([...twelve(toll('slog', 'picked', true, 40)), ...twelve(toll('slog', 'none', true, 30))]))).toContainEqual(expect.stringMatching(/^GAME: the answer to Slog/))
  expect(verdicts(of([...twelve(toll('slog', 'picked', true, 10)), ...twelve(toll('slog', 'none', false, 60))]))).toEqual([])
})
