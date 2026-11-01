// Feats soldiers earn experience for, and the battle tally that records them.
/** A feat a soldier pays experience for the first time it pulls it off. Combat and the battle's end record them. */
export interface Feat {
  name: string
  text: string
}

const feats = {
  oneShot: { name: 'Clean Kill', text: 'Killed an alien at full HP with one hit' },
  overkill: { name: 'Overkill', text: 'Did 8 or more damage with one hit' },
  hatTrick: { name: 'Hat Trick', text: 'Killed 3 aliens in one battle' },
  giantSlayer: { name: 'Giant Slayer', text: 'Landed the killing blow on a boss or commander' },
  untouched: { name: 'Untouched', text: 'Won a battle without losing any health' },
  lastLegs: { name: 'Last Legs', text: 'Won a battle on 2 HP or less' },
} satisfies Record<string, Feat>

export type FeatId = keyof typeof feats
export const FEATS: Record<FeatId, Feat> = feats

/** A tally with nothing on it. */
export const emptyTally = (): Tally => ({ dealt: 0, kills: 0, taken: 0, blocked: 0, healed: 0, feats: [] })

/** Damage one hit must do for Overkill. */
export const OVERKILL = 8

/** What a soldier did in a battle: damage done to aliens, kills, health lost, damage its armor stopped, health it restored, and feats pulled off. */
export interface Tally {
  dealt: number
  kills: number
  taken: number
  blocked: number
  healed: number
  feats: FeatId[]
}
