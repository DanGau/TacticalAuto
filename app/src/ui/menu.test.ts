import { expect, test } from 'vitest'
import { createRun } from '../core/run'
import { recruitCard, recruitDossier } from './menu'

const run = createRun(1)
const hero = run.recruits[1]
const text = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ')

test('a recruit card names the hero, class, weapon and ability, and nothing more', () => {
  const card = recruitCard(run, hero, 1)
  expect(card).toContain('data-recruit="1"')
  for (const said of [hero.name, hero.gear!.name]) expect(text(card)).toContain(said)
  expect(card).not.toMatch(/HP|Bonus|Duos|statblock/)
})

test("a recruit's dossier tells home, numbers and bonus attack, and offers Back and Deploy", () => {
  const dossier = recruitDossier(run, 1)
  expect(text(dossier)).toContain(hero.home!.name)
  expect(dossier).toContain('statblock')
  expect(text(dossier)).toContain('Bonus attack')
  expect(dossier).toContain('data-back')
  expect(dossier).toContain('data-deploy="1"')
})
