// The title screen, story and the choice of hero.
import { CLASSES } from "../core/classes";
import { cardName, SIGNATURES } from "../core/cards";
import type { Run, Soldier } from "../core/run-state";
import { places } from "./globe";
import { badge } from "./html";
import { heroDossier } from "./sheet";
import { classIcon } from "./class-icons";
import { weaponIcon } from "./weapon-icons";

/** The title screen, before a run begins. */
export function title(): string {
  return `<div class="menu">
    <h1>TacticalAuto</h1>
    <p>One hero against the invasion. Raid the alien hub.</p>
    <button id="start" class="decide">New run</button>
  </div>`;
}

/** The story so far, line by line, before the run's first choice. */
const STORY = [
  "Three years ago they came down at the South Pole. Their hub lies under the Antarctic ice, and every month it reaches farther.",
  "No army has got near it. One hero might, if they can cross the world alone.",
  "Take a satellite on each continent for its access key. Three keys open the hub.",
  "The aliens will notice. Every stop you make, they hunt you harder.",
];

/** The story told in lines that fade in one after another, then a button on to the first choice. */
export function story(): string {
  return `<button class="skip" data-begin>Skip ⏭</button><div class="menu story">
    ${STORY.map((line, i) => `<p style="animation-delay: ${0.3 + i * 1.4}s">${line}</p>`).join("")}
    <button id="begin" class="decide" style="animation-delay: ${0.3 + STORY.length * 1.4}s">Choose where to begin</button>
  </div>`;
}

/** A candidate as a small card to open: badge, class, name, weapon and class card by name. */
export const candidateCard = (hero: Soldier, index: number) =>
  `<button data-candidate="${index}" class="candidate" aria-haspopup="dialog">
    <span class="emblem" aria-hidden="true">${badge(hero.cls)}</span>
    <small class="cls">${CLASSES[hero.cls!].name}</small>
    <b class="name">${hero.name}</b>
    <span class="line">${hero.gear ? `${weaponIcon(hero.gear.weapon)} ${hero.gear.name}` : "Empty hands"}</span>
    <span class="line">${classIcon(hero.cls!)} ${cardName(SIGNATURES[hero.cls!])}</span>
  </button>`;

/** Candidate `index` in full, with the way back or to deploy with them. */
export const candidateDossier = (run: Run, index: number) => heroDossier(run, run.candidates[index], `<button data-back>Back</button><button class="decide" data-deploy="${index}">Deploy</button>`);

/** The run's first choice: which hero plays it, three cards over a turning globe with their homes pinned. `open` shows one hero in full, the globe turned to their city. */
export function candidates(run: Run, open: number | null): string {
  const homes = run.candidates.map((r, i) => ({
    at: r.home.at,
    chosen: i === open,
    html: `<span class="home${i === open ? " chosen" : ""}">${r.home.name}</span>`,
  }));
  // The panel is zoomed by --ui, so the window in its own pixels is that much larger.
  const ui = Number(getComputedStyle(document.documentElement).getPropertyValue("--ui")) || 1;
  const [w, h] = [innerWidth / ui, innerHeight / ui];
  // The globe stands clear of the cards below it; a dossier slides it behind the hero.
  const size = { w, h, top: 60, bottom: w < 700 ? h * 0.32 : 230 };
  return `<div class="menu picking${open === null ? "" : " opened"}">
    <div class="map flight">${places(size, homes, open === null)}</div>
    <h2>Who saves the world?</h2>
    <div class="choices"${open === null ? "" : " inert"}>${run.candidates.map((r, i) => candidateCard( r, i)).join("")}</div>
    ${open === null ? "" : candidateDossier(run, open)}
  </div>`;
}
