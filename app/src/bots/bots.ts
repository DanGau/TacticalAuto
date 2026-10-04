import type { Action } from '../core/apply'
import { randomInt } from '../core/rng'
import { DEPLOY_DEPTH, GRID, SQUAD, unitAt, type State } from '../core/state'

/** Chooses the next action in the deploy phase. `rng` is the bot's own, separate from the battle's. */
export type Bot = (state: State, rng: { rng: number }) => Action

const squadFull = (state: State) => state.units.filter((u) => u.side === 'human').length >= SQUAD

/** Deploys on random tiles of the zone. */
const randomBot: Bot = (state, rng) => {
  if (squadFull(state)) return { type: 'start' }
  for (;;) {
    const x = randomInt(rng, GRID)
    const y = GRID - 1 - randomInt(rng, DEPLOY_DEPTH)
    if (!unitAt(state, x, y)) return { type: 'deploy', x, y }
  }
}

/** Deploys shoulder to shoulder on the front row, facing the alien centre, so the squad arrives together. */
const heuristicBot: Bot = (state) => {
  if (squadFull(state)) return { type: 'start' }
  const aliens = state.units.filter((u) => u.side === 'alien')
  const centre = Math.round(aliens.reduce((sum, u) => sum + u.x, 0) / aliens.length)
  const left = Math.min(Math.max(centre - Math.floor(SQUAD / 2), 0), GRID - SQUAD)
  const y = GRID - DEPLOY_DEPTH
  for (let x = left; ; x++) if (!unitAt(state, x, y)) return { type: 'deploy', x, y }
}

export const bots: Record<string, Bot> = { random: randomBot, heuristic: heuristicBot }
