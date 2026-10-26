/** A feat a soldier pays experience for the first time it pulls it off. Combat and the battle's end record them. */
export interface Feat {
  name: string
  text: string
}

const feats = {
  oneShot: { name: 'Clean Kill', text: 'Killed an alien at full health with one hit' },
  overkill: { name: 'Overkill', text: 'Did 8 or more damage with one hit' },
  hatTrick: { name: 'Hat Trick', text: 'Killed 3 aliens in one battle' },
  giantSlayer: { name: 'Giant Slayer', text: 'Landed the killing blow on a boss or commander' },
  untouched: { name: 'Untouched', text: 'Won a battle without losing any health' },
  lastLegs: { name: 'Last Legs', text: 'Won a battle on 2 health or less' },
} satisfies Record<string, Feat>

export type FeatId = keyof typeof feats
export const FEATS: Record<FeatId, Feat> = feats

/** Damage one hit must do for Overkill. */
export const OVERKILL = 8

/** What a soldier did in a battle: damage done to aliens, kills, damage taken, and feats pulled off. */
export interface Tally {
  dealt: number
  kills: number
  taken: number
  feats: FeatId[]
}
