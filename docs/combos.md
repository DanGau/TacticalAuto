# Combos

Borrowed from Slay the Spire: combos the player finds, not ones an item names. Every skill, gear effect and relic **makes** or **reads** plain quantities of the fight. A reader pays beside any maker, whatever line each was meant for, so a cryo's chill feeds a hammer's knockbacks; on the one hero, every piece of the build meets every other. Several lines stay open; investing in one pays; scattering stalls; opposites cancel.

## Rules

1. **Long fights.** Leg Guardians and elites' Big Ones last 3 to 5 rounds, so scaling has time to pay.
2. **Quantities, not tags.** Items name no build. `makes`/`reads` on each relic, gear effect and skill (`core/quantities.ts`) say what it trades in.
3. **Frequency.** On-hit effects fire on every shot, so shot makers feed every on-hit reader.
4. **Cancellations.** Opposites on one alien cancel by default and leave it numb for its next turn: no burn, chill or marks, and 1 less from each hit. Shown as a floating word and in every tooltip of an item that makes a half. A hero that takes both halves by accident gets weaker.
5. **Bridges.** One epic relic per cancellation turns the meeting into a big payoff. Offers favour it once the hero makes both halves.
6. **Offers lean, not lock.** One relic in three, and a third of gear, reads what the hero makes or makes what it reads.
7. **Guardians as exams.** Each is answered by three quantities, each a different line.

## Quantities

| Quantity | Made by | Read by |
|---|---|---|
| Burn | Scorching, Billowing, Kilned gear; Salamander Sigil, Kindling Plates, Pyre Censer, Wildfire Spores; Pyro; fire tiles | Accelerant Gel, Eternal Flame, Witch's Hex, Catalyst Prism; Stoke and Pyro talents |
| Chill | Rimed, Hailing gear; Frost Lattice, Cryo Charges, Cryo Conductor; Cryo | Brittle Frost, Glacial Snare, Frost Fracture, Permafrost Heart; Glass Edge; knockbacks (a chilled alien slides up to 3 tiles more, and one that slides into something takes the hero's blow) |
| Mark | Seeking gear; Hunter's Eye; Sniper, Engineer | Spotter Network, Dead Eye Ledger; Called Shot; every hit (+1) |
| Displace (cannot walk on its next turn, bar a boss; Gravity Lens makes a boss reel in place) | Shoving, Thundering, Tethered gear; Gravity Lens, Lodestone Harness; Heavy skills; chill slides | Stagger Sights, Hunter's Net, Booming gear, Pyre Censer (driven onto fire burns), Domino Rig |
| Impact | Shoving, Thundering gear; Gravity Lens, Domino Rig; ledges | Kinetic Engine, Kinetic Core, Toppling, Kilned, Hailing gear |
| Shots | multi-shot weapons; Hair Trigger, Twinned gear, Split Rounds, Flurry | every on-hit maker: Scorching, Rimed, Seeking, Bracing, Leeching, Sapping, Cadenced |
| Crit | Focusing Lens, Kinetic Capacitor, Lofty gear; Sniper skills | Salamander Sigil, Frost Lattice, Hunter's Eye, Arcing gear |
| Overkill (a hit's damage past 6) | Glass Cannon, Blood Rite, Adrenal Pump, Ram Plating, Bounty Sigil, Cadenced, Merciless gear | Overkill Coils (a hit's damage past 6 also hits the nearest other alien), Volatile gear (kills burst for the rest) |
| Armor | Alien Alloys, Adaptive Plating, Bloodforged Plate, Overflow Capacitor, Reactive Shell, Bracing gear | Ram Plating, Juggernaut Servos, Kindling Plates, Ironclad Lattice; Shield Slam |
| Hurt | aliens; Lodestone Harness pulls them onto the tank | Reactive Shell, Kindling Plates; Hardened |

Example chains: Lodestone pulls an alien onto the tank → it hits the tank → Reactive Shell adds armor → Ram Plating adds that armor to every hit. Rimed gear → chilled aliens slide on Shoving hits → Kinetic Engine on each slam, Stagger Sights on each moved alien. Glass Cannon → Overkill Coils clears the next alien.

## Ground

Each ground multiplies some quantities, so a build reads the Flight map for ground that suits it (`core/arena-kinds.ts`):

| Ground | Multiplies |
|---|---|
| Rooftops, Rift, Quarry | Displace: a drop or a terrace kills or hurts |
| Overpass, Mesa | Crit and damage from above |
| Flooded, Ice Sheet | Chill: 1 more beside water or on ice; Displace slides on ice |
| Marsh | Burn: an alien in mire sets the mire about it alight |

## Cards

The hero's field kit is a deck (`core/cards.ts`, `core/deck.ts`), after Slay the Spire and Monster Train.

- **Deck.** Every run starts with the same 6: Plasma Lance, Kinetic Plating, Nanoweave, Afterburners, Longshot Optics, Regen Gel.
- **Hand.** Each battle with a deploy screen draws 3 at random from the cards not out; Tactical Satchel draws 1 more. An ambush has no deploy screen and no hand. The player plays 1; only it works. Each card in the hand shows what it plays to on this board (`core/read.ts`): the Armor it ignores, the ranged aliens it halves, the turns its move saves, the water and ice it chills by, the ledges it knocks aliens off. Nothing labels the answer.
- **Fuse.** The card played can be fused: it plays a level higher, and the hand's other cards are out until the next leg. Fusing thins the deck for the leg, so it pays most when the others are weak, and costs when they are the next fight's answer.
- **Levels.** A card is level 1, or 2 once upgraded at a safehouse; fused, it plays a level higher, to 3. A level raises the amount it adds.
- **Rewards.** Every battle won offers 3 cards: add 1, or Skip to keep the deck lean, so the best card turns up more often. An elite's offer, a satellite, an ambush, a takedown or a Big One, is rare or better. Rare and epic cards grow likelier over the run. A shop sells 3 cards and removes 1 from the deck, once.
- **Cards and combos.** Most cards lend a gear effect or a relic's for the battle, so they make or read the quantities above: Incendiary Rounds and Napalm Sprayer Burn, Cryo Payload and Frost Burst Chill, Tracer Feed Marks, Force Gauntlet and Grapple Line Displace, Impact Driver reads Impact, Overcharged Cell Crits, Volatile Rounds and Overkill Relay read Overkill, Kinetic Plating and Ram Spikes trade in Armor. Thermal Shock Rounds, Shatter Charge and Lock-On Beacon bridge a cancellation for the battle. Others read the goal: Evac Line on a rescue, Uplink Spike on a hold, Lift Flare at an extraction.

## Cancellations

| Cancel | Halves | Default | Bridge |
|---|---|---|---|
| Quench | burn, chill | both go out; numb | Thermal Shock Core: detonates for 3 times the hero's damage a stack of both, half to those beside |
| Thaw | moved, chill | a frozen alien moved thaws and acts; numb | Shatterglass Edge: any chilled alien moved takes twice the hero's damage a chill stack; a frozen one stays frozen |
| Lock Lost | moved, mark | a marked alien moved loses its marks; numb | Lock-On Rig: marks kept, twice the hero's damage a mark |

## Exams

| Trait | What it does | Answered by |
|---|---|---|
| Plated | Hits under 6 do half; slams and falls do full | overkill, marks, impact |
| Regrowth | Heals a tenth of its health a turn unless burning or chilled, up to 60% a battle | burn, chill, shots |
| Rampager | Gains 1 Might a turn unless moved since its last | moved, chill, armor |
| Thorned | Each hit hurts the attacker 1; slams and falls do not | armor, impact, overkill |

## Bots and measure

The strategic bot values an item by what it reads that the hero makes (3), makes that the hero reads (2), loses one for each it reads that nothing makes, four for a cancellation it starts without the bridge; a bridge whose halves the hero makes is worth 6. `npm run -s sim -- --runs=N --loadouts=a+b,...` reports each pair's synergy over its halves on Guardian rounds and wins; a triple `a+b+c` is measured against `a+b` plus `c`.

Code: `core/quantities.ts`, `core/stacks.ts` (cancels, bridges, displacement), `core/knockback.ts`, `core/exams.ts`, `core/relics.ts`, `core/gear.ts`, `bots/strategic.ts`.
