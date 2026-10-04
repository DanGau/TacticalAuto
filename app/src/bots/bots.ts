import type { Action } from '../core/apply'
import { randomInt } from '../core/rng'
import { blocked, DEPLOY_DEPTH, GRID, SQUAD, type State } from '../core/state'

/** Chooses the next action in the deploy phase. `rng` is the bot's own, separate from the battle's. */
export type Bot = (state: State, rng: { rng: number }) => Action

const squadFull = (state: State) => state.units.filter((u) => u.side === 'human').length >= SQUAD

/** Deploys on random tiles of the zone. */
const randomBot: Bot = (state, rng) => {
  if (squadFull(state)) return { type: 'start' }
  for (;;) {
    const x = randomInt(rng, GRID)
    const y = GRID - 1 - randomInt(rng, DEPLOY_DEPTH)
    if (!blocked(state, x, y)) return { type: 'deploy', x, y }
  }
}

/** Deploys on the free tiles nearest the alien centre, front row first, so the squad arrives together. */
const heuristicBot: Bot = (state) => {
  if (squadFull(state)) return { type: 'start' }
  const aliens = state.units.filter((u) => u.side === 'alien')
  const centre = Math.round(aliens.reduce((sum, u) => sum + u.x, 0) / aliens.length)
  for (let y = GRID - DEPLOY_DEPTH; y < GRID; y++) {
    for (let offset = 0; offset < GRID; offset++) {
      for (const x of [centre - offset, centre + offset]) {
        if (!blocked(state, x, y)) return { type: 'deploy', x, y }
      }
    }
  }
  throw new Error('the deployment zone is full')
}

export const bots: Record<string, Bot> = { random: randomBot, heuristic: heuristicBot }
