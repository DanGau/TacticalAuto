# Modules

Where each system lives under `app/src/`. Each file's first line says what it owns. Lower modules never import higher ones at runtime; a lower one may import a higher one's types.

## core/: battle

| File | Owns |
|---|---|
| `battle.ts` | Battle state types (`Battle`, `Unit`) and the numbers rules share |
| `grid.ts` | The board: distance, objects, walls, walking costs and routes, free tiles |
| `setup.ts` | `createBattle`: battle state, placing aliens, civilians, goals by the encounter |
| `encounter.ts` | `designEncounter`: the set-piece: arena, overlook, hazard, ridge, objects, posts, approaches, gates |
| `arena-kinds.ts` | The arena's shape by encounter: skyscraper roof, overpass, quarry, mesa, chasm, swamp; ledges, ramps, drops |
| `levels.ts` | Smoothing heights so ledges stand only where meant |
| `knockback.ts` | Knockback and falls: off a ledge, through glass, over the edge |
| `formations.ts` | `gather`: which aliens cluster together, the shapes they stand in, how the ground shapes those |
| `objects.ts` | What heroes do with objects: the strong throwing them or small aliens, setting off tanks, a rigged tank |
| `landing.ts` | The one entry point, the plain landing there, what relics set off |
| `boons.ts` | The picked utilities in a battle: taking hold, each turn, ending |
| `spawn.ts` | Making units: aliens, soldiers, civilians, mechs, drops |
| `step.ts` | Advances the run's battle a beat; settles it when it ends |
| `combat.ts` | `stepBattle`: whose turn, the next unit's action |
| `combat-event.ts` | `GameEvent`, what a beat emits for the view |
| `sources.ts` | What each event's action comes from (`Src`); `source-names.ts` the name it shows under |
| `sides.ts` | A side's simultaneous move: sighting, walking, sentries, overwatch |
| `pathing.ts` | Where a unit moves: candidate paths scored by stance, goal and threat |
| `attack.ts` | A shot and what a hit or kill sets off |
| `brawlers.ts` | Rules of aliens that fight up close: charge, pounce, hold, ram, shield, pack, fury |
| `threat.ts` | What a hero gains by shooting an alien: harm stopped over hits to kill |
| `abilities.ts` | Actions in place of a shot: alien powers, soldier skills and gear |
| `keystones.ts` | Deep path powers: what a hit sets off, their numbers |
| `follow-ups.ts` | Command's ally attack, Blade Dance's extra strikes |
| `duo-effects.ts` | What each duo does in battle |
| `ultimates.ts` | Capstones: when each fires and what it does |
| `wound.ts` | Damage landing, what it sets off, the battle tally |
| `stacks.ts` | Stacks a fight builds and what they set off: burn, chill and freezing, Might, combos, exposure, every-Nth hits |
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
| `rewards.ts` | Gear, relic and duo rewards, the shop, settling the reward phase |
| `missions.ts` | Missions: their force, aliens, goal and place |
| `debrief.ts` | `endBattle`: settling a battle into the run |
| `events.ts` | Unknown stops' events |
| `apply.ts` | `apply`: the player's actions, checked and applied |

## core/: content and helpers

`aliens`, `challenges`, `classes`, `doctrines`, `duos`, `feats`, `gear`, `goals`, `keywords`, `powers`, `relics`, `secondaries`, `skill-effects`, `skills`, `twists`, `utilities`, `weapons`: one kind of game content each. `regions`, `towns`, `world`: places. `base`: what relics and doctrines share. `effects`: effect names for the view. `pace`: event timing. `plane`: flat-map geometry. `rng`: seeded randomness. `tuning`: balance numbers. `roads`, `arena`: test helpers.

## view/: battle rendering

| File | Owns |
|---|---|
| `view.ts` | `createView`, the `View` the UI drives: show, framing, panning |
| `stage.ts` | `Stage`: scene layers, camera and glides, frame loop, what is on screen |
| `camera.ts` | World and picture points, cameras that frame tiles |
| `play.ts` | Plays a beat's events in order |
| `effects.ts` | Shots, lunges, rockets, sparks, shake, callouts |
| `ultimates.ts` | A capstone on screen: its name, colour and shape |
| `duos.ts` | A duo's moment on screen |
| `sprites.ts` | Unit pictures and moving them |
| `badges.ts` | The stacks and counts over a unit's head, the same size on any screen |
| `marks.ts` | Ground marks: the way in, goals, fences, acid, fog, glows |
| `board.ts` | Building the battlefield's ground, props, walls, roofs |
| `edges.ts` | The ground's edge lines, each drawn once |
| `props.ts` | Boxes props and walls are drawn from; trees |
| `palette.ts` | Colours |
| `falls.ts` | A fall off a ledge or over the edge; a throw in its arc |
| `attacks`, `chasm`, `fences`, `looks`, `roofs`, `shapes`, `space` | Weapon looks, cliffs, zone fences, region looks, roofs, mesh building, view units |

## Elsewhere

- `ui/`: HTML panels. `ui.ts` is the shell; `overworld.ts` and `globe.ts` the flight map; `aftermath.ts` rewards and reports; `summary.ts` a battle's statistics page and the post-game summary, drawn by `charts.ts`, whose marks `tip.ts` explains on hover, focus or tap; `cards.ts` fixed-size cards tapped to arm and again to confirm, and gear comparisons; `sheet.ts` character sheets and alien stat blocks; `kit.ts` source tags and a hero's kit by source, shown on hover or tap in battle; `log.ts` the battle log; `tree.ts` a class's skill tree as a map; `briefing.ts` the tour before the landing; `menu.ts` the title.
- `bots/bots.ts`: bot strategies. `sim/`: the sim CLI, `sim/encounter.ts`, the challenge lab, and `sim/forks.ts`, the clean comparison of answers.
- `main.ts`: browser entry and `window.debug`.
