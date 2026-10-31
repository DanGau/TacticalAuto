// The events a beat emits for the view to play.
import type { Tile, Effect, Ability, Order, Side } from './battle'
import type { ConsumableId } from './consumables'
import type { SecondaryId } from './secondaries'

export type GameEvent =
  /** `path` lists each tile entered, in order. `with` names a skill that granted the move. */
  | { type: 'move'; id: number; path: Tile[]; with?: Effect }
  /** Aliens are sighted. `units` gives each one's tile at that moment. */
  | { type: 'reveal'; units: { id: number; x: number; y: number }[] }
  /** `damage` is 0 if a shield or image took it. `with` lists the skills, gear and relics of the shooter that shaped the shot or granted it. `secondary` names the attack if not the weapon; `opens` tells of a combo's first blow. */
  | { type: 'shot'; id: number; target: number; crit: boolean; damage: number; with: Effect[]; secondary?: SecondaryId; opens?: boolean }
  /** A rocket, grenade or napalm (`fire`) lands on a tile, or a burster explodes on it; every unit in `hits` is damaged and the terrain around is wrecked. */
  | { type: 'rocket'; id: number; x: number; y: number; hits: { target: number; damage: number }[]; fire?: true; label?: string }
  | { type: 'heal'; id: number; target: number; amount: number }
  /** An effect of gear, a skill, a relic or a class ability acts on the unit `id`. `amount` is the health it gained, or lost if negative; 0 when neither. */
  | { type: 'effect'; id: number; effect: Effect | Ability; amount: number }
  /** A spitter's spit lands on its target, which takes `damage`, and leaves acid on the tile. */
  | { type: 'spit'; id: number; target: number; damage: number }
  /** A feeder grows on a trick the squad used: its hits do `damage` more than its weapon's. */
  | { type: 'feed'; id: number; damage: number }
  /** A soldier reaches a civilian and gets them out. */
  | { type: 'saved'; id: number }
  /** A soldier reaches the extraction zone and lifts off, with any squadmate it carries. */
  | { type: 'escaped'; id: number }
  /** A soldier picks up the downed soldier `soldier` to carry out. */
  | { type: 'carried'; id: number; soldier: number }
  /** A soldier reaches a squadmate the aliens held, who gets up and fights as `unit`. */
  | { type: 'freed'; id: number; unit: { id: number; x: number; y: number } }
  /** A soldier grabs a raid's supply cache. */
  | { type: 'grabbed'; id: number; x: number; y: number }
  /** A psion panics a soldier, who loses its next action. */
  | { type: 'panic'; id: number; target: number }
  /** A soldier with no shot takes a standard action in place of attacking. */
  | { type: 'order'; id: number; order: Order }
  /** A unit cloaks, or its cloak breaks. */
  | { type: 'cloak'; id: number; on: boolean }
  /** A panicked soldier loses its action. */
  | { type: 'frozen'; id: number }
  /** A unit is hurt by acid underfoot, or by the death of a psion near it. */
  | { type: 'hurt'; id: number; amount: number; cause: 'acid' | 'backlash' | 'impact' }
  /** A hold is done: the extraction zone appears at x, y. */
  | { type: 'extract'; x: number; y: number }
  /** A wave arrives on a hold, unseen unless the squad already sees where it lands. */
  | { type: 'wave'; units: { id: number; x: number; y: number }[] }
  /** A boss spawns a swarmling, or an engineer deploys a mech. */
  | { type: 'spawn'; id: number; unit: { id: number; x: number; y: number } }
  | { type: 'death'; id: number }
  /** The player uses a consumable, acting on the units `on`. */
  | { type: 'used'; consumable: ConsumableId; on: number[] }
  | { type: 'end'; winner: Side | null } 
