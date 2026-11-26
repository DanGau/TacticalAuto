// The events a beat emits for the view to play.
import type { Tile, Effect, Side } from './battle'
import type { Label, Src } from './sources'

/** Every event of an action carries `src`, what the action comes from. */
export type GameEvent =
  /** `path` lists each tile entered, in order. `with` names what moved the unit, if not a walk. */
  | { type: 'move'; src: Src; id: number; path: Tile[]; with?: Effect; /** Strides of the path that are jumps. */ leaps?: number }
  /** Aliens are sighted. `units` gives each one's tile at that moment. */
  | { type: 'reveal'; units: { id: number; x: number; y: number }[] }
  /** `with` lists the gear and relics of the shooter that shaped the shot or granted it. `nth` numbers a card's hits; `after` is the target's health, armor and temp HP once it landed. */
  | { type: 'shot'; src: Src; id: number; target: number; crit: boolean; damage: number; with: Effect[]; nth?: number; after?: { hp: number; armor: number; temp: number } }
  /** A unit off a ledge, `drop` levels, onto `to`, landing on `onto` if anyone stood there; or over the edge, caught or lost. */
  | { type: 'fall'; id: number; to: Tile; drop: number | 'edge'; damage: number; onto?: number; fatal?: true }
  /** A blast on a tile: a burster explodes, or a fuel tank goes up; every unit in `hits` is damaged and the terrain around is wrecked. */
  | { type: 'rocket'; src: Src; id: number; x: number; y: number; hits: { target: number; damage: number }[] }
  /** `added` stacks of `quantity` reach the unit `id`, which then holds `burn` and `chill`, before any cancellation of the two. */
  | { type: 'stacks'; id: number; quantity: 'burn' | 'chill'; added: number; burn: number; chill: number }
  | { type: 'heal'; src: Src; id: number; target: number; amount: number }
  /** An effect of gear, a relic, a card or the ground acts on the unit `id`. `amount` is the health it gained, or lost if negative; 0 when neither. */
  | { type: 'effect'; src: Src; id: number; effect: Label; amount: number }
  /** A spitter's spit lands on its target, which takes `damage`, and leaves acid on the tile. */
  | { type: 'spit'; src: Src; id: number; target: number; damage: number }
  /** A feeder grows on a trick the hero used: its hits do `damage` more than its weapon's. */
  | { type: 'feed'; src: Src; id: number; damage: number }
  /** A soldier reaches a civilian and gets them out. */
  | { type: 'saved'; id: number }
  /** A soldier reaches the extraction zone and lifts off. */
  | { type: 'escaped'; id: number }
  /** A psion panics a soldier, who loses its next action. */
  | { type: 'panic'; src: Src; id: number; target: number }
  /** A unit cloaks, or its cloak breaks. */
  | { type: 'cloak'; id: number; on: boolean }
  /** A panicked soldier loses its action. */
  | { type: 'frozen'; id: number }
  /** A unit is hurt by acid underfoot, or by the death of a psion near it. */
  | { type: 'hurt'; id: number; amount: number; cause: 'acid' | 'backlash' | 'impact' }
  /** A wave arrives on a hold, unseen unless the hero already sees where it lands. */
  | { type: 'wave'; units: { id: number; x: number; y: number }[] }
  /** A boss spawns a swarmling, or an engineer deploys a mech. */
  | { type: 'spawn'; src: Src; id: number; unit: { id: number; x: number; y: number } }
  | { type: 'death'; id: number }
  | { type: 'end'; winner: Side | null }

export type ShotEvent = Extract<GameEvent, { type: 'shot' }> 
