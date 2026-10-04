---
name: launch
description: Open the game in a window for the human to play, with the agent attached to see what they see.
---

# Launch

In `app/`, run `npm run -s eye -- launch [seed]`. A game window opens; the human plays in it.

While it is open, every `eye` command acts on that window:

- `snapshot` and `screenshot <name>` show the human's game. Use them when asked what they see.
- `apply`, `step`, `click`, and `open` change the human's game. Use them only when asked.

`npm run -s eye -- stop` closes the window.
