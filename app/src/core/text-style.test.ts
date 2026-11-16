// Game text follows docs/text-style.md, as far as a test can tell.
import { expect, test } from 'vitest'
import { CHALLENGES } from './challenges'
import { classPower, CLASSES } from './classes'
import { DOCTRINES } from './doctrines'
import { EVENTS } from './events'
import { EXAMS } from './exams'
import { FEATS } from './feats'
import { EFFECTS } from './gear'
import { GOALS } from './goals'
import { KEYWORDS } from './keywords'
import { RISKS } from './missions'
import { PERKS } from './perks'
import { RELICS } from './relics'
import { SECONDARIES, secondaryPower } from './secondaries'
import { SKILLS } from './skills'
import { TWISTS } from './twists'
import { boonText, UTILITY_IDS, UTILITIES } from './utilities'
import { WEAPONS } from './weapons'

/** What each effect text says, by where it comes from. */
const effects: [string, string][] = [
  ...Object.values(SKILLS).map((s): [string, string] => [s.name, s.text]),
  ...Object.values(CLASSES).flatMap((c): [string, string][] => [[c.abilityName, classPower(c, c.charges).text], [c.name, c.stanceText]]),
  ...Object.values(SECONDARIES).map((s): [string, string] => [secondaryPower(s).name, secondaryPower(s).text]),
  ...Object.values(PERKS).map((p): [string, string] => [p.name, p.text]),
  ...Object.values(RELICS).map((r): [string, string] => [r.name, r.text]),
  ...Object.values(EFFECTS).map((e): [string, string] => [e.prefix, e.text]),
  ...Object.values(DOCTRINES).map((d): [string, string] => [d.name, d.text]),
  ...UTILITY_IDS.map((id): [string, string] => [UTILITIES[id].name, boonText(id)]),
  ...Object.values(EVENTS).flatMap((e) => e.options.map((o): [string, string] => [e.name, o.text])),
  ...Object.values(GOALS).map((g): [string, string] => [g.name, g.text]),
  ...Object.values(RISKS).map((r): [string, string] => [r.name, r.text]),
  ...Object.values(CHALLENGES).map((c): [string, string] => [c.name, c.test]),
  ...Object.values(TWISTS).map((t): [string, string] => [t.name, t.text]),
  ...Object.values(EXAMS).map((e): [string, string] => [e.name, e.text]),
  ...Object.values(FEATS).map((f): [string, string] => [f.name, f.text]),
  ...Object.entries(KEYWORDS).map(([name, k]): [string, string] => [name, k.text]),
]

const names = [
  ...effects.map(([name]) => name),
  ...Object.values(WEAPONS).map((w) => w.name),
  ...Object.values(EVENTS).map((e) => e.name),
]

/** Keywords text names only capitalized; kill, shots and hurt read as plain words. */
const KEYWORD_FORMS: Record<string, string> = {
  Burn: 'burn|burns|burning|burned',
  Chill: 'chill|chills|chilled|chilling',
  Freeze: 'freeze|freezes|frozen',
  Mark: 'mark|marks|marked',
  Displace: 'displace|displaces|displaced',
  Crit: 'crit|crits',
  Overkill: 'overkill',
  Armor: 'armor',
  Root: 'root|roots|rooted',
  Stun: 'stun|stuns|stunned',
  Numb: 'numb',
  Weak: 'weak|weakened|weakens|weaken',
  Might: 'might',
  Panic: 'panic|panics|panicked',
  Surprise: 'surprised',
  Cloak: 'cloak|cloaks|cloaked',
}

/** Hedges, lore and ways of speaking the style drops. */
const BANNED = /\b(may|maybe|perhaps|some|somewhat|a little|a lot|harder|stronger|faster|tries to|heroes|an ally sees|one|two|three|four|five|six|seven|eight|nine|ten|twice|thrice|(once|twice) per battle)\b/i

test('every effect is whole sentences, each capitalized and ending in a full stop', () => {
  const bad = effects.filter(([, text]) => !/^[A-Z0-9"']/.test(text) || !/[.!]$/.test(text))
  expect(bad).toEqual([])
})

test('no effect hedges, tells lore, or spells a number', () => {
  expect(effects.filter(([, text]) => BANNED.test(text))).toEqual([])
})

test('amounts are stated, never "+N"', () => {
  expect(effects.filter(([, text]) => /(^|\s)\+\d/.test(text))).toEqual([])
  // "more" and "less" of a stat carry a number.
  expect(effects.filter(([, text]) => /(?<!\d%?\s)\b(more|less) (damage|move|range|HP|armor)\b/i.test(text))).toEqual([])
})

test('keywords are capitalized and defined in the glossary', () => {
  for (const keyword of Object.keys(KEYWORD_FORMS)) expect(KEYWORDS[keyword], keyword).toBeDefined()
  const lower = new RegExp(`\\b(${Object.values(KEYWORD_FORMS).join('|')})\\b`)
  expect(effects.filter(([, text]) => lower.test(text))).toEqual([])
})

test('names are 1 to 3 words in Title Case', () => {
  const small = /^(of|the|a|an|and|in|on|to)$/
  expect(names.filter((name) => name.split(' ').length > 3 || name.split(' ').some((w, i) => !/^[A-Z0-9]/.test(w) && !(i > 0 && small.test(w))))).toEqual([])
})
