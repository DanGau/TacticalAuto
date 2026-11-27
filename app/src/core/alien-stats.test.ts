import { expect, test } from 'vitest'
import { ALIENS, alienStats, type AlienKind } from './aliens'

test('every alien kind that attacks deals damage at the default tuning', () => {
  for (const kind of Object.keys(ALIENS) as AlienKind[]) expect(alienStats(kind, 0, 0).damage, kind).toBeGreaterThanOrEqual(1)
})
