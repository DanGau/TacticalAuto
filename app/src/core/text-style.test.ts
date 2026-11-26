// Game text follows docs/text-style.md, as far as a test can tell.
import { expect, test } from 'vitest'
import { CHALLENGES } from './challenges'
import { DOCTRINES } from './doctrines'
import { EVENTS } from './events'
import { EXAMS } from './exams'
import { EFFECTS } from './gear'
import { GOALS } from './goals'
import { KEYWORDS } from './keywords'
import { RISKS } from './missions'
import { RELICS } from './relics'
import { TWISTS } from './twists'
import { cardText, CARD_IDS, CARDS } from './cards'
import { WEAPONS } from './weapons'
import { ALIENS } from './aliens'
import { ARENA_KINDS } from './arena-kinds'
import { QUANTITIES, RESISTS, type Resist } from './quantities'
import { describe } from '../ui/html'

/** What each effect text says, by where it comes from. */
const effects: [string, string][] = [
  ...Object.values(RELICS).map((r): [string, string] => [r.name, r.text]),
  ...Object.values(EFFECTS).map((e): [string, string] => [e.prefix, e.text]),
  ...Object.values(DOCTRINES).map((d): [string, string] => [d.name, d.text]),
  ...CARD_IDS.map((id): [string, string] => [CARDS[id].name, cardText(id)]),
  ...Object.values(EVENTS).flatMap((e) => e.options.map((o): [string, string] => [e.name, o.text])),
  ...Object.values(GOALS).map((g): [string, string] => [g.name, g.text]),
  ...Object.values(RISKS).map((r): [string, string] => [r.name, r.text]),
  ...Object.values(CHALLENGES).map((c): [string, string] => [c.name, c.test]),
  ...Object.values(TWISTS).map((t): [string, string] => [t.name, t.text]),
  ...Object.values(EXAMS).map((e): [string, string] => [e.name, e.text]),
  ...Object.entries(KEYWORDS).map(([name, k]): [string, string] => [name, k.text]),
  ...Object.values(ALIENS).map((a): [string, string] => [a.name, a.text]),
  ...Object.values(ARENA_KINDS).map((k): [string, string] => [k.name, k.text]),
  ...Object.entries(RESISTS).map(([q, text]): [string, string] => [QUANTITIES[q as Resist].name, text]),
]

const names = [
  ...effects.map(([name]) => name),
  ...Object.values(WEAPONS).map((w) => w.name),
  ...Object.values(EVENTS).map((e) => e.name),
]

/** Keywords by the lowercase forms text must not use: those words read as the keyword, so always capitalized. */
const KEYWORD_FORMS: Record<string, string> = {
  Burn: 'burn|burns|burning|burned',
  Chill: 'chill|chills|chilled|chilling',
  Freeze: 'freeze|freezes|frozen',
  Mark: 'mark|marks|marked',
  Displace: 'displace|displaces|displaced|displacing',
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
  Knockback: 'knockback|knock back|knocks back|knocked back',
  Parry: 'parry|parries',
  Retreat: 'retreat|retreats',
  Consume: 'consume|consumes|consumed|consuming',
  Thorns: 'thorns',
  Impact: 'impact',
}

/** Hedges, lore, spelled numbers, and the wordy forms the terse style replaced. */
const BANNED = /\b(may|maybe|perhaps|some|somewhat|a little|a lot|harder|stronger|faster|tries to|heroes|one|two|three|four|five|six|seven|eight|nine|ten|twice|thrice|beside|whenever you hit|whenever you kill|whenever you crit|whenever you are hit|whenever an alien hits you|at the start of your turn|at the start of each battle|times your|times the)\b/i

/** The longest an effect may run. */
const MAX_LENGTH = 130

test('every effect is whole sentences or fragments, each capitalized and ending in a full stop', () => {
  const bad = effects.filter(([, text]) => !/^[A-Z0-9"']/.test(text) || !/[.!]$/.test(text))
  expect(bad).toEqual([])
})

test('no effect hedges, tells lore, spells a number, or uses a replaced form', () => {
  expect(effects.filter(([, text]) => BANNED.test(text))).toEqual([])
})

test(`no effect runs past ${MAX_LENGTH} characters`, () => {
  expect(effects.filter(([, text]) => text.length > MAX_LENGTH)).toEqual([])
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

test('what text applies, gains or triggers on is a glossary keyword', () => {
  const named = /\b(?:[Aa]pply|[Gg]ain|On) (?:\d+ )?([A-Z][a-z]+(?: HP)?)\b/g
  // Triggers and stats that read as plain words.
  const plain = new Set(['HP', 'Kill', 'Hit'])
  const bad = effects.flatMap(([name, text]) => [...text.matchAll(named)].map((m) => m[1]).filter((w) => !plain.has(w) && !KEYWORDS[w]).map((w) => `${name}: ${w}`))
  expect(bad).toEqual([])
})

test('each keyword in an effect renders bold, with its definition on hover', () => {
  const bad = effects.filter(([, text]) => {
    const [rich, defs = ''] = describe(text).split('<span class="defs">')
    const bolded = [...rich.matchAll(/<b class="kwi[^>]*>[^<]*?([A-Za-z][A-Za-z ]*)<\/b>/g)].map((m) => m[1])
    const loose = rich.replace(/<b class="kwi[^>]*>[^<]*<\/b>/g, '')
    return Object.keys(KEYWORDS).some((k) => new RegExp(`\\b${k}\\b`).test(loose)) || (bolded.length > 0 && !defs.includes('class="def'))
  })
  expect(bad).toEqual([])
})

test('names are 1 to 3 words in Title Case', () => {
  const small = /^(of|the|a|an|and|in|on|to)$/
  expect(names.filter((name) => name.split(' ').length > 3 || name.split(' ').some((w, i) => !/^[A-Z0-9]/.test(w) && !(i > 0 && small.test(w))))).toEqual([])
})
