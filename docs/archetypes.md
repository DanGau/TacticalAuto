# Archetypes

How a build scales, borrowed from Slay the Spire. Each archetype has causes that build stacks, engines that build more of them faster, payoffs that turn them into damage and defense, a rule-breaker that changes how its mechanic works, and a Guardian exam it answers.

## The seven rules

1. **Long fights.** Leg Guardians and elites are few tough aliens that last 3 to 5 rounds, so scaling has time to pay. Guardians are the power check.
2. **Multiplication.** Might adds its whole value to every shot, as Strength does to every hit. A payoff adds half the hero's damage for each stack it spends, so stacks multiply damage. Catalyst Prism doubles a target's stacks.
3. **Frequency.** On-hit effects fire on every shot of a multi-shot weapon, so shots × stacks a shot is a build. Engines add shots.
4. **Defense scales too.** Spending stacks also shields the hero, stuns or weakens; armor builds and hits back; healing past full becomes armor.
5. **Rule-breakers.** One relic per archetype changes how its mechanic works.
6. **Guardians as exams.** Each leg's Guardian has a trait shown on the map from the leg's start: the gap it tests and the builds that pass it.
7. **A focused pool.** Relic offers favour keywords the squad holds, the first one a payoff of what it causes. A shop may drill one hero as the squad's Carry: its hits add twice the stacks.

## Archetypes

| | Causes | Engines | Payoffs | Rule-breaker | Exam passed |
|---|---|---|---|---|---|
| Burn | Scorching gear, Salamander Sigil, Pyro | Billowing gear, Wildfire Spores (copy) | Accelerant Gel: damage and temp HP | Eternal Flame: burn never fades | Regenerator |
| Chill | Rimed gear, Frost Lattice, Cryo | Cryo Conductor (copy) | Shatterglass Edge: damage and a stun | Permafrost Heart: Guardians freeze too | Berserker |
| Mark | Seeking gear, Eye of the Hunt | Witch's Hex (copy) | Spotter Network: damage and weakness | Dead Eye Ledger: payoffs leave marks on | Plated |
| Force | Shoving, Thundering, Tethered gear | Domino Rig | Kinetic Engine, Toppling gear | Gravity Lens: every shot knocks back | Thorned |
| Guard | Alien Alloys, Bracing gear, Bloodforged Plate | Adaptive Plating, Overflow Capacitor | Ram Plating: half the armor on every hit | Ironclad Lattice: armor builds twice as high | Thorned, Berserker |
| Volley | Rifle, SMG, Machine Gun, Twin Pistols | Hair Trigger, Quick Draw, Twinned gear | Might on every shot: Blood Rite, Adrenal Pump | Split Rounds: twice the shots at half power | Regenerator |

Thermal Shock Core and Catalyst Prism tie burn, chill and marks together. Sapping gear weakens on every hit.

## Exams

| Trait | What it does | Passed by |
|---|---|---|
| Plated | Hits under 6 damage do half | Might, marks, payoffs, heavy weapons |
| Regenerator | Heals a tenth of its health each turn unless burning, up to 60% a battle | Burn, many hits |
| Berserker | Gains 1 Might each turn | Chill, armor, a fast kill |
| Thorned | Each hit on it hurts the attacker 1 | Armor, knockback |

Code: `core/stacks.ts` (payoffs, spreaders, volleys), `core/exams.ts`, `core/relics.ts`, `core/gear.ts`.
