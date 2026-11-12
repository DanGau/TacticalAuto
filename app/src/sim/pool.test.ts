import { describe, expect, it } from 'vitest'
import { threadsFor } from './pool'

describe('threadsFor', () => {
  it('starts no more processes than free memory holds beside the reserve', () => {
    expect(threadsFor(32, 3 * 1024)).toBe(3)
    expect(threadsFor(32, 64 * 1024)).toBe(31)
    expect(threadsFor(32, 512)).toBe(1)
  })
})
