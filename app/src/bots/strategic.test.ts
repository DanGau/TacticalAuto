import { expect, test } from 'vitest'
import type { Goal } from '../core/goals'
import type { CardId } from '../core/cards'
import { starterDeck } from '../core/deck'
import { drawBattle } from '../core/missions'
import { begun, road } from '../core/roads'
import { apply } from '../core/apply'
import { type Run } from '../core/run-state'
import { verdicts } from '../sim/report'
import type { Row } from '../sim/forks'
import { runWith } from '../sim/run'
import { strategic } from './strategic'
import { PLANS, plannedSkill } from '../core/plans'
import { CLASSES, type ClassId } from '../core/classes'
import { pathOf, powerOf, SKILLS, TREES, type SkillId } from '../core/skills'
import { ULTIMATE_EFFECTS } from '../core/skill-effects'
import { skillOffers, xpFor } from '../core/hero'
import type { WeaponId } from '../core/weapons'

/** A run at the deploy screen of a battle of `goal`, its deck `deck`, all of it in hand. */
function deploying(goal: Goal, deck: CardId[]): Run {
  const run = begun(3)
  run.deck = deck.map((id) => ({ id, level: 1 }))
  road(run, [{ ...drawBattle(run, 'standard'), goal, terrain: 'town', challenge: null, aliens: ['trooper', 'trooper'] }])
  apply(run, { type: 'advance' })
  return run
}

test('the strategic bot plays the card the board pulls on: Evac Line on a rescue, never where no civilians are', () => {
  const on = (goal: Goal) => {
    const run = deploying(goal, ['evac', 'nanoweave', 'plating'])
    const action = strategic(run, { rng: 1 }) as { card: number }
    return run.deck[run.hand[action.card]].id
  }
  expect(on('rescue')).toBe('evac')
  expect(on('cross')).not.toBe('evac')
})

test('it adds a card that lifts its deck and skips one that does not', () => {
  const run = begun(3)
  run.deck = starterDeck()
  run.phase = 'reward'
  run.cardOffers = ['evac', 'uplinkSpike', 'liftFlare']
  expect(strategic(run, { rng: 1 })).toEqual({ type: 'card', index: null })
  run.cardOffers = ['evac', 'chain', 'liftFlare']
  expect(strategic(run, { rng: 1 })).toEqual({ type: 'card', index: 1 })
})

test('the plan: every class names a real path; a hero takes the path its weapon suits, then an ultimate for its capstone', () => {
  const hero = (cls: ClassId, weapon: WeaponId) => {
    const h = { ...begun(3).hero, cls, skills: [powerOf(cls)], lost: [] as SkillId[], xp: xpFor(20) }
    h.gear = { ...h.gear!, weapon }
    for (let offers = skillOffers(h); offers.length > 0; offers = skillOffers(h)) h.skills.push(offers[plannedSkill(h)])
    return h
  }
  for (const cls of Object.keys(CLASSES) as ClassId[]) {
    expect(TREES[cls].paths.map((p) => p.name)).toContain(PLANS[cls])
    expect(ULTIMATE_EFFECTS).toContain(SKILLS[hero(cls, 'rifle').skills.at(-1)!].effect)
  }
  expect(pathOf('heavy', hero('heavy', 'shield').skills[1])!.name).toBe('Bastion')
  expect(pathOf('heavy', hero('heavy', 'rifle').skills[1])!.name).toBe('Cataclysm')
})

test('it plays a run to its end', () => {
  expect(['won', 'lost']).toContain(runWith(5, strategic).won ? 'won' : 'lost')
})

const row = (best: [number, number], worst: [number, number], bot: [number, number]): Row => ({ test: 'slog', leg: 1, screens: 12, best: { won: best[0], lost: best[1] }, worst: { won: worst[0], lost: worst[1] }, bot: { won: bot[0], lost: bot[1] } })

test('the diagnosis tells what is off in the game, and what in the bot', () => {
  expect(verdicts([row([60, 50], [40, 60], [60, 50])])).toContainEqual(expect.stringMatching(/^GAME: Slog .* too hard/))
  expect(verdicts([row([90, 20], [88, 22], [90, 20])])).toContainEqual(expect.stringMatching(/^GAME: the card played hardly matters on Slog/))
  expect(verdicts([row([95, 10], [70, 40], [80, 30])])).toContainEqual(expect.stringMatching(/^BOT: its play on Slog/))
  expect(verdicts([row([95, 10], [70, 40], [93, 12])])).toEqual([])
})
