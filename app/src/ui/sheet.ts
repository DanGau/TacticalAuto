// Character sheets and stat blocks: a hero's or alien's numbers, weapon and powers, told one way everywhere.
import { ALIENS, type AlienKind } from "../core/aliens";
import type { Stats } from "../core/battle";
import { classPower, CLASSES } from "../core/classes";
import type { Keyword } from "../core/keywords";
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
import { treeMap } from "./tree";
import {
  describe,
  gearStats,
  gearText,
  gearType,
  resistChip,
  weaponDoes,
} from "./html";
import { WEAPONS } from "../core/weapons";
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
export const powerBlock = (power: Power, tags?: Keyword[], held?: Keyword[]) =>
  `<div class="power described"><b>${power.name}</b> <small class="use">${usage(power)}</small><div>${describe(power.text, tags, held)}</div></div>`;

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

/** A hero's weapon: its type and special. */
const kit = ({ gear }: Soldier) =>
  gear ? `${gearType(gear)}. ${gearText(gear)}` : "";

/** A hero's powers: its bonus attack, then those it learned, its class's ability with its uses worked out. */
const powers = (run: Run, hero: Soldier): (Power & { tags?: Keyword[] })[] => [
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

/** A recruit as a card: name and class, then its weapon and class ability in plain words; its numbers and bonus attack in brief, in full on hover or tap. */
export function heroCard(run: Run, hero: Soldier): string {
  const stats = soldierStats(run, hero);
  const cls = CLASSES[hero.cls!];
  const ability = classPower(cls, charges(run, hero));
  const bonus = secondaryPower(SECONDARIES[secondaryOf(hero)]);
  const numbers = [
    `HP ${stats.hp}`,
    `Armor ${stats.armor}`,
    `Move ${stats.move}`,
    `Damage ${stats.damage}`,
    `Range ${stats.range}`,
    `Crit ${Math.round(100 * stats.crit)}%`,
    `Strength ${stats.strength}`,
    `Jump ${stats.jump}`,
  ];
  const weapon = hero.gear
    ? `<b class="tip" ${markTip([`${hero.gear.name}: ${WEAPONS[hero.gear.weapon].type}`, ...gearStats(hero.gear)])}>${hero.gear.name}</b><span>${weaponDoes(hero.gear)} ${gearText(hero.gear)}</span>`
    : "<b>Empty hands</b>";
  return `<small class="cls">${cls.name}</small>
  <b class="name">${hero.name}</b>
  <div class="key"><small class="label">Weapon</small>${weapon}</div>
  <div class="key"><small class="label">Ability · ${usage(ability)}</small><b>${ability.name}</b><span>${ability.text}.</span></div>
  <small class="more"><span class="tip" ${markTip(numbers)}>${stats.hp} HP · ${stats.move} move</span> · <span class="tip" ${markTip([`${bonus.name}: ${usage(bonus)}`, `${bonus.text}.`])}>Bonus attack: ${bonus.name}</span></small>
  ${duoHint(run, hero)}`;
}

/** A hero's powers in full. */
export const powerList = (run: Run, hero: Soldier, held?: Keyword[]) =>
  `<div class="powers">${powers(run, hero)
    .map((p) => powerBlock(p, p.tags, held))
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
