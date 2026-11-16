// Shared HTML pieces: buttons, bars, chips, gear cards and descriptions.
import { weaponIcon } from "./weapon-icons";
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
import { KEYWORDS } from "../core/keywords";

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
  supply: "Supply Drop",
  cache: "Gear Cache",
  shop: "Shop",
  safehouse: "Safehouse",
  unknown: "❓ Unknown",
  key: "Guardian",
  final: "Alien Source",
  ambush: "Ambush",
};

/** A soldier's health as a red bar and a count, and the armor it starts each fight with as a yellow bar after it. */
export const healthBar = (hp: number, max: number, armor = 0) =>
  `<div class="health" title="${hp} of ${max} HP${armor > 0 ? `. ${armor} Armor: takes damage before HP, restored at the start of each battle` : ""}">♥ ${hp}/${max}${armor > 0 ? ` <span class="armor">⛨ ${armor}</span>` : ""}<div class="bar"><div style="width: ${(100 * hp) / (max + armor)}%"></div><div class="armor" style="left: ${(100 * max) / (max + armor)}%; width: ${(100 * armor) / (max + armor)}%"></div></div></div>`;

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
  const meter = `<span class="threat" title="The hunt. As it fills, each battle has up to ${Math.round(100 * TUNING.hunt)}% more aliens. When full, the aliens ambush you."><i style="width:${pct(threat - landed)}"></i><i class="landed" style="width:${pct(landed)}"></i></span>`;
  return `${meter}${threat === THREAT_MAX ? '<b class="up">Ambush next</b>' : ""}`;
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
  armor: (n) => `${signed(n)} Armor`,
  damage: (n) => `${signed(n)} damage`,
  range: (n) => `${signed(n)} range`,
  move: (n) => `${signed(n)} move`,
  crit: (n) => `${percent(n)} Crit`,
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
  return [...new Set(said.filter((line): line is string => Boolean(line)))].map(sentence).join(" ");
}

const kitText = (kit: Kit) =>
  `${kit.shots} × ${Math.round(100 * kit.power)}% damage${kit.power > 1 ? ` of the first ${BASE_STATS.damage}, 1 more per point past` : ""}${kit.wide ? `, ${Math.round(100 * kit.wide)}% splash beside` : ""}${kit.range ? `, range ${kit.range}` : ""}`;

/** A piece of gear's numbers: its weapon's attacks and stat changes, then its mod's. */
export function gearStats(gear: Gear): string[] {
  const w = WEAPONS[gear.weapon];
  return [
    `Attack: ${kitText(w.attack)}`,
    w.thrown && `Thrown: ${kitText(w.thrown)}`,
    w.rocket && `Rocket: ${kitText(w.rocket)}`,
    w.dash && `Dash up to ${w.dash} tiles to strike`,
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
    (w.thrown || w.rocket) && "throws out of reach",
  ].filter(Boolean).join(" · ");
}

/** A piece of gear's name, its numbers shown on hover, focus or tap. */
export const gearName = (gear: Gear) =>
  `<span class="tip" ${markTip([gear.name, ...gearStats(gear)])}>${weaponIcon(gear.weapon)} ${gear.name}</span>`;

/** Words that explain themselves on hover. */
const tip = (label: string, text: string) =>
  `<span class="tip" title="${text}">${label}</span>`;

/** A quantity's chip: its icon and name, lit if the hero makes it, explained on hover. */
const quantityChip = (q: Quantity, held = false) =>
  `<span class="kw ${q} ${held ? "held" : ""}" title="${QUANTITIES[q].name}: ${QUANTITIES[q].text}">${QUANTITIES[q].icon} ${QUANTITIES[q].name}</span>`;

/** A quantity something shrugs off: its icon struck through, explained on hover. */
export const resistChip = (q: Resist) =>
  `<span class="kw ${q} resist" title="Resists ${QUANTITIES[q].name}: ${sentence(RESISTS[q])}">${QUANTITIES[q].icon}</span>`;

/** A Guardian's exam: its icon, explained on hover with what answers it. */
export const examChip = (exam: Exam) =>
  `<span class="kw exam" title="${EXAMS[exam].name}: ${sentence(EXAMS[exam].text)} Answer: ${sentence(EXAMS[exam].answer)}">${EXAMS[exam].icon} ${EXAMS[exam].name}</span>`;

/** Ends `text` in a full stop unless it has one. */
export const sentence = (text: string) => (/[.!?]$/.test(text.trim()) ? text.trim() : `${text.trim()}.`);

/** Each keyword's inflections as text writes them, beside its glossary name. */
const INFLECTIONS: Record<string, string[]> = {
  Burn: ["Burning", "Burns", "Burned"],
  Chill: ["Chilled", "Chills"],
  Freeze: ["Frozen", "Freezes"],
  Mark: ["Marked", "Marks"],
  Displace: ["Displaced", "Displacing", "Displaces"],
  Crit: ["Crits"],
  Kill: ["Kills"],
  Root: ["Rooted"],
  Stun: ["Stunned"],
  Panic: ["Panicked"],
  Surprise: ["Surprised"],
  Cloak: ["Cloaked"],
  Thaw: ["Thaws", "Thawed"],
  Quench: ["Quenched"],
};
/** Every keyword word to the glossary name it stands for. */
const KEYWORD_OF = new Map<string, string>(
  Object.keys(KEYWORDS).flatMap((name) => [[name, name], ...(INFLECTIONS[name] ?? []).map((w) => [w, name])] as [string, string][]),
);
const KEYWORD_PATTERN = new RegExp(
  `\\b(${[...KEYWORD_OF.keys()].sort((a, b) => b.length - a.length).join("|")})\\b`,
  "g",
);
/** Each quantity by its glossary name. */
const QUANTITY_OF = new Map(
  (Object.keys(QUANTITIES) as Quantity[]).map((q) => [QUANTITIES[q].name, q]),
);

/** The cancellations a flow's quantities take part in: those it bridges, and those whose half it makes. */
const cancelsOf = (flow: Flow & { bridge?: Cancel }): Cancel[] =>
  (Object.keys(CANCELS) as Cancel[]).filter(
    (id) => flow.bridge === id || !!flow.makes?.some((q) => (CANCELS[id].pair as readonly Quantity[]).includes(q)),
  );

/**
 * A description as Slay the Spire writes a card: each keyword in it bold and coloured in place, lit if the hero makes it,
 * and on hover a box beside it defining every keyword it names, makes or reads, and each cancellation it is part of.
 */
export function describe(
  text: string,
  flow: Flow & { bridge?: Cancel } = {},
  held: Quantity[] = [],
): string {
  const named = new Set<string>([...(flow.makes ?? []), ...(flow.reads ?? [])].map((q) => QUANTITIES[q].name));
  for (const id of cancelsOf(flow)) named.add(CANCELS[id].name);
  const rich = text.replace(KEYWORD_PATTERN, (word) => {
    const name = KEYWORD_OF.get(word)!;
    named.add(name);
    const q = QUANTITY_OF.get(name);
    return `<b class="kwi ${q ?? "term"} ${q && held.includes(q) ? "held" : ""}">${KEYWORDS[name].icon ?? ""}${word}</b>`;
  });
  const defs = [...named].map((name) => {
    const q = QUANTITY_OF.get(name);
    const cancel = Object.entries(CANCELS).find(([, c]) => c.name === name)?.[0] as Cancel | undefined;
    const kw = KEYWORDS[name];
    const head = `${kw.icon ? `${kw.icon} ` : ""}${name}`;
    return cancel
      ? `<span class="def cancel"><b>${head}</b>${kw.text}${flow.bridge === cancel ? " This relic turns it into a payoff." : ""}</span>`
      : `<span class="def"><b class="kwi ${q ?? "term"}">${head}</b>${kw.text}</span>`;
  });
  // One span, so a flex card keeps the sentence on one line.
  return `<span>${rich}</span>${defs.length > 0 ? `<span class="defs">${defs.join("")}</span>` : ""}`;
}

/** Quantity chips; one the hero makes, in `held`, is lit. */
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
