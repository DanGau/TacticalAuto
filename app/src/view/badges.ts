// The stacks and counts a unit's token shows over its health: burn, chill, Might, kept armor, a combo, exposure, the next every-Nth.
import { CADENCE, FAULT, type Unit } from '../core/battle'
import { has } from '../core/fighters'

/** A badge: a short word and the colour of its pill. */
export interface Badge {
  text: string
  color: number
}

const BURN = 0xff7a1a
const CHILL = 0x7fd6ff
const MIGHT = 0xe8433a
const ARMOR = 0xf2c94c
const COUNT = 0xb8c0cc

/** What `unit` has built this battle, as badges; none for a unit with nothing. */
export function badges(unit: Unit): Badge[] {
  const out: Badge[] = []
  if (unit.burn > 0) out.push({ text: `🔥${unit.burn}`, color: BURN })
  if (unit.frozen) out.push({ text: 'ICE', color: CHILL })
  else if (unit.chill > 0) out.push({ text: `❄${unit.chill}`, color: CHILL })
  if (unit.might > 0) out.push({ text: `⚔${unit.might}`, color: MIGHT })
  if (unit.armor > unit.stats.armor && has(unit, 'lasting')) out.push({ text: `+${unit.armor - unit.stats.armor}`, color: ARMOR })
  if (unit.exposed > 0) out.push({ text: '!', color: MIGHT })
  if (unit.twice) out.push({ text: '×2', color: ARMOR })
  if (has(unit, 'combo') && unit.combo > 1) out.push({ text: `◎${Math.min(unit.combo, 9)}`, color: COUNT })
  if (has(unit, 'cadence')) out.push({ text: `${unit.hits % CADENCE}/${CADENCE}`, color: COUNT })
  if (has(unit, 'faultLine')) out.push({ text: `${unit.hits % FAULT.every}/${FAULT.every}`, color: COUNT })
  return out
}
