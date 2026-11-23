// The clean comparison: at each deploy screen of a run, the same battle played from there with each card of the hand, plain and fused.
import { apply, type Action } from '../core/apply'
import { CHALLENGES, type ChallengeId } from '../core/challenges'
import { type Run } from '../core/run-state'
import { health } from '../core/hero'
import { step } from '../core/step'
import { CARDS, type CardId } from '../core/cards'
import { ARENA_KINDS, type ArenaKind } from '../core/arena-kinds'

/** One battle played on from a deploy screen with one card: whether it was the bot's play, whether it won, and the share of the hero's most health lost. */
export interface Fork {
  /** Which deploy screen it forks from, unique over a batch. */
  screen: string
  challenge: ChallengeId | null
  ground: ArenaKind
  leg: number
  card: CardId
  fused: boolean
  /** Whether the bot played this card this way. */
  chosen: boolean
  won: boolean
  lost: number
}

function playOn(run: Run, card: number, fuse: boolean): Pick<Fork, 'won' | 'lost'> {
  const fork = structuredClone(run)
  apply(fork, { type: 'enter', card, fuse })
  const before = health(fork, fork.hero)
  while (fork.phase === 'battle') step(fork)
  const fought = fork.report!.hero!
  return { won: fork.report!.won, lost: (before - fought.hp) / fought.maxHp }
}

/** The battle at this deploy screen played with each card of the hand, plain and, with another in hand, fused; the run is left as it was. */
export function forksOf(run: Run, taken: Action, screen: string): Fork[] {
  if (taken.type !== 'enter') return []
  const at = { screen, challenge: run.battle!.challenge, ground: run.battle!.arenaKind, leg: run.keys }
  return run.hand.flatMap((d, i) =>
    (run.hand.length > 1 ? [false, true] : [false]).map((fuse) => ({ ...at, card: run.deck[d].id, fused: fuse, chosen: taken.card === i && taken.fuse === fuse, ...playOn(run, i, fuse) })),
  )
}

/** `of` in groups by `key`, in order of first appearance. */
function group<T>(of: T[], key: (t: T) => string): T[][] {
  const groups = new Map<string, T[]>()
  for (const t of of) groups.set(key(t), [...(groups.get(key(t)) ?? []), t])
  return [...groups.values()]
}

/** Each deploy screen's forks, by screen. */
const screens = (forks: Fork[]) => group(forks, (f) => f.screen)

/** Better first: won, then less health lost. */
const order = (a: Fork, b: Fork) => Number(b.won) - Number(a.won) || a.lost - b.lost

/** The best and worst plain play of a screen, the bot's, and the best fused. */
function plays(of: Fork[]): { best: Fork; worst: Fork; bot: Fork | undefined; fused: Fork | undefined } {
  const plain = of.filter((f) => !f.fused).sort(order)
  return { best: plain[0], worst: plain.at(-1)!, bot: of.find((f) => f.chosen), fused: of.filter((f) => f.fused).sort(order)[0] }
}

const cell = (of: (Fork | undefined)[]) => {
  const got = of.filter((f): f is Fork => !!f)
  return (got.length === 0 ? '-' : `${Math.round((100 * got.filter((f) => f.won).length) / got.length)}/${Math.round((100 * got.reduce((sum, f) => sum + f.lost, 0)) / got.length)}`).padEnd(9)
}

/** What a row of screens says: how many, then wins/health lost with the best card of the hand, the worst, the bot's play, and the best fused. */
const line = (label: string, of: Fork[][]) => {
  const p = of.map(plays)
  return `${label.padEnd(18)}${String(of.length).padStart(6)}  ${cell(p.map((x) => x.best))}${cell(p.map((x) => x.worst))}${cell(p.map((x) => x.bot))}${cell(p.map((x) => x.fused))}`
}

/**
 * Wins/health lost in percent at each deploy screen with the best card of the hand, the worst, the bot's play, and the
 * best fused: overall, by leg, by challenge and by ground with a feature; then by card, how it does against its hands.
 */
export function formatForks(forks: Fork[]): string {
  const all = screens(forks)
  const lines = [`${'screens'.padEnd(18)}     n  best     worst    bot      fused`, line('all', all)]
  for (const leg of [0, 1, 2, 3]) lines.push(line(`leg ${leg + 1}`, all.filter((s) => s[0].leg === leg)))
  for (const challenge of Object.keys(CHALLENGES) as ChallengeId[]) lines.push(line(CHALLENGES[challenge].name, all.filter((s) => s[0].challenge === challenge)))
  for (const ground of (Object.keys(ARENA_KINDS) as ArenaKind[]).filter((k) => ARENA_KINDS[k].reads.length > 0)) lines.push(line(ARENA_KINDS[ground].name, all.filter((s) => s[0].ground === ground)))
  return [...lines.filter((l) => !/\s0  -/.test(l)), '', formatCards(all)].join('\n')
}

/** By card: hands it was dealt in, wins and health lost played plain, and how far each sits from its hand's mean, most winning first. */
function formatCards(all: Fork[][]): string {
  const played = all.flatMap((s) => {
    const plain = s.filter((f) => !f.fused)
    const mean = (v: (f: Fork) => number) => plain.reduce((sum, f) => sum + v(f), 0) / plain.length
    return plain.map((f) => ({ f, won: Number(f.won) - mean((g) => Number(g.won)), lost: f.lost - mean((g) => g.lost) }))
  })
  const rows = group(played, (r) => r.f.card).map((of) => {
    const avg = (v: (r: (typeof of)[number]) => number) => of.reduce((sum, r) => sum + v(r), 0) / of.length
    return { card: of[0].f.card, n: of.length, won: avg((r) => Number(r.f.won)), lost: avg((r) => r.f.lost), dWon: avg((r) => r.won), dLost: avg((r) => r.lost) }
  })
  const pct = (x: number, sign = false) => `${sign && x >= 0 ? '+' : ''}${Math.round(100 * x)}`.padStart(5)
  return ['card                    hands   won  lost  vs hand: won  lost', ...rows.sort((a, b) => b.dWon - a.dWon || a.dLost - b.dLost).map((r) => `${CARDS[r.card].name.padEnd(22)}${String(r.n).padStart(7)}${pct(r.won)}${pct(r.lost)}${pct(r.dWon, true).padStart(14)}${pct(r.dLost, true)}`)].join('\n')
}

/** Of every deploy screen, by challenge or ground and leg: the screens, and wins/health lost with the best card in hand, the worst and the bot's play. */
export interface Row {
  test: ChallengeId | ArenaKind
  leg: number
  screens: number
  best: { won: number; lost: number }
  worst: { won: number; lost: number }
  bot: { won: number; lost: number }
}

/** The rows of the diagnosis: each challenge, and each ground with a feature fought with no challenge, by leg. */
export function rows(forks: Fork[]): Row[] {
  const all = screens(forks)
  const tests: [Row['test'], (s: Fork[]) => boolean][] = [
    ...(Object.keys(CHALLENGES) as ChallengeId[]).map((c): [Row['test'], (s: Fork[]) => boolean] => [c, (s) => s[0].challenge === c]),
    ...(Object.keys(ARENA_KINDS) as ArenaKind[]).filter((k) => ARENA_KINDS[k].reads.length > 0).map((g): [Row['test'], (s: Fork[]) => boolean] => [g, (s) => s[0].ground === g && !s[0].challenge]),
  ]
  const score = (of: (Fork | undefined)[]) => {
    const got = of.filter((f): f is Fork => !!f)
    return { won: Math.round((100 * got.filter((f) => f.won).length) / Math.max(1, got.length)), lost: Math.round((100 * got.reduce((sum, f) => sum + f.lost, 0)) / Math.max(1, got.length)) }
  }
  return tests.flatMap(([test, met]) =>
    [0, 1, 2, 3].flatMap((leg): Row[] => {
      const of = all.filter((s) => met(s) && s[0].leg === leg).map(plays)
      return of.length === 0 ? [] : [{ test, leg, screens: of.length, best: score(of.map((p) => p.best)), worst: score(of.map((p) => p.worst)), bot: score(of.map((p) => p.bot)) }]
    }),
  )
}
