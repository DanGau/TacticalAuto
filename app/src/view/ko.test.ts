import { describe, expect, it } from 'vitest'
import type { Sprite } from 'three'
import { burst } from './ko'

describe('burst', () => {
  it('is depth-tested against the terrain, never drawn over it', () => {
    const { node, frame } = burst({ x: 0, y: 0, z: 0 }, 0xff0000, 7)
    frame(0.5)
    expect(node.children.length).toBeGreaterThan(0)
    for (const child of node.children) {
      expect((child as Sprite).material.depthTest).toBe(true)
      expect(child.renderOrder).toBe(0)
    }
  })
})
