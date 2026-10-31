// The squad's entrance on screen, as a film would cut to it: the door kicked in, the wall smashed, the monologue, the tap on the shoulder.
import { type Battle, type Tile, type Unit } from '../core/battle'
import { nearestAlien } from '../core/grid'
import { drawTerrain } from './board'
import { callout, drawing, float } from './effects'
import { COLOR } from './palette'
import type { Sketch } from './shapes'
import { fade, place, shift, squash } from './sprites'
import type { Sprite, Stage } from './stage'

/** The gap between soldiers coming in, how long a dash in takes, and from how many tiles back. */
const STAGGER_MS = 140
const DASH_MS = 420
const DASH_FROM = 3
/** How long a fall from above takes, and from how high, in world pixels. */
const FALL_MS = 450
const FALL_FROM = 320
/** How long debris flies, and the monologue holds. */
const DEBRIS_MS = 600
const LINE_MS = 1600
/** How long a tap, an alien's turning round, and a comic pause take. */
const TAP_MS = 220
const TURN_MS = 260
const BEAT_MS = 600
const SHOT_MS = 160

/** What a hero says landing among the aliens. */
const TAUNTS = ['You picked the wrong city.', 'Hey, ugly! Over here!', 'Leave the humans alone.', 'This planet is protected.', 'Nobody invades on my watch.']

/**
 * The entrance the squad made: the camera cuts close on where it comes in and the alien it faces, the entrance
 * plays, and the squad stands ready. An ambush has none to play.
 */
export async function makeEntrance(s: Stage, battle: Battle): Promise<void> {
  const entrance = battle.entered
  const soldiers = battle.units.filter((u) => u.side === 'human' && !u.civilian)
  if (!entrance || soldiers.length === 0) return
  const foe = nearestAlien(battle, entrance.at)
  for (const unit of soldiers) fade(s.sprites.get(unit.id)!, 0)
  await s.follow([...soldiers.map((u) => ({ x: u.x, y: u.y })), ...(foe ? [{ x: foe.x, y: foe.y }] : [])], 600)
  // From the side away from the aliens.
  const back = foe ? unitAway(entrance.at, foe) : { x: 0, y: 1 }
  const sprites = soldiers.map((u) => s.sprites.get(u.id)!)
  const at = s.toWorld(entrance.at.x, entrance.at.y)
  const toward = foe ? s.toWorld(foe.x, foe.y) : at
  switch (entrance.kind) {
    case 'door':
      await Promise.all([drawing(s, (fx) => door(s, fx, at, toward)), dashIn(s, sprites, back, 120)])
      break
    case 'wall':
      shake(s, 6, 500)
      await Promise.all([drawing(s, (fx) => debris(s, fx, at, 0xa0522d, 14)), dashIn(s, sprites, back, 0)])
      drawTerrain(s, battle)
      break
    case 'monologue':
      await fallIn(s, sprites, (fx, sprite, t) => crack(fx, sprite.at, t))
      await monologue(s, battle, soldiers)
      break
    case 'skylight':
      await fallIn(s, sprites, (fx, sprite, t) => glass(fx, sprite.at, t))
      break
    case 'rappel':
      await rappel(s, sprites)
      break
    case 'smoke':
      await Promise.all([drawing(s, (fx) => smoke(s, fx, at)), emerge(s, sprites, back)])
      break
    case 'truck':
      await drawing(s, (fx) => truck(s, fx, at, back))
      drawTerrain(s, battle)
      await dashIn(s, sprites, back, 0)
      break
    case 'strike':
      await strike(s, battle, foe)
      await dashIn(s, sprites, back, 0)
      break
    case 'tap':
      await tap(s, soldiers, foe)
      break
    case 'look':
      await dashIn(s, sprites, back, 0)
      await look(s, battle, soldiers, foe)
      break
    case 'blast':
      await bigExplosion(s, soldiers, sprites, at, back)
      break
    case 'han':
      await dashIn(s, sprites, back, 0)
      await shootFirst(s, soldiers, foe)
      break
    case 'mine':
      await dashIn(s, sprites, back, 0)
      await stolenKill(s, soldiers, foe)
  }
  for (const sprite of sprites) {
    place(s, sprite, sprite.tile)
    fade(sprite, 1)
  }
}

/** A unit step from `foe` toward `at`. */
function unitAway(at: Tile, foe: Tile): Tile {
  const len = Math.hypot(at.x - foe.x, at.y - foe.y) || 1
  return { x: (at.x - foe.x) / len, y: (at.y - foe.y) / len }
}

/** Shakes the picture `px` pixels, dying away over `ms`. */
function shake(s: Stage, px: number, ms: number): void {
  void s
    .tween(ms, (t) => {
      s.jolt.x = Math.sin(t * 70) * px * (1 - t)
      s.jolt.y = Math.cos(t * 55) * px * 0.5 * (1 - t)
    })
    .then(() => Object.assign(s.jolt, { x: 0, y: 0 }))
}

/** Each soldier dashes in from DASH_FROM tiles back, one after another, after `delay`. */
async function dashIn(s: Stage, sprites: Sprite[], back: Tile, delay: number): Promise<void> {
  await Promise.all(
    sprites.map(async (sprite, i) => {
      const home = sprite.tile
      const from = { x: home.x + back.x * DASH_FROM, y: home.y + back.y * DASH_FROM }
      await s.tween(delay + i * STAGGER_MS, () => {})
      await s.tween(DASH_MS, (t) => {
        const e = 1 - (1 - t) * (1 - t)
        shift(s, sprite, s.toWorld(from.x + (home.x - from.x) * e, from.y + (home.y - from.y) * e))
        fade(sprite, Math.min(1, t * 3))
      })
      place(s, sprite, home)
    }),
  )
}

/** Each soldier drops from above and lands hard, `land` drawing what its landing throws up as `t` runs 0 to 1. */
async function fallIn(s: Stage, sprites: Sprite[], land: (fx: Sketch, sprite: Sprite, t: number) => void): Promise<void> {
  await Promise.all(
    sprites.map((sprite, i) =>
      drawing(s, async (fx) => {
        const ground = sprite.at
        await s.tween(i * STAGGER_MS, () => {})
        fade(sprite, 1)
        await s.tween(FALL_MS, (t) => shift(s, sprite, { x: ground.x, y: ground.y - FALL_FROM * (1 - t * t) }))
        place(s, sprite, sprite.tile)
        shake(s, 4, 300)
        await s.tween(DEBRIS_MS, (t) => land(fx.clear(), sprite, t))
      }),
    ),
  )
}

/** A crater cracking open round a superhero landing. */
function crack(fx: Sketch, at: Tile, t: number): void {
  fx.ellipse(at.x, at.y, 10 + 40 * t, 5 + 20 * t).stroke({ color: 0xffe08a, width: 3, alpha: 1 - t })
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2
    fx.moveTo(at.x, at.y).lineTo(at.x + Math.cos(a) * 30 * t, at.y + Math.sin(a) * 15 * t).stroke({ color: 0x10141c, width: 2, alpha: 1 - t })
  }
}

/** Glass shards scattering round a soldier crashing through a skylight. */
function glass(fx: Sketch, at: Tile, t: number): void {
  for (let k = 0; k < 9; k++) {
    const a = (k / 9) * Math.PI * 2 + k
    const x = at.x + Math.cos(a) * 46 * t
    const y = at.y - 30 * (1 - t) + Math.sin(a) * 20 * t
    fx.poly([x, y - 6, x + 4, y + 3, x - 3, y + 2]).fill({ color: 0xbfe6ff, alpha: 0.9 * (1 - t) })
  }
}

/** The door, kicked off its hinges, tumbling at the alien it hits. */
async function door(s: Stage, fx: Sketch, at: Tile, to: Tile): Promise<void> {
  shake(s, 3, 250)
  await s.tween(DEBRIS_MS, (t) => {
    const x = at.x + (to.x - at.x) * t
    const y = at.y + (to.y - at.y) * t - 40 - Math.sin(t * Math.PI) * 50
    const spin = t * Math.PI * 3
    const c = (dx: number, dy: number) => [x + dx * Math.cos(spin) - dy * Math.sin(spin), y + dx * Math.sin(spin) + dy * Math.cos(spin)]
    fx.clear()
      .poly([...c(-12, -20), ...c(12, -20), ...c(12, 20), ...c(-12, 20)])
      .fill({ color: 0x7a4a26 })
      .stroke({ color: 0x10141c, width: 2 })
  })
  shake(s, 5, 300)
}

/** Chunks of wall bursting out from `at`, and the dust. */
async function debris(s: Stage, fx: Sketch, at: Tile, color: number, count: number): Promise<void> {
  await s.tween(DEBRIS_MS, (t) => {
    fx.clear().ellipse(at.x, at.y - 10, 20 + 70 * t, 10 + 35 * t).fill({ color: 0xb8a888, alpha: 0.6 * (1 - t) })
    for (let k = 0; k < count; k++) {
      const a = (k / count) * Math.PI * 2
      const x = at.x + Math.cos(a) * 90 * t
      const y = at.y - 30 + Math.sin(a) * 40 * t - 60 * t + 90 * t * t
      fx.rect(x - 4, y - 3, 8, 6).fill({ color, alpha: 1 - t * t })
    }
  })
}

/** Ropes drop from above and each soldier slides down one. */
async function rappel(s: Stage, sprites: Sprite[]): Promise<void> {
  await Promise.all(
    sprites.map((sprite, i) =>
      drawing(s, async (fx) => {
        const ground = sprite.at
        const top = ground.y - FALL_FROM - 100
        await s.tween(i * STAGGER_MS, () => {})
        await s.tween(200, (t) => fx.clear().moveTo(ground.x, top).lineTo(ground.x, top + (ground.y - top) * t).stroke({ color: 0xd8dde6, width: 2 }))
        fade(sprite, 1)
        await s.tween(2 * FALL_MS, (t) => shift(s, sprite, { x: ground.x, y: top + 40 + (ground.y - top - 40) * t }))
        place(s, sprite, sprite.tile)
        await s.tween(250, (t) => fx.clear().moveTo(ground.x, top - (ground.y - top) * t).lineTo(ground.x, ground.y - (ground.y - top) * t).stroke({ color: 0xd8dde6, width: 2 }))
      }),
    ),
  )
}

/** A smoke screen billowing up, then thinning. */
async function smoke(s: Stage, fx: Sketch, at: Tile): Promise<void> {
  const puffs = Array.from({ length: 12 }, (_, k) => ({ a: k * 2.4, r: 20 + (k % 4) * 18 }))
  await s.tween(3 * DEBRIS_MS, (t) => {
    fx.clear()
    for (const { a, r } of puffs) fx.circle(at.x + Math.cos(a) * r * (0.6 + t), at.y - 20 + Math.sin(a) * r * 0.5, 22 + 12 * t).fill({ color: 0x9aa0a8, alpha: 0.75 * Math.min(1, 4 * (1 - t)) })
  })
}

/** Soldiers stride out of the smoke, dark shapes first. */
async function emerge(s: Stage, sprites: Sprite[], back: Tile): Promise<void> {
  await s.tween(DEBRIS_MS / 2, () => {})
  await Promise.all(
    sprites.map(async (sprite, i) => {
      const home = sprite.tile
      const from = { x: home.x + back.x, y: home.y + back.y }
      await s.tween(i * STAGGER_MS, () => {})
      await s.tween(2 * DASH_MS, (t) => {
        shift(s, sprite, s.toWorld(from.x + (home.x - from.x) * t, from.y + (home.y - from.y) * t))
        fade(sprite, 0.25 + 0.75 * t * t)
      })
    }),
  )
}

/** A truck roars in from behind and slews to a stop at the fight, dust flying. */
async function truck(s: Stage, fx: Sketch, at: Tile, back: Tile): Promise<void> {
  const far = s.toWorld(0, 0)
  const near = s.toWorld(back.x * 10, back.y * 10)
  const from = { x: at.x + near.x - far.x, y: at.y + near.y - far.y }
  await s.tween(2 * DASH_MS, (t) => {
    const e = 1 - (1 - t) * (1 - t)
    const x = from.x + (at.x - from.x) * e
    const y = from.y + (at.y - from.y) * e
    fx.clear().ellipse(x, y, 40, 14).fill({ color: 0x000000, alpha: 0.35 })
    fx.roundRect(x - 34, y - 40, 68, 34, 6).fill(0xb03a2e).stroke({ color: 0x10141c, width: 3 })
    fx.rect(x - 30, y - 34, 20, 12).fill(0x6fb7ff)
  })
  shake(s, 8, 500)
  await s.tween(DEBRIS_MS, (t) => fx.clear().ellipse(at.x, at.y - 10, 30 + 80 * t, 14 + 36 * t).fill({ color: 0xb8a888, alpha: 0.7 * (1 - t) }))
}

/** Shells streak down on the pod nearest, one after another, before the squad goes in. */
async function strike(s: Stage, battle: Battle, foe: Unit | undefined): Promise<void> {
  if (!foe) return
  const pod = battle.units.filter((u) => u.pod === foe.pod)
  await s.follow(pod.map((u) => ({ x: u.x, y: u.y })), 400)
  await Promise.all(
    pod.map((u, i) =>
      drawing(s, async (fx) => {
        const ground = s.toWorld(u.x, u.y)
        await s.tween(i * STAGGER_MS, () => {})
        await s.tween(300, (t) => fx.clear().moveTo(ground.x + 60, ground.y - 400 * (1 - t) - 60).lineTo(ground.x + 60 * (1 - t), ground.y - 400 * (1 - t)).stroke({ color: 0xffe08a, width: 4 }))
        shake(s, 6, 300)
        await s.tween(DEBRIS_MS, (t) => fx.clear().ellipse(ground.x, ground.y - 10, 20 + 50 * t, 10 + 25 * t).fill({ color: COLOR.crit, alpha: 0.8 * (1 - t) }))
      }),
    ),
  )
  const squad = battle.units.filter((u) => u.side === 'human' && !u.civilian)
  await s.follow([...squad.map((u) => ({ x: u.x, y: u.y })), { x: foe.x, y: foe.y }], 400)
}

/** The speaker steps up and taunts the aliens, who turn to it. */
async function monologue(s: Stage, battle: Battle, soldiers: Unit[]): Promise<void> {
  const speaker = soldiers.find((u) => u.id === battle.spotlight?.id) ?? soldiers[0]
  const sprite = s.sprites.get(speaker.id)!
  const line = callout(s, `“${TAUNTS[speaker.id % TAUNTS.length]}”`, 0xffffff, sprite, 16)
  await s.tween(LINE_MS, () => {})
  s.labels.delete(line)
  for (const alien of battle.units.filter((u) => u.side === 'alien' && s.sprites.has(u.id))) float(s, callout(s, '!', COLOR.crit, s.sprites.get(alien.id)!, 20))
}

/** The hero of `soldiers` nearest `foe`. */
const lead = (soldiers: Unit[], foe: Tile) => soldiers.reduce((a, b) => (Math.hypot(b.x - foe.x, b.y - foe.y) < Math.hypot(a.x - foe.x, a.y - foe.y) ? b : a))

/** Turns an alien round with a quick flip. */
async function turn(s: Stage, sprite: Sprite): Promise<void> {
  await s.tween(TURN_MS, (t) => squash(sprite, Math.cos(t * Math.PI), 1))
  squash(sprite, 1, 1)
}

/** The squad is there, unnoticed; one tap, two taps, the alien turns round, and it gets a fist. */
async function tap(s: Stage, soldiers: Unit[], foe: Unit | undefined): Promise<void> {
  await s.tween(DASH_MS, (t) => {
    for (const unit of soldiers) fade(s.sprites.get(unit.id)!, t)
  })
  const victim = foe && s.sprites.get(foe.id)
  if (!foe || !victim) return
  const hero = s.sprites.get(lead(soldiers, foe).id)!
  const home = hero.at
  const reach = { x: home.x + (victim.at.x - home.x) * 0.35, y: home.y + (victim.at.y - home.y) * 0.35 }
  const lunge = () => s.tween(TAP_MS, (t) => shift(s, hero, { x: home.x + (reach.x - home.x) * Math.sin(t * Math.PI), y: home.y + (reach.y - home.y) * Math.sin(t * Math.PI) }))
  const line = callout(s, 'tap tap', 0xffffff, hero, 15)
  await lunge()
  await lunge()
  s.labels.delete(line)
  await s.tween(TAP_MS, () => {})
  float(s, callout(s, '?', 0xffffff, victim, 26))
  await turn(s, victim)
  const hello = callout(s, '“Hi.”', 0xffffff, hero, 16)
  await s.tween(BEAT_MS, () => {})
  s.labels.delete(hello)
  await lunge()
  place(s, hero, hero.tile)
  shake(s, 7, 350)
  float(s, callout(s, 'POW!', COLOR.crit, victim, 30))
  await drawing(s, (fx) => s.tween(DEBRIS_MS / 2, (t) => burst(fx, victim.at, t)))
}

/** A comic-book star bursting where a punch lands. */
function burst(fx: Sketch, at: Tile, t: number): void {
  const points = Array.from({ length: 16 }, (_, k) => {
    const r = (k % 2 ? 18 : 42) * (0.5 + t)
    const a = (k / 16) * Math.PI * 2
    return [at.x + Math.cos(a) * r, at.y - 24 + Math.sin(a) * r * 0.7]
  }).flat()
  fx.clear().poly(points).fill({ color: 0xffe08a, alpha: 1 - t }).stroke({ color: 0x10141c, width: 3, alpha: 1 - t })
}

/** A hero points away from the aliens and calls out; the nearest pod falls for it, every alien turning round. */
async function look(s: Stage, battle: Battle, soldiers: Unit[], foe: Unit | undefined): Promise<void> {
  if (!foe) return
  const hero = s.sprites.get(lead(soldiers, foe).id)!
  const away = unitAway(hero.tile, foe)
  const from = hero.at
  const to = s.toWorld(hero.tile.x + away.x * 3, hero.tile.y + away.y * 3)
  const line = callout(s, '“Look over there!”', 0xffffff, hero, 18)
  await drawing(s, (fx) =>
    s.tween(LINE_MS, (t) => {
      const e = Math.min(1, t * 4)
      const tip = { x: from.x + (to.x - from.x) * e, y: from.y - 24 + (to.y - from.y) * e }
      fx.clear().moveTo(from.x, from.y - 24).lineTo(tip.x, tip.y).stroke({ color: 0xffe08a, width: 5 })
      fx.circle(tip.x, tip.y, 7).fill(0xffe08a).stroke({ color: 0x10141c, width: 2 })
    }),
  )
  s.labels.delete(line)
  const pod = battle.units.filter((u) => u.pod === foe.pod && s.sprites.has(u.id)).map((u) => s.sprites.get(u.id)!)
  for (const sprite of pod) float(s, callout(s, 'Huh?', 0xffffff, sprite, 18))
  await Promise.all(pod.map((sprite) => turn(s, sprite)))
  await s.tween(BEAT_MS, () => {})
}

/** Says `line` over `sprite` for `ms`. */
async function say(s: Stage, line: string, sprite: Sprite, ms = LINE_MS): Promise<void> {
  const mark = callout(s, line, 0xffffff, sprite, 18)
  await s.tween(ms, () => {})
  s.labels.delete(mark)
}

/** A bullet's streak from one point to another. */
const tracer = (s: Stage, from: Tile, to: Tile) =>
  drawing(s, (fx) =>
    s.tween(SHOT_MS, (t) => {
      const x = from.x + (to.x - from.x) * t
      const y = from.y - 24 + (to.y - from.y) * t
      fx.clear().moveTo(from.x + (x - from.x) * 0.6, from.y - 24 + (y - from.y + 24) * 0.6).lineTo(x, y).stroke({ color: 0xffe08a, width: 4 })
    }),
  )

/** The sky goes up behind the squad, and it strides out, not looking back. */
async function bigExplosion(s: Stage, soldiers: Unit[], sprites: Sprite[], at: Tile, back: Tile): Promise<void> {
  const behind = { x: at.x + (back.x - back.y) * 60, y: at.y + (back.x + back.y) * 30 }
  shake(s, 12, 900)
  await Promise.all([
    drawing(s, (fx) =>
      s.tween(3 * DEBRIS_MS, (t) => {
        const fade = Math.min(1, 3 * (1 - t))
        fx.clear().circle(behind.x, behind.y - 60, 60 + 150 * t).fill({ color: COLOR.crit, alpha: 0.75 * fade })
        fx.circle(behind.x, behind.y - 60, 30 + 110 * t).fill({ color: 0xffe08a, alpha: 0.9 * fade })
      }),
    ),
    emerge(s, sprites, back),
  ])
  await say(s, '“I meant to do that.”', s.sprites.get(soldiers[0].id)!)
}

/** The nearest alien starts its demands, and a hero does not let it finish. */
async function shootFirst(s: Stage, soldiers: Unit[], foe: Unit | undefined): Promise<void> {
  const victim = foe && s.sprites.get(foe.id)
  if (!foe || !victim) return
  const hero = s.sprites.get(lead(soldiers, foe).id)!
  const speech = callout(s, '“Earthling, surrender or we sh—”', 0xffffff, victim, 16)
  await s.tween(LINE_MS, () => {})
  await tracer(s, hero.at, victim.at)
  s.labels.delete(speech)
  shake(s, 4, 200)
  float(s, callout(s, 'BANG', COLOR.crit, victim, 26))
  await say(s, '“You were saying?”', hero)
}

/** A straggler no rule knows of steps up to a hero; another hero's shot drops it first, and the first complains. */
async function stolenKill(s: Stage, soldiers: Unit[], foe: Unit | undefined): Promise<void> {
  const shooter = s.sprites.get(soldiers[0].id)!
  const robbed = s.sprites.get((soldiers[1] ?? soldiers[0]).id)!
  const toward = foe ? unitAway(foe, robbed.tile) : { x: 0, y: -1 }
  const at = s.toWorld(robbed.tile.x + toward.x * 2, robbed.tile.y + toward.y * 2)
  await drawing(s, async (fx) => {
    const body = (fall: number, alpha: number) => {
      fx.clear().roundRect(at.x - 9, at.y - 30 + 24 * fall, 18, 30 - 24 * fall, 8).fill({ color: 0x7ee07e, alpha }).stroke({ color: 0x10141c, width: 2, alpha })
    }
    body(0, 1)
    await say(s, '“Mine.”', robbed, BEAT_MS)
    await tracer(s, shooter.at, at)
    shake(s, 3, 150)
    await s.tween(TURN_MS, (t) => body(t, 1))
    await say(s, '“He was mine.”', robbed)
    await say(s, '“Was.”', shooter, BEAT_MS)
    await s.tween(TURN_MS, (t) => body(1, 1 - t))
  })
}
