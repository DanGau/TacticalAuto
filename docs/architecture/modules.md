# Modules

Where each system lives under `app/src/`. Each file's first line says what it owns. Lower modules never import higher ones at runtime; a lower one may import a higher one's types.

## core/: battle

| File | Owns |
|---|---|
| `battle.ts` | Battle state types (`Battle`, `Unit`) and the numbers rules share |
| `grid.ts` | The board: distance, objects, walls, walking costs and routes, free tiles |
| `setup.ts` | `createBattle`: battle state, placing aliens, civilians, goals by the encounter |
| `encounter.ts` | `designEncounter`: the set-piece: arena, overlook, hazard, objects, posts, approaches, gates |
| `objects.ts` | What heroes do with objects: hurling them, setting off tanks |
| `entrances.ts` | Entrances: their kinds, where each comes in, what each sets off |
| `spawn.ts` | Making units: aliens, soldiers, civilians, mechs, drops |
| `step.ts` | Advances the run's battle a beat; settles it when it ends |
| `combat.ts` | `stepBattle`: whose turn, the next unit's action, consumables |
| `combat-event.ts` | `GameEvent`, what a beat emits for the view |
| `sides.ts` | A side's simultaneous move: sighting, walking, sentries, overwatch |
| `pathing.ts` | Where a unit moves: candidate paths scored by stance, goal and threat |
| `attack.ts` | A shot and what a hit or kill sets off |
| `abilities.ts` | Actions in place of a shot: alien powers, soldier skills and gear |
| `wound.ts` | Damage landing, what it sets off, the battle tally |
| `upkeep.ts` | What happens as a side's turn begins: more aliens engaging, waves |
| `fighters.ts` | Unit queries every combat module asks |
| `sight.ts` | Line of sight, what height does to a shot, noticing |
| `terrain.ts` | Battlefield tile types and how solid each is |
| `terrain-gen.ts` | `generateTerrain`: streets, lots, layout, twist, hills, connectivity |
| `terrain-lots.ts` | The places that fill a lot |
| `streets.ts` | Street plans |

## core/: run

| File | Owns |
|---|---|
| `run-state.ts` | Run state types (`Run`, `Soldier`, `Stop`, `Leg`, `Mission`) |
| `run.ts` | `createRun`, the route and each leg's map of stops, moving along it |
| `progress.ts` | How far along the run is, and threat |
| `squad.ts` | Soldiers: experience, levels, skills, stats, health, hiring |
| `rewards.ts` | Gear and relic rewards, the shop, settling the reward phase |
| `missions.ts` | Missions: their force, aliens, goal and place |
| `debrief.ts` | `endBattle`: settling a battle into the run |
| `events.ts` | Unknown stops' events |
| `apply.ts` | `apply`: the player's actions, checked and applied |

## core/: content and helpers

`aliens`, `classes`, `consumables`, `doctrines`, `feats`, `gear`, `goals`, `keywords`, `relics`, `secondaries`, `skills`, `traits`, `twists`, `weapons`: one kind of game content each. `regions`, `towns`, `world`: places. `base`: what relics and doctrines share. `effects`: effect names for the view. `pace`: event timing. `plane`: flat-map geometry. `rng`: seeded randomness. `tuning`: balance numbers. `roads`: test helpers.

## view/: battle rendering

| File | Owns |
|---|---|
| `view.ts` | `createView`, the `View` the UI drives: show, entrances, framing, panning |
| `stage.ts` | `Stage`: scene layers, camera and glides, frame loop, what is on screen |
| `camera.ts` | World and picture points, cameras that frame tiles |
| `play.ts` | Plays a beat's events in order |
| `effects.ts` | Shots, lunges, rockets, sparks, shake, callouts |
| `entrance.ts` | The entrance playing: door, wall, monologue, skylight, rope, smoke, truck, strike, tap, look, blast, shot, stolen kill |
| `sprites.ts` | Unit pictures and moving them |
| `marks.ts` | Ground marks: entrances, goals, fences, acid, fog, glows |
| `board.ts` | Building the battlefield's ground, props, walls, roofs |
| `props.ts` | Boxes props and walls are drawn from; trees |
| `palette.ts` | Colours |
| `attacks`, `chasm`, `fences`, `looks`, `roofs`, `shapes`, `space` | Weapon looks, cliffs, zone fences, region looks, roofs, mesh building, view units |

## Elsewhere

- `ui/`: HTML panels. `ui.ts` is the shell; `overworld.ts` and `globe.ts` the flight map; `aftermath.ts` rewards and reports; `cards.ts` fixed-size cards tapped to arm and again to confirm, and gear comparisons; `briefing.ts` the tour before the entrance; `menu.ts` the title.
- `bots/bots.ts`: bot strategies. `sim/`: the sim and tune CLIs.
- `main.ts`: browser entry and `window.debug`.
