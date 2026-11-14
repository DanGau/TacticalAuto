import { describe, expect, it } from 'vitest'
import type { Side } from '../core/battle'
import type { GameEvent } from '../core/combat-event'
import { beat, type Player } from './beat'

/** A player whose step passes the turn and returns `events`, logging each call in order. */
function player(events: GameEvent[]): { p: Player; log: string[] } {
  const log: string[] = []
  let turn: Side = 'alien'
  const p: Player = {
    step: () => ((turn = 'human'), events),
    turn: () => turn,
    settle: async () => void log.push('settle'),
    update: () => void log.push('update'),
    pause: async () => void log.push('pause'),
    show: async () => {
      log.push('play')
      await Promise.resolve()
      log.push('played')
      log.push('update')
    },
  }
  return { p, log }
}

describe('beat', () => {
  it('shows the end only once the last beat has played', async () => {
    const { p, log } = player([{ type: 'escaped', id: 1 }, { type: 'end', winner: 'human' }])
    await beat(p)
    expect(log.indexOf('update')).toBeGreaterThan(log.indexOf('played'))
  })

  it('turns the dial before playing a beat that passes the turn', async () => {
    const { p, log } = player([{ type: 'escaped', id: 1 }])
    await beat(p)
    expect(log.indexOf('update')).toBeLessThan(log.indexOf('play'))
  })
})
