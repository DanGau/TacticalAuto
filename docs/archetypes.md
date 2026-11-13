# Archetypes

How a build scales, borrowed from Slay the Spire. Each archetype has causes that build stacks, engines that build more of them faster, payoffs that turn them into damage and defense, a rule-breaker that changes how its mechanic works, and a boss exam it answers.

## The seven rules

1. **Long fights.** Elites and leg bosses are few tough aliens that last 3 to 5 rounds, so scaling has time to pay. Bosses are the power check.
2. **Multiplication.** Might adds its whole value to every shot, as Strength does to every hit. A payoff multiplies the spending hit: +50% damage a stack spent. Catalyst Prism doubles a target's stacks.
3. **Frequency.** Every on-hit effect fires on every shot of a multi-shot weapon, so shots × stacks a shot is a build. Engines add shots or triggers.
4. **Defense scales too.** Spending stacks also stuns, weakens or shields; armor can last between turns and hit back; healing past full becomes armor.
5. **Rule-breakers.** One relic per archetype changes how its mechanic works.
6. **Bosses as exams.** Each leg's Guardian has a trait shown on the map from the leg's start: the gap it tests and the archetypes that answer it.
7. **A focused pool.** Relic offers favour what the squad already holds. A hero can be made the squad's Carry: its hits build stacks twice.

## Archetypes

| | Causes | Engines | Payoffs | Rule-breaker | Exam answered |
|---|---|---|---|---|---|
| Burn | Scorching gear, Salamander Sigil, Pyro kit | Billowing gear, Wildfire Spores (copy), Fan the Flames | Accelerant Gel: ×stacks, hero gains armor | Eternal Flame: burn never fades | Regenerator: burning stops its regrowth |
| Chill | Rimed gear, Frost Lattice, Cryo kit | Cryo Conductor (copy), Hailing gear | Shatterglass Edge: ×stacks, stuns | Permafrost Heart: bosses freeze too | Berserker: chill blunts its rising damage |
| Mark | Seeking gear, Eye of the Hunt | Spotter perk, Witch's Hex (copy) | Spotter Network: ×stacks, weakens | Dead Eye Ledger: payoffs leave marks on | Plated: marks add to every hit, past its plates |
| Force | Shoving, Thundering, Tethered gear | Domino Rig | Kinetic Engine, Toppling gear | Gravity Lens: every shot knocks back | Thorned: a slam is no hit, so no thorns |
| Guard | Alien Alloys, Bloodforged Plate, Shield | Adaptive Plating, Overflow Capacitor | Ram Plating: armor adds to every hit | Ironclad Lattice: armor stays between turns | Thorned: armor soaks its thorns |
| Volley | SMG, Machine Gun, Twin Pistols, Rifle | Twinned gear: +1 shot | Might on every shot; Blood Rite, Adrenal Pump | Split Rounds: twice the shots at half power | Regenerator: many hits outpace regrowth |

Thermal Shock Core and Catalyst Prism tie two archetypes together.

## Exams

| Trait | What it does | Answer |
|---|---|---|
| Plated | Hits under 4 damage do 1 | Big hits: Might, payoffs, marks, heavy weapons |
| Regenerator | Heals a tenth of its health each turn unless burning | Burn, or many hits |
| Berserker | +1 damage each of its turns | Chill, armor, a fast kill |
| Thorned | Each hit on it hurts the attacker 1 | Armor, knockback, few big hits |

Code: `core/stacks.ts` (payoffs, spreaders), `core/exams.ts` (boss traits), `core/relics.ts`, `core/gear.ts`.
