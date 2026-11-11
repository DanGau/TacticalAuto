// The title screen, story and recruit choice.
import { classPower, CLASSES } from "../core/classes";
import type { Run, Soldier } from "../core/run-state";
import { charges } from "../core/squad";
import { places } from "./globe";
import { badge } from "./html";
import { heroDossier } from "./sheet";

/** The title screen, before a run begins. */
export function title(): string {
  return `<div class="menu">
    <h1>TacticalAuto</h1>
    <p>Gather the world's last heroes. Raid the alien hub.</p>
    <button id="start" class="decide">New run</button>
  </div>`;
}

/** The story so far, line by line, before the run's first choice. */
const STORY = [
  "Three years ago they came down at the South Pole. Their hub lies under the Antarctic ice, and every month it reaches farther.",
  "No army has got near it. A team might: the last heroes alive, scattered across the world.",
  "Cross the globe to find them, one continent at a time. Each you reach joins you. Lose one, and it is over.",
  "The aliens will notice. Every stop you make, they hunt you harder.",
];

/** The story told in lines that fade in one after another, then a button on to the first choice. */
export function story(): string {
  return `<button class="skip" data-begin>Skip ⏭</button><div class="menu story">
    ${STORY.map((line, i) => `<p style="animation-delay: ${0.3 + i * 1.4}s">${line}</p>`).join("")}
    <button id="begin" class="decide" style="animation-delay: ${0.3 + STORY.length * 1.4}s">Choose where to begin</button>
  </div>`;
}

/** A recruit as a small card to open: badge, class, name, weapon and ability by name. */
export const recruitCard = (run: Run, recruit: Soldier, index: number) =>
  `<button data-recruit="${index}" class="recruit" aria-haspopup="dialog">
    <span class="emblem" aria-hidden="true">${badge(recruit.cls)}</span>
    <small class="cls">${CLASSES[recruit.cls!].name}</small>
    <b class="name">${recruit.name}</b>
    <span class="line"><i aria-hidden="true">⚔</i> ${recruit.gear?.name ?? "Empty hands"}</span>
    <span class="line"><i aria-hidden="true">✦</i> ${classPower(CLASSES[recruit.cls!], charges(run, recruit)).name}</span>
  </button>`;

/** Recruit `index` in full, with the way back or to deploy with them. */
export const recruitDossier = (run: Run, index: number) => heroDossier(run, run.recruits[index], `<button data-back>Back</button><button class="decide" data-deploy="${index}">Deploy</button>`);

/** The run's first choice: which recruit leads the squad, three cards over a turning globe with their homes pinned. `open` shows one hero in full, the globe turned to their city. */
export function recruits(run: Run, open: number | null): string {
  const homes = run.recruits.map((r, i) => ({
    at: r.home!.at,
    chosen: i === open,
    html: `<span class="home${i === open ? " chosen" : ""}">${r.home!.name}</span>`,
  }));
  // The panel is zoomed by --ui, so the window in its own pixels is that much larger.
  const ui = Number(getComputedStyle(document.documentElement).getPropertyValue("--ui")) || 1;
  const [w, h] = [innerWidth / ui, innerHeight / ui];
  // The globe stands clear of the cards below it; a dossier slides it behind the hero.
  const size = { w, h, top: 60, bottom: w < 700 ? h * 0.32 : 230 };
  return `<div class="menu picking${open === null ? "" : " opened"}">
    <div class="map flight">${places(size, homes, open === null)}</div>
    <h2>Who leads the party?</h2>
    <div class="choices"${open === null ? "" : " inert"}>${run.recruits.map((r, i) => recruitCard(run, r, i)).join("")}</div>
    ${open === null ? "" : recruitDossier(run, open)}
  </div>`;
}
