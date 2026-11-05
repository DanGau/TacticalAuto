// Charts for the stats screens. Each mark is focusable and carries its exact numbers in `data-tip`, which tip.ts shows.

/** One hero's colour per place in the run's roll, cycling past six. */
export const HERO_COLOURS = ['#5aa9e6', '#f4a259', '#8bd17c', '#e56b9f', '#b48ef0', '#f2d45c']
export const heroColour = (index: number) => HERO_COLOURS[index % HERO_COLOURS.length]

/** A value to chart: its label (HTML), colour, and the lines its tip tells. */
export type Mark = { label: string; value: number; colour: string; tip: string[] }

/** Each value as a percent of the largest, or of the sum with `of: 'sum'`; all 0 when there is nothing. */
export function scale(values: number[], of: 'max' | 'sum' = 'max'): number[] {
  const whole = of === 'max' ? Math.max(0, ...values) : values.reduce((a, b) => a + b, 0)
  return values.map((v) => (whole > 0 ? (100 * v) / whole : 0))
}

const attr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
/** Attributes making an element a focusable mark that tells `lines`. */
export const tip = (lines: string[]) => `tabindex="0" data-tip="${attr(lines.join('\n'))}" aria-label="${attr(lines.join('. '))}"`

/** A thin strip of each mark's share of the total. */
export function strip(marks: Mark[]): string {
  const pct = scale(marks.map((m) => m.value), 'sum')
  return `<div class="strip-share">${marks.map((m, i) => (pct[i] > 0 ? `<i style="width:${pct[i]}%;background:${m.colour}" ${tip(m.tip)}></i>` : '')).join('')}</div>`
}

/** A titled card: the total, the share strip, and a bar per mark against the largest. */
export function barCard(title: string, marks: Mark[]): string {
  const total = marks.reduce((sum, m) => sum + m.value, 0)
  const pct = scale(marks.map((m) => m.value))
  const bars = marks.map((m, i) => `<div class="hbar" ${tip(m.tip)}><span>${m.label}</span><span class="track"><i style="width:${pct[i]}%;background:${m.colour}"></i></span><b>${m.value}</b></div>`)
  return `<div class="chart"><h4>${title} <b>${total}</b></h4>${strip(marks)}${bars.join('')}</div>`
}

/** A column per entry: stacked marks above the line, one value below it, both on one scale. */
export type Column = { label: string; up: Mark[]; down: number; look: string; tip: string[] }

export function columns(cols: Column[], downColour: string): string {
  const upMax = Math.max(1, ...cols.map((c) => c.up.reduce((sum, m) => sum + m.value, 0)))
  const downMax = Math.max(1, ...cols.map((c) => c.down))
  const col = (c: Column) => `<div class="col ${c.look}" ${tip(c.tip)}>
    <span class="up" style="flex:${upMax}">${c.up.map((m) => `<i style="height:${(100 * m.value) / upMax}%;background:${m.colour}"></i>`).join('')}</span>
    <span class="down" style="flex:${downMax}"><i style="height:${(100 * c.down) / downMax}%;background:${downColour}"></i></span>
    <small>${c.label}</small></div>`
  return `<div class="columns">${cols.map(col).join('')}</div>`
}
