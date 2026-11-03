// The events a beat emits for the view to play.
import type { Tile, Effect, Ability, Order, Side } from './battle'
import type { UtilityId } from './utilities'
import type { SecondaryId } from './secondaries'
import type { DuoId } from './duos'

export type GameEvent =
  /** `path` lists each tile entered, in order. `with` names a skill that granted the move. */
  | { type: 'move'; id: number; path: Tile[]; with?: Effect | 'dash' }
  /** Aliens are sighted. `units` gives each one's tile at that moment. */
  | { type: 'reveal'; units: { id: number; x: number; y: number }[] }
  /** `damage` is 0 if a shield or image took it. `with` lists the skills, gear and relics of the shooter that shaped the shot or granted it. `secondary` names the attack if not the weapon; `opens` tells of a combo's first blow. `nth` numbers a weapon attack's shots, each playing for `lasts` ms if set; `form` tells of one thrown or rocketed; `deflect` is the word of the target's weapon guard that saved it; `ring` is the reach in tiles of a stunning shockwave. */
  | { type: 'shot'; id: number; target: number; crit: boolean; damage: number; with: Effect[]; deflect?: string; ring?: number; secondary?: SecondaryId; opens?: boolean; nth?: number; lasts?: number; form?: 'throw' | 'rocket' }
  /** A rocket, grenade or napalm (`fire`) lands on a tile, or a burster explodes on it; every unit in `hits` is damaged and the terrain around is wrecked. */
  /** A unit off a ledge, `drop` levels, onto `to`, landing on `onto` if anyone stood there; or over the edge, caught or lost. */
  | { type: 'fall'; id: number; to: Tile; drop: number | 'edge'; damage: number; onto?: number; fatal?: true }
  | { type: 'rocket'; id: number; x: number; y: number; hits: { target: number; damage: number }[]; fire?: true; label?: string }
  | { type: 'heal'; id: number; target: number; amount: number }
  /** An effect of gear, a skill, a relic or a class ability acts on the unit `id`. `amount` is the health it gained, or lost if negative; 0 when neither. */
  | { type: 'effect'; id: number; effect: Effect | Ability; amount: number }
  /** A hero's tier 4 goes off where it stood; `radius` is how far it reaches in tiles, 0 if it takes no ground, and a beam ends at `to`. */
  | { type: 'ultimate'; id: number; effect: Effect; x: number; y: number; radius: number; to?: Tile }
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
  /** A duo's two heroes, `ids`, act together, on the unit `target` if any. */
  | { type: 'duo'; duo: DuoId; ids: number[]; target?: number }
  | { type: 'death'; id: number }
  /** A utility takes hold, acting on the units `on`. */
  | { type: 'used'; utility: UtilityId; on: number[] }
  | { type: 'end'; winner: Side | null } 
