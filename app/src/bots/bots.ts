import type { Action } from '../core/apply'
import { blocked, DEPLOY_DEPTH, GRID, type Battle } from '../core/battle'
import { randomInt } from '../core/rng'
import type { Run } from '../core/run'
import { UPGRADES } from '../core/upgrades'

/** Chooses the next action whenever the run waits for the player. `rng` is the bot's own, separate from the run's. */
export type Bot = (run: Run, rng: { rng: number }) => Action

/** Chooses every option at random. */
const randomBot: Bot = (run, rng) => {
  if (run.phase === 'map') return { type: 'mission', index: randomInt(rng, run.missions.length) }
  if (run.phase === 'reward') return { type: 'pick', index: randomInt(rng, run.offers.length) }
  const battle = run.battle!
  if (battle.reserve.length === 0) return { type: 'start' }
  for (;;) {
    const x = randomInt(rng, GRID)
    const y = GRID - 1 - randomInt(rng, DEPLOY_DEPTH)
    if (!blocked(battle, x, y)) return { type: 'deploy', x, y }
  }
}

/** The free zone tile nearest the alien centre, front row first, so the squad arrives together. */
function deployTile(battle: Battle): { x: number; y: number } {
  const aliens = battle.units.filter((u) => u.side === 'alien')
  const centre = Math.round(aliens.reduce((sum, u) => sum + u.x, 0) / aliens.length)
  for (let y = GRID - DEPLOY_DEPTH; y < GRID; y++) {
    for (let offset = 0; offset < GRID; offset++) {
      for (const x of [centre - offset, centre + offset]) {
        if (!blocked(battle, x, y)) return { x, y }
      }
    }
  }
  throw new Error('the deployment zone is full')
}

const RARITY_ORDER = ['common', 'rare', 'epic']

/** Answers the strike in the most threatened region, deploys together, and takes the rarest upgrade. */
const heuristicBot: Bot = (run) => {
  const best = <T>(options: T[], value: (option: T) => number) =>
    options.reduce((top, option, index) => (value(option) > value(options[top]) ? index : top), 0)
  if (run.phase === 'map') return { type: 'mission', index: best(run.missions, (m) => run.threat[m.region] ?? 0) }
  if (run.phase === 'reward') return { type: 'pick', index: best(run.offers, (id) => RARITY_ORDER.indexOf(UPGRADES[id].rarity)) }
  const battle = run.battle!
  if (battle.reserve.length === 0) return { type: 'start' }
  return { type: 'deploy', ...deployTile(battle) }
}

export const bots: Record<string, Bot> = { random: randomBot, heuristic: heuristicBot }
