import { expect, it } from 'vitest'
import { ALIENS } from './aliens'
import { CHALLENGES } from './challenges'
import { classPower, CLASSES } from './classes'
import { DOCTRINES } from './doctrines'
import { EVENTS } from './events'
import { FEATS } from './feats'
import { GOALS } from './goals'
import { EFFECTS } from './gear'
import { CANCELS, QUANTITIES } from './quantities'
import { usage } from './powers'
import { RELICS } from './relics'
import { SECONDARIES, secondaryPower } from './secondaries'
import { SKILLS } from './skills'
import { TWISTS } from './twists'
import { UTILITIES } from './utilities'
import { WEAPONS } from './weapons'

/** About two lines of a card, so every power can be read at a glance. */
const LONGEST = 110

const powers = [...Object.values(SKILLS), ...Object.values(CLASSES).map((c) => classPower(c, c.charges)), ...Object.values(SECONDARIES).map(secondaryPower)]

it('states every power in a usage line and at most two lines of effect', () => {
  for (const power of powers) {
    expect(usage(power), power.name).toBeTruthy()
    expect(power.text.length, power.name).toBeLessThanOrEqual(LONGEST)
    expect(power.text, power.name).not.toMatch(/(once|twice) per battle/i)
  }
})

it('speaks of heroes and a party, never soldiers and squads', () => {
  const told = JSON.stringify([ALIENS, CHALLENGES, CLASSES, DOCTRINES, EVENTS, FEATS, GOALS, EFFECTS, QUANTITIES, CANCELS, RELICS, SECONDARIES, SKILLS, TWISTS, UTILITIES, WEAPONS])
  expect(told).not.toMatch(/\b(soldiers?|squads?|squadmates?|grenades?|AIM\?)\b/i)
})
