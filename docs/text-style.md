# Text style

Game text reads like Slay the Spire's cards ("Deal 8 damage. Apply 2 Vulnerable."; "At the start of your turn, gain 2 Strength."; "Whenever you gain Block, deal 5 damage to a random enemy.") [1] [2]. `core/text-style.test.ts` enforces what it can.

## Rules

1. **Action first, imperative.** The hero is "you": "Deal 2 damage to each alien beside the target." Not "Does 2 damage", "The hero gains".
2. **Trigger, then effect.** A trigger opens the sentence and a comma ends it, in one of these forms: "At the start of your turn,", "At the end of your turn,", "At the start of each battle,", "Whenever you …,", "When you would fall,", "The first time …,". A condition leads the same way: "If you did not move this turn,", "While you have Armor,".
3. **Keywords.** A keyword is capitalized and means one thing everywhere: Burn, Chill, Freeze, Mark, Displace, Impact, Crit, Overkill, Armor, Root, Stun, Numb, Weak, Might and the rest of `core/keywords.ts`. The card colours it and defines it on hover. A word in the glossary is never used lowercase in another sense.
4. **Numbers.** Every amount is a digit: "Apply 2 Burn", "Heal 3", "Gain 1 Armor". "More" and "less" carry a number: "Deal 2 more damage". No "+2 damage", no spelled numbers.
5. **One sentence per effect**, each ending in a full stop.
6. **No lore, no hedging.** No "may", "some", "a little", "harder", "tries to". Flavour lives in names.
7. **Names** are 1 to 3 words, Title Case, and say what the thing is or does.
8. **Usage line** stays separate: use, range and target (`core/powers.ts`), so the text holds only the effect.

## Sources

1. [Slay the Spire Wiki: Ironclad cards](https://slaythespire.wiki.gg/wiki/Ironclad_Cards)
2. [Slay the Spire Wiki: Keywords](https://slaythespire.wiki.gg/wiki/Keywords)
