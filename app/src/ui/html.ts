// Shared HTML pieces: buttons, bars, chips, gear cards and descriptions.
import { EXAMS, type Exam } from "../core/exams";
import type { Action } from "../core/apply";
import { EFFECTS, type Gear } from "../core/gear";
import { WEAPONS, type Kit } from "../core/weapons";
import { tip as markTip } from "./charts";
import { ALIENS, type AlienKind } from "../core/aliens";
import { BASE_STATS, type Stats } from "../core/battle";
import { CANCELS, QUANTITIES, RESISTS, type Cancel, type Flow, type Quantity, type Resist } from "../core/quantities";
import { TUNING } from "../core/tuning";
import type { ClassId } from "../core/classes";
import { type Mission } from "../core/run-state";
import { type StopKind } from "../core/run-state";
import { THREAT_MAX } from "../core/progress";

/** A button that performs `action` when clicked. */
export const button = (
  action: Action,
  label: string,
  cls = "",
  enabled = true,
  title = "",
) =>
  `<button class="${cls}" data-action='${JSON.stringify(action)}' ${title ? `title="${title}"` : ""} ${enabled ? "" : "disabled"}>${label}</button>`;

/** What each skill role is called on a card. */

export const signed = (n: number) => `${n > 0 ? "+" : ""}${n}`;

/** What each kind of stop is called. */
export const STOP_NAMES: Record<StopKind | Mission["kind"], string> = {
  battle: "Battle",
  supply: "Supply drop",
  cache: "Gear cache",
  shop: "Shop",
  safehouse: "Safehouse",
  unknown: "❓ Unknown",
  key: "Guardian",
  final: "The alien source",
  ambush: "Ambush",
  recovery: "Recovery",
};

/** A soldier's health as a red bar and a count, and the armor it starts each fight with as a yellow bar after it. */
export const healthBar = (hp: number, max: number, armor = 0) =>
  `<div class="health" title="HP ${hp} of ${max}${armor > 0 ? `, and ${armor} armor, which takes damage first and is whole again each fight` : ""}">♥ ${hp}/${max}${armor > 0 ? ` <span class="armor">⛨ ${armor}</span>` : ""}<div class="bar"><div style="width: ${(100 * hp) / (max + armor)}%"></div><div class="armor" style="left: ${(100 * max) / (max + armor)}%; width: ${(100 * armor) / (max + armor)}%"></div></div></div>`;

const BADGES: Record<ClassId, string> = {
  assault: "⚔️",
  heavy: "💪",
  sniper: "🎯",
  support: "✨",
  engineer: "🔧",
  pyro: "🔥",
  cryo: "❄️",
  phantom: "👻",
};

/** A class's badge; a hero with no class yet wears a cape. */
export const badge = (cls?: ClassId | null) => (cls ? BADGES[cls] : "🦸");

/** The threat bar. `landed` is how much of the newest threat animates in. */
export function threatBar(threat: number, landed = 0): string {
  const pct = (n: number) => `${(100 * n) / THREAT_MAX}%`;
  const meter = `<span class="threat" title="The hunt: the fuller the bar, the more aliens every battle has, up to ${Math.round(100 * TUNING.hunt)}% more. Full, it ambushes the party"><i style="width:${pct(threat - landed)}"></i><i class="landed" style="width:${pct(landed)}"></i></span>`;
  return `${meter}${threat === THREAT_MAX ? '<b class="up">ambush next</b>' : ""}`;
}

/** What each stat is called. */
export const STAT_NAMES: Record<keyof Stats, string> = {
  hp: "HP",
  armor: "Armor",
  damage: "Damage",
  range: "Range",
  move: "Move",
  crit: "Crit",
  strength: "Strength",
  jump: "Jump",
};

const percent = (n: number) => `${signed(Math.round(100 * n))}%`;

/** How each stat change reads on a piece of gear. */
const STAT_TEXT: Record<keyof Stats, (n: number) => string> = {
  hp: (n) => `${signed(n)} HP`,
  armor: (n) => `${signed(n)} armor`,
  damage: (n) => `${signed(n)} damage`,
  range: (n) => `${signed(n)} range`,
  move: (n) => `${signed(n)} move`,
  crit: (n) => `${percent(n)} crit`,
  strength: (n) => `${signed(n)} strength`,
  jump: (n) => `${signed(n)} jump`,
};

const statText = (stats: Partial<Stats>) =>
  (Object.keys(stats) as (keyof Stats)[])
    .map((key) => STAT_TEXT[key](stats[key]!))
    .join(", ");

/** A piece of gear's special, as plain text: its weapon's special and its effect. Its numbers are its type's tip. */
export function gearText(gear: Gear): string {
  const said = [
    WEAPONS[gear.weapon].special,
    gear.effect ? EFFECTS[gear.effect].text : "",
  ];
  return [...new Set(said.filter(Boolean))].map((line) => `${line}.`).join(" ");
}

const kitText = (kit: Kit) =>
  `${kit.shots} × ${Math.round(100 * kit.power)}% damage${kit.power > 1 ? ` of the first ${BASE_STATS.damage}, +1 per point past` : ""}${kit.wide ? `, ${Math.round(100 * kit.wide)}% splash beside` : ""}${kit.range ? `, range ${kit.range}` : ""}`;

/** A piece of gear's numbers: its weapon's attacks and stat changes, then its mod's. */
export function gearStats(gear: Gear): string[] {
  const w = WEAPONS[gear.weapon];
  return [
    `Attack: ${kitText(w.attack)}`,
    w.thrown && `Thrown: ${kitText(w.thrown)}`,
    w.rocket && `Rocket: ${kitText(w.rocket)}`,
    w.dash && `Dashes ${w.dash} tiles to strike`,
    statText(w.stats),
    Object.keys(gear.stats).length > 0 &&
      `${gear.name.split(" ")[0]}: ${statText(gear.stats)}`,
  ].filter((line): line is string => Boolean(line));
}

/** How a weapon attacks, in plain words. */
export function weaponDoes(gear: Gear): string {
  const w = WEAPONS[gear.weapon];
  const { shots, power, wide } = w.attack;
  const blow = w.melee ? "blow" : "shot";
  const range = w.stats.range ?? 0;
  return [
    shots === 1 ? `1 ${power >= 1.5 ? "heavy " : ""}${blow}` : `${shots} ${blow}s`,
    w.melee ? (w.dash ? "dashes in" : "melee") : range > 0 ? "long range" : range < 0 ? "short range" : "",
    wide && "splash",
    (w.thrown || w.rocket) && "throws when out of reach",
  ].filter(Boolean).join(" · ");
}

/** A piece of gear's name, its numbers shown on hover, focus or tap. */
export const gearName = (gear: Gear) =>
  `<span class="tip" ${markTip([gear.name, ...gearStats(gear)])}>${gear.name}</span>`;

/** Words that explain themselves on hover. */
const tip = (label: string, text: string) =>
  `<span class="tip" title="${text}">${label}</span>`;

/** A quantity's chip: its icon and name, lit if the squad makes it, explained on hover. */
const quantityChip = (q: Quantity, held = false) =>
  `<span class="kw ${q} ${held ? "held" : ""}" title="${QUANTITIES[q].name}: ${QUANTITIES[q].text}">${QUANTITIES[q].icon} ${QUANTITIES[q].name}</span>`;

/** A quantity something shrugs off: its icon struck through, explained on hover. */
export const resistChip = (q: Resist) =>
  `<span class="kw ${q} resist" title="Resists ${QUANTITIES[q].name}: ${RESISTS[q]}">${QUANTITIES[q].icon}</span>`;

/** A Guardian's exam: its icon, explained on hover with what answers it. */
export const examChip = (exam: Exam) =>
  `<span class="kw exam" title="${EXAMS[exam].name}: ${EXAMS[exam].text}. Answer: ${EXAMS[exam].answer}">${EXAMS[exam].icon} ${EXAMS[exam].name}</span>`;

/** The words in a description that name a quantity, and which; the first that fits wins. */
const QUANTITY_WORDS: [RegExp, Quantity][] = [
  [/past the kill|beyond what a kill needs/, "overkill"],
  [/burning|burns?/, "burn"],
  [/chilled|chills?|frozen|freezes?/, "chill"],
  [/marked|marks?/, "mark"],
  [/knock\w*|pull\w*|slides?|slid|moved|moving/, "moved"],
  [/into something|off a ledge/, "impact"],
  [/shots?/, "shots"],
  [/crits?/, "crit"],
  [/kills?/, "kill"],
  [/armor/, "armor"],
];
const QUANTITY_PATTERN = new RegExp(
  `\\b(${QUANTITY_WORDS.map(([re]) => re.source).join("|")})\\b`,
  "gi",
);
const quantityOf = (word: string) =>
  QUANTITY_WORDS.find(([re]) =>
    new RegExp(`^(${re.source})$`, "i").test(word),
  )![1];

/** The cancellations a flow's quantities take part in: those it bridges, and those whose half it makes. */
const cancelsOf = (flow: Flow & { bridge?: Cancel }): Cancel[] =>
  (Object.keys(CANCELS) as Cancel[]).filter(
    (id) => flow.bridge === id || !!flow.makes?.some((q) => (CANCELS[id].pair as readonly Quantity[]).includes(q)),
  );

/**
 * A description as Slay the Spire writes a card: each quantity in it coloured in place, lit if the squad makes it,
 * and on hover a box beside it defining every quantity it names, makes or reads, and each cancellation it is part of.
 */
export function describe(
  text: string,
  flow: Flow & { bridge?: Cancel } = {},
  held: Quantity[] = [],
): string {
  const named = new Set<Quantity>([...(flow.makes ?? []), ...(flow.reads ?? [])]);
  const rich = text.replace(QUANTITY_PATTERN, (word) => {
    const q = quantityOf(word);
    named.add(q);
    return `<span class="kwi ${q} ${held.includes(q) ? "held" : ""}">${QUANTITIES[q].icon}${word}</span>`;
  });
  const defs = [
    ...[...named].map(
      (q) =>
        `<span class="def"><b class="kwi ${q}">${QUANTITIES[q].icon} ${QUANTITIES[q].name}</b>${QUANTITIES[q].text}.</span>`,
    ),
    ...cancelsOf(flow).map(
      (id) =>
        `<span class="def cancel"><b>⚠ ${CANCELS[id].name}</b>${CANCELS[id].text}${flow.bridge === id ? "; this turns it into a payoff" : ""}.</span>`,
    ),
  ];
  // One span, so a flex card keeps the sentence on one line.
  return `<span>${rich}</span>${defs.length > 0 ? `<span class="defs">${defs.join("")}</span>` : ""}`;
}

/** Quantity chips; one the squad makes, in `held`, is lit. */
export const quantityChips = (qs: Quantity[] = [], held: Quantity[] = []) =>
  qs.length === 0
    ? ""
    : `<span class="keywords">${qs.map((q) => quantityChip(q, held.includes(q))).join("")}</span>`;

/** An alien kind's name, its rules on hover, and what it resists. */
export const alienName = (kind: AlienKind, label = ALIENS[kind].name) =>
  `${tip(label, ALIENS[kind].text)}${ALIENS[kind].resists.map(resistChip).join("")}`;

/** What a piece of gear does, its keywords coloured and defined. */
export const describeGear = (gear: Gear, held: Quantity[] = []) =>
  describe(gearText(gear), gear.effect ? EFFECTS[gear.effect] : {}, held);

/** A piece of gear as a card's contents: rarity, name and special. */
export function gearCard(gear: Gear, held: Quantity[] = []): string {
  return `<small>${gear.rarity}</small><br><b>${gearName(gear)}</b><br>${describeGear(gear, held)}`;
}
