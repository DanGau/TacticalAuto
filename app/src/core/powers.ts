// How a power reads: when it works, how far it reaches, whom it affects and what it does.

/** When a power works: `N/battle` counts uses; a Reaction fires on its trigger; an Aura is always around its owner. */
export type Use = 'Passive' | 'At will' | 'Reaction' | 'Aura' | `${number}/battle`

/** A power as a sheet tells it. */
export interface Power {
  name: string
  use: Use
  /** In tiles, unless it says otherwise. */
  range?: string
  target?: string
  text: string
}

/** A power's usage line: use, range, target. */
export const usage = ({ use, range, target }: Power) => [use, range && `Range ${range}`, target].filter(Boolean).join(' · ')
