import { expect, test } from 'vitest'
import { createRun } from '../core/run'
import { candidateCard, candidateDossier } from './menu'

const run = createRun(1)
const hero = run.candidates[1]
const text = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ')

test('a candidate card names the hero, class, weapon and ability, and nothing more', () => {
  const card = candidateCard( hero, 1)
  expect(card).toContain('data-candidate="1"')
  for (const said of [hero.name, hero.gear!.name]) expect(text(card)).toContain(said)
  expect(card).not.toMatch(/HP|Bonus|statblock/)
})

test("a candidate's dossier tells home, numbers and class card, and offers Back and Deploy", () => {
  const dossier = candidateDossier(run, 1)
  expect(text(dossier)).toContain(hero.home.name)
  expect(dossier).toContain('statblock')
  expect(text(dossier)).toContain('Class card')
  expect(dossier).toContain('data-back')
  expect(dossier).toContain('data-deploy="1"')
})
