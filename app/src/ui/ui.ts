import type { Action } from '../core/apply'
import { SQUAD, type State } from '../core/state'
import { tileAt } from '../view/view'

const NAME = { human: 'Humans', alien: 'Aliens' }

export interface Ui {
  /** Shows `state` in the status line. */
  update(state: State): void
}

/** Turns clicks into actions and hands them to `act`. */
export function createUi(canvas: HTMLCanvasElement, act: (action: Action) => void): Ui {
  const status = document.getElementById('status')!
  const start = document.getElementById('start') as HTMLButtonElement

  canvas.addEventListener('click', (e) => {
    const box = canvas.getBoundingClientRect()
    act({ type: 'deploy', ...tileAt(e.clientX - box.left, e.clientY - box.top) })
  })
  start.addEventListener('click', () => act({ type: 'start' }))

  return {
    update(state) {
      const humans = state.units.filter((u) => u.side === 'human').length
      start.hidden = state.phase !== 'deploy'
      status.textContent =
        state.phase === 'deploy'
          ? `Click the blue zone to deploy: ${humans}/${SQUAD}`
          : state.phase === 'battle'
            ? `${NAME[state.turn]}' turn`
            : state.winner
              ? `${NAME[state.winner]} win`
              : 'Draw'
    },
  }
}
