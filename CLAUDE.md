# TacticalAuto

An isometric roguelike deck-builder on a tactical board. Premise: [docs/premise.md](docs/premise.md). Card rules: [docs/cards.md](docs/cards.md). Design principles for new mechanics: [docs/game-design.md](docs/game-design.md).

Architecture rules: [docs/architecture/CLAUDE.md](docs/architecture/CLAUDE.md). Read before designing or writing code.

## Rules

1. **Agent first.** The agent does all the work: code, tests, installs, setup, debugging, bug fixes. The human supplies judgment and taste only.
2. **Brevity.** Code, comments, docs, commits, and replies follow the [brevity skill](.claude/skills/brevity/SKILL.md). Don't document decisions not made, things that don't exist, or detail nobody asked for.
3. **Enforce mechanically.** If a linter, type, test, or hook can enforce a rule, it does. Model judgment is for open-ended problems.
4. **No memorial to the old way.** When behavior changes, the old behavior is absent: no legacy names, shims, commented-out code, or "previously we". History lives in git.
5. **Progressive disclosure.** This file stays under 50 lines. Detail goes in `docs/`, linked from here.
6. **Commit and push after every change**, straight onto `main`.
7. **End every reply with the game link:** https://dangau.github.io/TacticalAuto/

## Commands

Run in `app/`.

- `npm run check` — lint, typecheck, the built game loading with no error (`npm run smoke`), tests, and sim batches: no battle stuck, and the strategic bot can win runs.
- `npm run -s sim -- --runs=500 --bot=random` — bots play runs in Node and print a report.
- `npm run -s sim -- --runs=100 --bot=all --doctrine=blades` — the same, the hero holding a doctrine from the start.
- `npm run -s sim -- --runs=100 --bot=all` — every bot strategy on the same seeds, ranked.
- `npm run -s sim -- --runs=100 --bot=strategic --diagnose` — battles by challenge and leg: wins, health lost and Energy left unspent, saying of what is off whether the game or the bot is at fault.
- `npm run -s tsx -- src/sim/encounter.ts --runs=30 [--cards=a,b]` — the challenge lab: each challenge by leg and rung, the strategic bot playing the starter deck and each card added.
- `npm run -s sim -- --runs=100 --deck` — the strategic bot keeping a lean deck, skipping every card, and taking every offer, on the same seeds: does skipping pay.
- `npm run -s exam -- --seeds=150 --loadouts=a+b,a+b+c [--escorts=hp]` — the exam lab: a fixed hero per loadout against each Guardian exam and a late elite; rounds to fell it, health lost, and each combo's synergy ± se.
- `npm run -s sim -- --runs=100 --rest` — each safehouse and medkit on offer played on both ways, by health and leg, and fixed rest policies on the same seeds.
- `npm run -s sim -- --runs=60 --loadouts=nanites,overkill+volatile` — the strategic bot holds each relic or gear effect (`+` pairs them) from the start, against none on the same seeds: win difference, synergy of pairs, healing a battle. `--power` plays every single.
- `npm run test -- <files>`, `npm run tsx -- <script>` — run tests or a script under a deadline that kills it if it hangs. A hook blocks running `vitest` or `tsx` directly.
- `npm run -s eye -- <command>` — play and screenshot the game in a headless browser. Commands: `app/eye/eye.ts`. One server and browser serve all worktrees; `eye -- stop` ends them.
- `npm run -s eye -- play eye/hand.json` — fails unless the hand's cards, a target and End Turn take a click, an attack with no target is greyed, Advance brings it in reach and Fall Back plays, on phone, landscape phone and desktop.
- `npm run -s eye -- play eye/card-reward.json` — fails unless each reward card and Skip take a click, at the same sizes.
- `npm run -s eye -- play eye/safehouse.json` — fails unless a safehouse upgrades the card picked, or rests for 30% of max HP, at three sizes.
- `npm run -s eye -- play eye/shop.json` — fails unless a shop's Remove a card takes the card picked out of the deck, at three sizes.
- `npm run -s eye -- play eye/gear-swap.json` — fails unless the gear swap sits centred, its cards equal, at five screen sizes.
- `npm run dev` — serve the game for a human. Each push to `main` also deploys it to https://dangau.github.io/TacticalAuto/.
