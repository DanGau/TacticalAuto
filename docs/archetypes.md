# Archetypes

A proposal: the build-arounds each pool leans to, after Slay the Spire's archetypes [1]. Cards named but not in `core/cards.ts` are new. Not implemented.

Draw is rare and deliberate: Tactical Reload and Adrenaline. A card that moves, Aims or Blocks does only that.

## Archetypes

| Archetype | Payoffs | Enablers | Board |
| --- | --- | --- | --- |
| **Aim** (one big hit) | Aimed Shot, Kill Shot, Railgun, Headshot | Steady Aim, Bipod, Reposition, Spotter Drone | High ground, long sight lines |
| **Mark** (execute) | Kill Shot, Hollow Points, Lock-On Beacon | Called Shot, Hunter's Mark, Headshot, Tracer Feed | Range, line of sight |
| **Multi-hit** (per-hit stacking) | Fan the Hammer, Barrage, Spray | Hot Loads, Incendiary, Cryo Payload, Ricochet | Short range, open lanes |
| **Burn** | Napalm Sprayer, Spore Rounds, Thermal Shock | Fireball, Flame Jet, Napalm Burst, Incendiary | Fuel tanks, swamp gas |
| **Chill** (control) | Shatter Charge, Frost Snare, Cryo Coil | Frost Ray, Flash Freeze, Cryo Burst, Cryo Payload | Water |
| **Displace** (Impact, falls) | Impact Driver, Topple Charges, Concussion Shells | Buckshot, Slug Round, Uppercut, Shoulder Charge, Grapple Shot, Lure | Walls, chasms, ledges |
| **Armor** (Block, outlast) | Riposte, Iron Hide, Reactive Bracing | Defend, Shield Wall, Plating, Holy Shield, Shield Bash | Choke points, cover |
| **Kite** (Retreat, dodge intents) | Hit and Run, Smoke Screen | Fall Back, Reposition, Jump Jets, Shadow Step | Range, walls between |
| **Cleave** (area) | Whirlwind, Seismic Slam, Overkill Relay, Volatile | Frag Charge, Hammer Blow, Ground Slam, Lure | Packed clusters, Kill box |

Cancels steer hybrids: Burn and Chill Quench unless Thermal Shock bridges them; Displace knocks a target out of a Cleave's area unless Lure regroups it.

## Pools

Weapons, 2 to 3 each:

- **Rifle:** Multi-hit, Mark, Kite.
- **Sniper:** Aim, Mark, Kite.
- **Shotgun:** Displace, Multi-hit (new: Scattershot, many hits at range 2).
- **SMG:** Multi-hit, Kite.
- **LMG:** Aim, Multi-hit, Cleave.
- **Pistols:** Multi-hit, Mark, Kite.
- **Hammer:** Displace, Cleave.
- **Sword:** Cleave, Armor (Riposte), Multi-hit (new: Flurry).
- **Shield:** Armor, Displace.
- **Fists:** Displace, Multi-hit.

Classes:

- **Assault:** Displace (Charge), Armor (Rally).
- **Heavy:** Cleave, Armor.
- **Sniper:** Mark, Aim.
- **Support:** Armor, Kite (new: heal on Retreat).
- **Engineer:** Multi-hit, Cleave (new: turrets as area).
- **Pyro:** Burn, Cleave.
- **Cryo:** Chill, Kite (Chill slows pursuers).
- **Phantom:** Mark (Backstab on Marked), Kite (Cloak, Shadow Step).

## Overlap

Shared archetypes, weapon by class. Two shared is a focused build; one is a hybrid; none is weak.

| | Assault | Heavy | Sniper | Support | Engineer | Pyro | Cryo | Phantom |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rifle | – | – | Mark | Kite | Multi | – | Kite | Mark, Kite |
| Sniper | – | – | Aim, Mark | Kite | – | – | Kite | Mark, Kite |
| Shotgun | Displace | – | – | – | Multi | – | – | – |
| SMG | – | – | – | Kite | Multi | – | Kite | Kite |
| LMG | – | Cleave | Aim | – | Multi, Cleave | Cleave | – | – |
| Pistols | – | – | Mark | Kite | Multi | – | Kite | Mark, Kite |
| Hammer | Displace | Cleave | – | – | Cleave | Cleave | – | – |
| Sword | Armor | Cleave, Armor | – | Armor | Multi, Cleave | Cleave | – | – |
| Shield | Displace, Armor | Armor | – | Armor | – | – | – | – |
| Fists | Displace | – | – | – | Multi | – | – | – |

Burn and Chill stay class-led: neutral Powers (Incendiary, Cryo Payload) carry them onto any Multi-hit weapon, so every Multi gun pairs with Pyro or Cryo through per-hit stacking.

## Weak pairings and fixes

- **Melee with Sniper class:** nothing shared. Add a melee Mark payoff: Executioner's Cut, more damage on a Marked target at range 1. Fixes Sword, Fists and Hammer with Sniper and Phantom.
- **Melee with Cryo:** nothing shared. Chill on melee: Frost Knuckles (Fists), Shatter on Impact (Hammer). Chill an alien, then Displace it into water.
- **Shotgun:** one archetype, Displace, and only Assault shares it. Add Multi-hit (Scattershot) so it meets Pyro and Cryo through per-hit Powers, and a Shotgun Kite card (Recoil Step: hit, then Retreat 2).
- **Blademasters with guns:** the doctrine favours range 1, which guns barely have. Point Blank and Flank carry it; add a gun bayonet card (Bayonet: range 1, Mark 1) to share Mark.
- **Heavy with ranged guns:** shares only Cleave with LMG. Meteor Strike and Frag Charge make Cleave a gun build; add a Heavy Aim card (Brace: Block and Aim) to meet Sniper and Rifle.
- **Assault with Kite guns:** Assault charges in, Kite steps out. Hit and Run and Jump Jets bridge them: in, strike, out.

## Sources

1. [Slay the Spire Wiki: Ironclad cards](https://slaythespire.wiki.gg/wiki/Ironclad_Cards)
