# Design

Target design; `app/` holds what is built.

## Stack

TypeScript (strict), Vite, Pixi.js, Vitest, ESLint, tsx, npm. Versions: `app/package.json`.

## Layers

Imports point down this list only.

| Layer | Owns | May import |
|---|---|---|
| `view/`, `ui/` | Pixi rendering; turning input into actions | `core/` |
| `bots/` | Players that decide without a human | `core/` |
| `sim/` | Node CLI that plays runs with bots | `core/`, `bots/` |
| `core/` | Every game rule: battle and run | nothing |

## Core

- **State** is one plain, serializable object. It holds the RNG state and the beat count.
- **`step(state)`** advances one beat: a side's simultaneous move, or one unit's shot. The browser animates a beat's events, then steps again; Node steps without waiting.
- **`apply(state, action) → { ok, reason? }`** is the only way a player changes state. UI, bots, tests, and the debug interface all call it.
- **Events** are plain data the core emits for the view (move, shot, death). The core never calls the view.
- **Deterministic.** Same seed and same actions give the same state. No `Math.random`, `Date.now`, DOM, or module-level mutable state.

## Bots

A bot is one function per decision point: observation in, action out, both plain data. Two ship from the start: random and heuristic.

## Simulation

`sim/` runs in Node with no browser, in three levels: battle, run, batch.

- Seed = run index. A run's record is its seed and action list; replaying them reproduces it in Node or the browser.
- Each battle and run yields a typed result. A collector turns results into a report, as text or JSON.
- The report has health thresholds. A failed threshold sets a non-zero exit code.

## How the model sees and plays

- **`window.debug`** forwards to the core and holds no logic: `snapshot()` returns the state, `apply(action)`, `step(n)` advances n beats, renders without animation, and returns the snapshot. Cheats sit in `window.debug.cheat`.
- **`eye`** is one CLI. It keeps the dev server and a headless browser alive between calls, prints JSON only, and saves screenshots at a fixed viewport to a gitignored folder keyed by commit.
- **Playbooks** are JSON lists of `eye` commands run in one call, including `step-until <expression>`.

## Enforcement

- ESLint allowlists each layer's imports per the table and bans `Math.random` and `Date.now` in `core/`.
- `core/` compiles under its own tsconfig without the DOM lib.
- A test replays a seed and action list twice and compares state.
- Pre-commit runs lint, typecheck, tests, and a small sim batch.
