# Architecture

TacticalAuto is a web application.

## Rules

### 1. Keep complexity in the smallest box

One component owns the hard part and exposes something simple to everything else.

- **Test:** how many places would change if this got more complicated? If many, the box is too big.
- **Warning sign:** complexity that leaks across systems. Stop and ask why.

### 2. Code is unsurprising

Given only a name, signature, file name, or header comment, the code does what you expect. This applies at every level: function, file, module, service.

- **Test:** guess what something does, then read it. Each gap between guess and code is a surprise to remove.
- **Guardrail:** a header comment that restates the body cheats the test and breaks rule 3.

### 3. Don't duplicate information

Two copies drift; one then lies, and you can't tell which. This covers comments, constants, schemas, validation rules, business logic, and everything in `docs/`.

- **Comments** that say what the code does are duplicates. What they say instead: [brevity skill](../../.claude/skills/brevity/SKILL.md), "In code".
- **Risk grows with distance.** A duplicate on the next line gets fixed when you touch it. One in another module, a doc, or a config rots silently.
- **Fix:** when two places must agree, derive one from the other, or put the truth where both can read it.
