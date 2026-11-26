// Character sheets and stat blocks: a hero's or alien's numbers, weapon and class card, told one way everywhere.
import { ALIENS, type AlienKind } from "../core/aliens";
import type { Stats } from "../core/battle";
import { CLASSES } from "../core/classes";
import type { Run, Soldier } from "../core/run-state";
import { health, soldierStats } from "../core/hero";
import { cardName, cardText, SIGNATURES } from "../core/cards";
import { css } from "../view/shapes";
import { COLOR } from "../view/palette";
import { badge, gearStats, gearText, gearName, resistChip, sentence, weaponDoes } from "./html";
import { tip as markTip } from "./charts";
import { cardIcon } from "./card-icons";
import { weaponIcon } from "./weapon-icons";

/** A row of named numbers. */
export const statBlock = (cells: [string, string | number][]) =>
  `<div class="statblock">${cells.map(([name, value]) => `<span><small>${name}</small><b>${value}</b></span>`).join("")}</div>`;

/** A hero's numbers. */
const heroStats = (run: Run, hero: Soldier) => {
  const stats = soldierStats(run, hero);
  return statBlock([
    ["HP", `${health(run, hero)}/${stats.hp}`],
    ["Armor", stats.armor],
    ["Move", stats.move],
    ["Damage", stats.damage],
    ["Range", stats.range],
    ["Crit", `${Math.round(100 * stats.crit)}%`],
    ["Strength", stats.strength],
    ["Jump", stats.jump],
  ]);
};

/** A hero's weapon: its name and special. */
const kit = ({ gear }: Soldier) =>
  gear ? `${gearName(gear)}: ${gearText(gear)}` : "";

/** Its class, as a sheet heads it. */
const heading = (hero: Soldier) => (hero.cls ? CLASSES[hero.cls].name : "");

/** A hero's class card, the one its starter deck holds. */
const signature = (hero: Soldier) => (hero.cls ? `<div class="key"><small class="label">Class card</small><b>${cardIcon(SIGNATURES[hero.cls])} ${cardName(SIGNATURES[hero.cls])}</b><span>${cardText(SIGNATURES[hero.cls])}</span></div>` : "");

/**
 * A hero in full, as a dialog: their battle figure on a turning pedestal before their class badge; then name, class
 * and home, weapon, class card and numbers; and `actions`, its buttons.
 */
export function heroDossier(run: Run, hero: Soldier, actions: string): string {
  const cls = CLASSES[hero.cls!];
  const weapon = hero.gear
    ? `<b class="tip" ${markTip([hero.gear.name, ...gearStats(hero.gear)])}>${weaponIcon(hero.gear.weapon)} ${hero.gear.name}</b><span>${weaponDoes(hero.gear)}</span>${gearText(hero.gear) ? `<span>${gearText(hero.gear)}</span>` : ""}`
    : "<b>Empty hands</b>";
  return `<div class="dossier" role="dialog" aria-modal="true" aria-labelledby="dossier-name">
    <div class="stage" aria-hidden="true">
      <span class="emblem">${badge(hero.cls)}</span>
      <div class="pedestal"></div>
      <div class="figure" style="background:${css(COLOR.human)}">${cls.name[0]}</div>
    </div>
    <div class="about">
      <div class="who"><small class="cls">${heading(hero)}</small>
      <h2 id="dossier-name">${hero.name}</h2>
      <small class="home">🌍 ${hero.home.name}, ${hero.home.country}</small></div>
      <div class="key"><small class="label">Weapon</small>${weapon}</div>
      ${signature(hero)}
      ${heroStats(run, hero)}
      <div class="actions">${actions}</div>
    </div>
  </div>`;
}

/** A hero's whole sheet: numbers, weapon and its class card. */
export function heroSheet(run: Run, hero: Soldier): string {
  return `<div class="charsheet"><small>${heading(hero)}</small>${heroStats(run, hero)}
    <div class="weapon"><b>${hero.gear ? `${weaponIcon(hero.gear.weapon)} ${hero.gear.name}` : "Empty hands"}</b><small>${kit(hero)}</small></div>
    ${signature(hero)}</div>`;
}

/** An alien's stat block: name, numbers, what it does, what it resists. */
export const alienBlock = (
  kind: AlienKind,
  stats: Stats,
  hp = stats.hp,
) => `<div class="charsheet alien"><b class="name">${ALIENS[kind].name}</b> ${ALIENS[kind].resists.map(resistChip).join("")}
  ${statBlock([
    ["HP", hp],
    ["Armor", stats.armor],
    ["Move", stats.move],
    ["Damage", stats.damage],
    ["Range", stats.range],
    ["Strength", stats.strength],
    ["Jump", stats.jump],
  ])}
  <small>${sentence(ALIENS[kind].text)}</small></div>`;
