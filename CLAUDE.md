# TacticalAuto

An isometric roguelike auto battler. Premise: [docs/premise.md](docs/premise.md).

Architecture rules: [docs/architecture/CLAUDE.md](docs/architecture/CLAUDE.md). Read before designing or writing code.

## Rules

1. **Agent first.** The agent does all the work: code, tests, installs, setup, debugging, bug fixes. The human supplies judgment and taste only.
2. **Brevity.** Code, comments, docs, commits, and replies follow the [brevity skill](.claude/skills/brevity/SKILL.md). Don't document decisions not made, things that don't exist, or detail nobody asked for.
3. **Enforce mechanically.** If a linter, type, test, or hook can enforce a rule, it does. Model judgment is for open-ended problems.
4. **No memorial to the old way.** When behavior changes, the old behavior is absent: no legacy names, shims, commented-out code, or "previously we". History lives in git.
5. **Progressive disclosure.** This file stays under 50 lines. Detail goes in `docs/`, linked from here.
6. **Commit and push after every change**, straight onto `main`.
