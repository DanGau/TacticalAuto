// Character sheets and stat blocks: a hero's or alien's numbers, weapon and powers, told one way everywhere.
import { ALIENS, type AlienKind } from "../core/aliens";
import type { Stats } from "../core/battle";
import { classPower, CLASSES } from "../core/classes";
import type { Flow, Quantity } from "../core/quantities";
import { usage, type Power } from "../core/powers";
import type { Run, Soldier } from "../core/run-state";
import {
  secondaryOf,
  charges,
  health,
  level,
  soldierStats,
  weaponOf,
} from "../core/squad";
import { secondaryPower, SECONDARIES } from "../core/secondaries";
import { powerOf, SKILLS } from "../core/skills";
import { PERKS } from "../core/perks";
import { treeMap } from "./tree";
import { css } from "../view/shapes";
import { COLOR } from "../view/palette";
import {
  badge,
  describe,
  gearStats,
  gearText,
  gearName,
  resistChip,
  weaponDoes,
} from "./html";
import { tip as markTip } from "./charts";
import { DUOS, duosFor } from "../core/duos";

/** The duos a hero forms with the squad, or with no squad yet, the classes it can: each by name and partner, its effect on hover. */
export function duoHint(run: Run, hero: Soldier): string {
  const duos = duosFor(run, hero);
  if (duos.length === 0) return "";
  const alone = run.soldiers.every((s) => s === hero);
  const chips = duos.map(
    ({ id, partner }) =>
      `<span title="${DUOS[id].text}">${alone ? partner : `${DUOS[id].name} with ${partner}${run.duos.includes(id) ? " ✓" : ""}`}</span>`,
  );
  return `<small class="duos">✦ Duos${alone ? " with" : ":"} ${chips.join(", ")}</small>`;
}

/** A row of named numbers. */
export const statBlock = (cells: [string, string | number][]) =>
  `<div class="statblock">${cells.map(([name, value]) => `<span><small>${name}</small><b>${value}</b></span>`).join("")}</div>`;

/** A power in full: its name, usage line and effect. */
export const powerBlock = (power: Power, flow?: Flow, held?: Quantity[]) =>
  `<div class="power described"><b>${power.name}</b> <small class="use">${usage(power)}</small><div>${describe(power.text, flow, held)}</div></div>`;

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
  gear ? `${gearName(gear)}. ${gearText(gear)}` : "";

/** A hero's powers: its bonus attack, then those it learned, its class's ability with its uses worked out. */
const powers = (run: Run, hero: Soldier): (Power & Flow)[] => [
  secondaryPower(SECONDARIES[secondaryOf(hero)]),
  ...hero.skills.map((id) =>
    id === powerOf(hero.cls!)
      ? classPower(CLASSES[hero.cls!], charges(run, hero))
      : SKILLS[id],
  ),
];

/** Class and level, as a sheet heads them. */
const heading = (hero: Soldier) =>
  `Level ${level(hero)}${hero.cls ? ` ${CLASSES[hero.cls].name}` : ""}`;

/** A hero's picks made: skills learned past its class power, then perks. */
function picksTaken(hero: Soldier): string {
  const names = [...hero.skills.filter((id) => id !== powerOf(hero.cls!)).map((id) => SKILLS[id].name), ...hero.perks.map((id) => PERKS[id].name)];
  return names.length > 0 ? `<div class="key"><small class="label">Picks taken</small><span>${names.join(" · ")}</span></div>` : "";
}

/**
 * A hero in full, as a dialog: their battle figure on a turning pedestal before their class badge; then name, level,
 * class and home, weapon, ability, picks taken, numbers, bonus attack and duos; and `actions`, its buttons.
 */
export function heroDossier(run: Run, hero: Soldier, actions: string): string {
  const cls = CLASSES[hero.cls!];
  const ability = classPower(cls, charges(run, hero));
  const bonus = secondaryPower(SECONDARIES[secondaryOf(hero)]);
  const weapon = hero.gear
    ? `<b class="tip" ${markTip([hero.gear.name, ...gearStats(hero.gear)])}>${hero.gear.name}</b><span>${weaponDoes(hero.gear)}</span>${gearText(hero.gear) ? `<span>${gearText(hero.gear)}</span>` : ""}`
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
      <small class="home">🌍 ${hero.home!.name}, ${hero.home!.country}</small></div>
      <div class="key"><small class="label">Weapon</small>${weapon}</div>
      <div class="key"><small class="label">Ability · ${usage(ability)}</small><b>${ability.name}</b><span>${ability.text}.</span></div>
      ${picksTaken(hero)}
      ${heroStats(run, hero)}
      <div class="key"><small class="label">Bonus attack · ${usage(bonus)}</small><b>${bonus.name}</b><span>${bonus.text}.</span></div>
      ${duoHint(run, hero)}
      <div class="actions">${actions}</div>
    </div>
  </div>`;
}

/** A hero's powers in full. */
export const powerList = (run: Run, hero: Soldier, held?: Quantity[]) =>
  `<div class="powers">${powers(run, hero)
    .map((p) => powerBlock(p, p, held))
    .join("")}</div>`;

/** A hero's whole sheet: numbers, weapon and kit, how it fights, and its powers in full. */
export function heroSheet(run: Run, hero: Soldier): string {
  const stance =
    hero.cls && !weaponOf(hero)?.stance
      ? `<small>${CLASSES[hero.cls].stanceText}.</small>`
      : "";
  return `<div class="charsheet"><small>${heading(hero)}</small>${heroStats(run, hero)}
    <div class="weapon"><b>${hero.gear?.name ?? "Empty hands"}</b><small>${kit(hero)}</small></div>${stance}
    ${powerList(run, hero)}${duoHint(run, hero)}${hero.cls ? treeMap(hero) : ""}</div>`;
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
  <small>${ALIENS[kind].text}.</small></div>`;
