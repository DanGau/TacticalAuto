# Text style

Game text reads like a Slay the Spire card [1] [2]: short, keyword-led, no lore. `core/text-style.test.ts` enforces what it can.

## Rules

1. **Trigger tags.** A trigger opens with a short tag: "On hit,", "On kill,", "On Crit,", "On landing,", "Impact:", "Start of turn:", "Start of battle:", "When hit:", "When you would fall:", "At half HP or less:".
2. **Keywords.** A repeated mechanic is a keyword in `core/keywords.ts`: capitalized, bolded and defined on hover by the card, never used lowercase. The card names it ("**Knockback** 2", "**Parry** 1 hit each turn") and never explains it.
3. **Words.** "Adjacent", not "beside". "×" for multipliers. Drop "you" and "your" where clear.
4. **Numbers.** Every amount is a digit, pulled from its constant. "More" and "less" carry a number. No "+2 damage".
5. **Short.** One idea per sentence, each ending in a full stop. Fragments are fine ("First hit: 2."). Drop what a keyword or the stat line already says. At most 130 characters.
6. **No lore, no hedging.** No "may", "some", "a little", "tries to". Flavour lives in names and event stories.
7. **Names** are 1 to 3 words, Title Case.

## Examples

| Before | After |
| --- | --- |
| Whenever you hit, apply 1 Burn. Your first hit each attack applies 2. | On hit, apply 1 **Burn**. First hit: 2. |
| When Burn meets Chill on an alien, they explode instead of Quenching. Per stack of each, deal 3 times your damage to it and half to each alien beside it. | **Burn** and **Chill** explode instead of **Quench**: deal 3× damage per stack. Half splashes to adjacent aliens. |
| Knock the target back 1 tile. If it hits something, deal 1 damage to both. | On hit, **Knockback** 1. **Impact**: deal 1 damage to both. |
| Your Overkill also hits the nearest other alien. | **Overkill** damage hits the nearest alien. |
| Ignore the first hit on you each turn. Whenever you kill an alien, deal 2 damage to each alien beside it. | **Parry** 1 hit each turn. On kill, deal 2 damage to adjacent aliens. |

## Sources

1. [Slay the Spire Wiki: Ironclad cards](https://slaythespire.wiki.gg/wiki/Ironclad_Cards)
2. [Slay the Spire Wiki: Keywords](https://slaythespire.wiki.gg/wiki/Keywords)
