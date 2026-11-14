# Combos

Borrowed from Slay the Spire: combos the player finds, not ones an item names. Every skill, gear effect and relic **makes** or **reads** plain quantities of the fight. A reader pays beside any maker, whatever hero or line each was meant for, so a cryo's chill feeds a heavy's knockbacks. Several lines stay open; investing in one pays; scattering stalls; opposites cancel.

## Rules

1. **Long fights.** Leg Guardians and elites' Big Ones last 3 to 5 rounds, so scaling has time to pay.
2. **Quantities, not tags.** Items name no build. `makes`/`reads` on each relic, gear effect and skill (`core/quantities.ts`) say what it trades in.
3. **Frequency.** On-hit effects fire on every shot, so shot makers feed every on-hit reader.
4. **Cancellations.** Opposites on one alien cancel by default and leave it numb for 2 of its turns: no burn, chill or marks, and 2 less from each hit. Shown as a floating word and in every tooltip of an item that makes a half. A squad that takes both halves by accident gets weaker.
5. **Bridges.** One epic relic per cancellation turns the meeting into a big payoff. Offers favour it once the squad makes both halves.
6. **Offers lean, not lock.** One relic in three, and a third of gear, reads what the squad makes or makes what it reads.
7. **Guardians as exams.** Each is answered by three quantities, each a different line.

## Quantities

| Quantity | Made by | Read by |
|---|---|---|
| Burn | Scorching, Billowing, Kilned gear; Salamander Sigil, Kindling Plates, Pyre Censer, Wildfire Spores; Pyro; fire tiles | Accelerant Gel, Eternal Flame, Witch's Hex, Catalyst Prism; Stoke and Pyro talents |
| Chill | Rimed, Hailing gear; Frost Lattice, Cryo Charges, Cryo Conductor; Cryo | Brittle Frost, Glacial Snare, Frost Fracture, Permafrost Heart; Glass Edge; knockbacks (a chilled alien slides up to 3 tiles more, and one that slides into something takes the hero's blow) |
| Mark | Seeking gear; Eye of the Hunt; Sniper, Engineer | Spotter Network, Dead Eye Ledger; Called Shot; every hit (+1) |
| Moved (cannot walk on its next turn) | Shoving, Thundering, Tethered gear; Gravity Lens, Lodestone Harness; Heavy skills; chill slides | Stagger Sights, Hunter's Net, Booming gear, Pyre Censer (driven onto fire burns), Domino Rig |
| Impact | Shoving, Thundering gear; Gravity Lens, Domino Rig; ledges | Kinetic Engine, Kinetic Core, Toppling, Kilned, Hailing gear |
| Shots | multi-shot weapons; Hair Trigger, Twinned gear, Split Rounds, Flurry | every on-hit maker: Scorching, Rimed, Seeking, Bracing, Leeching, Sapping, Cadenced |
| Crit | Focusing Lens, Kinetic Capacitor, Lofty gear; Sniper skills | Salamander Sigil, Frost Lattice, Eye of the Hunt, Arcing gear |
| Overkill | Glass Cannon, Blood Rite, Adrenal Pump, Ram Plating, Bounty Sigil, Cadenced, Merciless gear | Overkill Coils (the rest hits the nearest alien, and half adds to the hero's next hit), Volatile gear (kills burst for the rest) |
| Armor | Alien Alloys, Adaptive Plating, Bloodforged Plate, Overflow Capacitor, Reactive Shell, Bracing gear | Ram Plating, Juggernaut Servos, Kindling Plates, Ironclad Lattice; Shield Slam |
| Hurt | aliens; Lodestone Harness pulls them onto the tank | Reactive Shell, Kindling Plates; Hardened |

Example chains: Lodestone pulls an alien onto the tank → it hits the tank → Reactive Shell adds armor → Ram Plating adds that armor to every hit. Rimed gear → chilled aliens slide on Shoving hits → Kinetic Engine on each slam, Stagger Sights on each moved alien. Glass Cannon → Overkill Coils clears the next alien.

## Cancellations

| Cancel | Halves | Default | Bridge |
|---|---|---|---|
| Quenched | burn, chill | both go out; numb | Thermal Shock Core: detonates for 3 times the hero's damage a stack of both, half to those beside |
| Thawed | moved, chill | a frozen alien moved thaws and acts; numb | Shatterglass Edge: any chilled alien moved takes twice the hero's damage a chill stack; a frozen one stays frozen |
| Lock lost | moved, mark | a marked alien moved loses its marks; numb | Lock-On Rig: marks kept, twice the hero's damage a mark |

## Exams

| Trait | What it does | Answered by |
|---|---|---|
| Plated | Hits under 6 do half; slams and falls do full | overkill, marks, impact |
| Regenerator | Heals a tenth of its health a turn unless burning or chilled, up to 60% a battle | burn, chill, shots |
| Berserker | Gains 1 Might a turn unless moved since its last | moved, chill, armor |
| Thorned | Each hit hurts the attacker 1; slams and falls do not | armor, impact, overkill |

## Bots and measure

The strategic bot values an item by what it reads that the squad makes (3), makes that the squad reads (2), loses one for each it reads that nothing makes, four for a cancellation it starts without the bridge; a bridge whose halves the squad makes is worth 6. `npm run -s sim -- --runs=N --loadouts=a+b,...` reports each pair's synergy over its halves on Guardian rounds and wins; a triple `a+b+c` is measured against `a+b` plus `c`.

Code: `core/quantities.ts`, `core/stacks.ts` (cancels, bridges, displacement), `core/knockback.ts`, `core/exams.ts`, `core/relics.ts`, `core/gear.ts`, `bots/strategic.ts`.
