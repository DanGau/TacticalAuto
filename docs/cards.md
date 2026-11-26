# Cards

Every action the hero takes in a battle is a card, after Slay the Spire [1]. Movement is automatic; cards attack, defend, move and build. Numbers live in `core/cards.ts` and `core/turn.ts`.

## A round

1. **Move.** The aliens move, then the hero's automatic move.
2. **Play.** The hero's Block falls to 0, it gains its Energy and draws to its hand. The player plays cards, then ends the turn. The hand is discarded, but a card with **Retain** stays.
3. **Enemy.** Each alien acts on its intent, as the board then stands.

The draw pile is the deck, shuffled at the start of a battle. When it runs out, the discard pile is shuffled into it. A card with **Exhaust** leaves the battle once played.

## The hero's automatic move

With an alien in the fight, the hero walks toward the nearest tile from which its weapon has a shot, by its class's or weapon's way: a melee hero closes in, a sniper keeps its distance. With none, it marches on its goal. It never attacks on its own. A card that moves the hero adds to this move; it never replaces a card play.

## Intents

Over each engaged alien its intent shows, as in Slay the Spire: **Attack** with the damage it would deal and its target, **Ability** for a power such as a psion's panic, or **Move** when it has no shot. Intents read the board as it stands and change as cards move the hero or the aliens. An alien whose target is out of its reach when its turn comes does not attack. So a card that moves the hero out of reach, or knocks an alien away, answers an intent as Block does.

## Card types

- **Attack.** Deals damage to an alien. It needs a target in range and line of sight from where the hero stands. With none, the card is greyed and says why ("No target in range 1."). A card with **Move** reaches a target within its move plus its range, stepping first.
- **Skill.** Block, moves, draw, Energy, healing and the like.
- **Power.** Lasts the battle. Most lend a gear or relic effect to every attack, so the quantities below come from Powers.

## Keywords

- **Block** absorbs damage until the hero's next turn.
- **Move** N: step up to N tiles. Toward the target if the card has one, else to the tile best placed for the hero's weapon.
- **Retreat** N: step up to N tiles away from the aliens.
- **Knockback** N, **Pull** N: drive the target away from the hero, or toward it. Into a wall, object or alien is an **Impact**; off a ledge or into a chasm is a fall.
- **Burn**, **Chill**, **Mark**, **Crit**, **Overkill**, **Armor**: the combo quantities, as [combos](combos.md) tells, with their cancellations and bridges.
- **Exhaust**, **Retain**: above.

## The deck

- **Starter deck.** 10 cards: 4 of the weapon's Strike, 4 Defend, 1 Dash and the class's signature card. Every hero has one class and one weapon; the weapon's Strike is its way of fighting: Twin Pistols fire two cheap shots, a Hammer smashes a knot of aliens.
- **Rewards.** Each battle won offers 3 cards: take 1 or Skip. Cards are of the hero's class or of no class, each of a rarity: common, rare or epic. Rarer cards come more often as the run goes on, and an elite's reward is never common.
- **Upgrades.** A card upgraded plays as its "+": more damage, more Block, less cost. A safehouse rests or upgrades a card.
- **Shops** sell cards, and remove one card once a shop.
- **Relics** stay passives, as Slay the Spire's.

## Terrain

The ground keeps its meaning through cards: **Knockback** into a chasm or off a ledge is a fall, **Chill** beside water stacks one more, a hero on high ground deals more and sees farther, and fuel tanks burn what stands beside them when hit.

## Sources

1. [Slay the Spire Wiki: Cards](https://slaythespire.wiki.gg/wiki/Cards)
