// The battle log: a line per action, collapsed by default, each naming who acted, with what, and to whom.
import { ALIENS } from '../core/aliens'
import type { Battle } from '../core/battle'
import { CLASSES, type ClassId } from '../core/classes'
import type { GameEvent } from '../core/combat-event'
import type { Run } from '../core/run-state'
import { sourceName } from '../core/source-names'
import type { Src } from '../core/sources'
import { pathOf, SKILLS, TREES, treeOf } from '../core/skills'
import { WEAPONS } from '../core/weapons'
import { tag } from './kit'

/** Who each unit is, by id: a hero's name, else its kind's; kept past its death. */
export type Names = Map<number, string>

/** What a source belongs to, in brackets after its name: a skill's path, a class power's class, a weapon's type. */
function context(run: Run, src: Src, actor: number | undefined, battle: Battle): string {
  const soldier = run.soldiers.find((s) => s.id === battle.units.find((u) => u.id === actor)?.soldier)
  if (src.kind === 'skill') {
    for (const cls of [...(soldier?.cls ? [soldier.cls] : []), ...(Object.keys(TREES) as ClassId[])]) {
      const id = treeOf(cls).find((id) => SKILLS[id].effect === src.id || id === src.id)
      const path = id && pathOf(cls, id)
      if (path) return path.name
    }
    return ''
  }
  if (src.kind === 'class') return soldier?.cls ? CLASSES[soldier.cls].name : ''
  if (src.kind === 'weapon') return WEAPONS[soldier?.gear?.weapon ?? (src.id as keyof typeof WEAPONS)]?.type ?? ''
  return ''
}

/** What an event did, after its source: damage or healing and to whom. */
function outcome(e: GameEvent, names: Names): string {
  const to = (id: number) => names.get(id) ?? '?'
  switch (e.type) {
    case 'shot':
      return `${e.damage} dmg${e.crit ? ' crit' : ''} → ${to(e.target)}`
    case 'heal':
      return `+${e.amount} → ${to(e.target)}`
    case 'effect':
      return `${e.amount > 0 ? `+${e.amount}` : e.amount < 0 ? `${-e.amount} dmg` : ''} → ${to(e.id)}`
    case 'rocket':
    case 'throw':
      return e.hits.length === 0 ? '' : `${e.hits.reduce((sum, h) => sum + h.damage, 0)} dmg → ${e.hits.map((h) => to(h.target)).join(', ')}`
    case 'spit':
      return `${e.damage} dmg → ${to(e.target)}`
    case 'panic':
      return `→ ${to(e.target)}`
    case 'feed':
      return `+${e.damage} dmg`
    default:
      return ''
  }
}

/** One event's log line, or null for one not worth a line: a plain walk or standing order. */
export function logLine(run: Run, battle: Battle, names: Names, e: GameEvent): string | null {
  if (!('src' in e) || ((e.type === 'move' || e.type === 'order') && e.src.kind === 'basic')) return null
  // An effect's id is the unit it acts on; its doer is unknown.
  const actor = e.type === 'effect' || e.type === 'used' || e.type === 'duo' ? undefined : e.id
  const kit = { skills: run.soldiers.flatMap((s) => s.skills), weapons: run.soldiers.flatMap((s) => s.gear?.weapon ?? []) }
  const ctx = context(run, e.src, actor ?? (e.type === 'effect' ? e.id : undefined), battle)
  const who = e.type === 'duo' ? e.ids.map((id) => names.get(id)).join(' + ') : actor !== undefined && actor >= 0 ? names.get(actor) : ''
  const what = `${tag(e.src.kind, sourceName(e.src, kit))}${ctx ? ` <small>(${ctx})</small>` : ''}`
  return [who, what, outcome(e, names)].filter(Boolean).join(' · ')
}

/** Learns the names of the battle's units. */
export function learnNames(run: Run, battle: Battle, names: Names): void {
  for (const u of battle.units) names.set(u.id, u.soldier !== null ? (run.soldiers.find((s) => s.id === u.soldier)?.name ?? 'Hero') : u.kind ? ALIENS[u.kind].name : u.civilian ? 'Civilian' : 'Mech')
}

/** The log panel, collapsed by default; it starts over each battle and shows only in one. */
export function createLog(): { add(run: Run, events: GameEvent[]): void } {
  const panel = document.createElement('details')
  panel.id = 'log'
  panel.innerHTML = '<summary>Log</summary><ol></ol>'
  document.body.append(panel)
  const list = panel.querySelector('ol')!
  const names: Names = new Map()
  let shown: Battle | null = null
  return {
    add(run, events) {
      const battle = run.battle
      panel.hidden = run.phase !== 'battle' || !battle || battle.phase === 'deploy'
      if (!battle) return
      if (battle !== shown) {
        shown = battle
        names.clear()
        list.innerHTML = ''
      }
      learnNames(run, battle, names)
      const lines = events.flatMap((e) => logLine(run, battle, names, e) ?? [])
      list.insertAdjacentHTML('beforeend', lines.map((line) => `<li>${line}</li>`).join(''))
      while (list.children.length > 300) list.firstElementChild!.remove()
      if (lines.length > 0) list.scrollTop = list.scrollHeight
    },
  }
}
