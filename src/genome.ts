/**
 * A genome is the whole face as plain, serialisable data: no drawing, no
 * canvas, just numbers and names. Print it, tweak one field, hand it back and
 * you get the same doodle with one thing changed.
 */

import { ACCENT, CLOTH, HAIR, WASH, makePalette } from './palette'
import { BEARD_WEIGHTS, MOUSTACHE_WEIGHTS } from './features/facialhair'
import { BROW_WEIGHTS, EAR_WEIGHTS, MOUTH_WEIGHTS } from './features/mouth'
import { HAIRLINES, HAIR_WEIGHTS } from './features/hair'

import { ACCESSORY_WEIGHTS } from './features/accessories'
import { BACKDROP_WEIGHTS } from './features/backdrop'
import { EYE_WEIGHTS } from './features/eyes'
import { HAT_WEIGHTS } from './features/hats'
import { MARK_WEIGHTS } from './features/marks'
import { NOSE_WEIGHTS } from './features/nose'
import { Rng } from './rng'

import type {
  AccessoryGenome, EyeSpec, Genome, Lobe, MarkGenome, Overrides,
  Palette, Skull, Vec3, Weighted, Wobble,
} from './types'
import type { Seed } from './rng'

/** Skull archetypes. The silhouette is most of the character. */
export const SKULLS = {
  round: { rx: 1.0, ry: 1.02, rz: 0.94 },
  egg: { rx: 0.92, ry: 1.18, rz: 0.9 },
  wide: { rx: 1.16, ry: 0.92, rz: 0.95 },
  long: { rx: 0.86, ry: 1.3, rz: 0.86 },
  potato: { rx: 1.06, ry: 1.04, rz: 1.0 },
  boxy: { rx: 1.02, ry: 1.06, rz: 0.9 },
  pear: { rx: 0.94, ry: 1.1, rz: 0.9 },
  tall: { rx: 0.88, ry: 1.24, rz: 0.9 },
}

const SKULL_WEIGHTS: Weighted<string> = [
  ['round', 10], ['egg', 8], ['potato', 8], ['wide', 6], ['pear', 6],
  ['long', 5], ['boxy', 5], ['tall', 4],
]

function makeSkull(rng: Rng): Skull {
  const name = rng.pickWeighted(SKULL_WEIGHTS)
  const base = SKULLS[name as keyof typeof SKULLS]
  const rx = base.rx * rng.float(0.94, 1.06)
  const ry = base.ry * rng.float(0.94, 1.06)
  const rz = base.rz * rng.float(0.94, 1.06)

  const lobes: Lobe[] = []
  const add = (dir: Vec3, amp: number, power: number) => lobes.push({ dir, amp, power })

  if (name === 'pear') {
    add([0, -0.85, 0.5], 0.16, 2.2); add([0.9, -0.5, 0.2], 0.1, 2.5); add([-0.9, -0.5, 0.2], 0.1, 2.5)
  }
  if (name === 'boxy') {
    add([0.95, -0.3, 0.1], 0.11, 4); add([-0.95, -0.3, 0.1], 0.11, 4); add([0, 0.9, 0.3], 0.07, 4)
  }
  if (name === 'egg') {
    add([0, 1, 0], 0.1, 2); add([0, -1, 0.2], -0.08, 2.5)
  }
  if (name === 'potato') {
    add([0.6, 0.2, 0.7], 0.09, 2); add([-0.5, -0.4, 0.6], 0.08, 2)
  }
  if (name === 'wide') {
    add([0.9, 0, 0.3], 0.09, 3); add([-0.9, 0, 0.3], 0.09, 3)
  }

  // Chin: jutting, receding, or somewhere in between.
  const chin = rng.pickWeighted([[0.2, 3], [0.08, 5], [-0.1, 3], [0, 4]])
  if (chin) add([0, -0.92, 0.38], chin, rng.float(2, 4))
  // Forehead / cranium.
  if (rng.bool(0.5)) add([0, 0.6, 0.8], rng.float(0.04, 0.12), rng.float(2, 4))
  if (rng.bool(0.35)) add([0, 0.95, -0.3], rng.float(0.05, 0.14), 2.5)
  // Nobody's head is symmetric.
  const side = rng.sign()
  add([side * 0.9, rng.float(-0.4, 0.5), rng.float(0, 0.5)], rng.float(0.03, 0.09), rng.float(2, 4))

  const wobble: Wobble[] = []
  const terms = rng.int(3, 4)
  for (let i = 0; i < terms; i++) {
    wobble.push({
      dir: [rng.float(-1, 1), rng.float(-1, 1), rng.float(-1, 1)],
      amp: rng.float(0.005, 0.018),
      freq: rng.float(1.2, 4.5),
      phase: rng.float(0, Math.PI * 2),
    })
  }

  return { name, rx, ry, rz, lobes, wobble }
}

/** Pass `twin` to echo the other eye; leave it out for a fresh one. */
function pickEye(rng: Rng, twin: EyeSpec | null = null): EyeSpec {
  if (twin) {
    return { type: twin.type, size: twin.size * rng.float(0.9, 1.1), bag: twin.bag }
  }

  return {
    type: rng.pickWeighted(EYE_WEIGHTS),
    size: 0.13 * rng.float(0.72, 1.4),
    bag: rng.bool(0.12),
  }
}

export function makeGenome(seed: Seed = 1, overrides: Overrides = {}): Genome {
  const rng = new Rng(seed)
  const pal = makePalette(rng.fork('palette'), overrides.palette || {})
  const skull = makeSkull(rng.fork('skull'))

  const r = rng.fork('features')
  const hairColor = pal.hair

  // Eyes: usually a pair, sometimes gloriously mismatched.
  const matched = r.bool(0.62)
  const right = pickEye(r)
  const left = pickEye(r, matched ? right : null)

  const eyeV = r.float(-0.04, 0.2)
  const mouthV = r.float(-0.76, -0.44)

  const g: Genome = {
    seed,
    skull,
    palette: pal,
    ink: pal.ink,
    skin: pal.skin,
    paper: pal.paper,
    orientation: { yaw: 0, pitch: 0, roll: 0 },

    eyes: {
      // Wide enough apart that big eyes can't collide over the bridge.
      u: Math.max(r.float(0.34, 0.56), Math.asin(Math.min(0.85, Math.max(left.size, right.size) * 2.6))),
      v: eyeV,
      skewU: r.gauss(0, 0.03),
      skewV: r.gauss(0, 0.035),
      left, right,
    },

    brow: {
      type: r.pickWeighted(BROW_WEIGHTS),
      v: eyeV + r.float(0.16, 0.3),
      size: r.float(0.16, 0.27),
      lift: r.gauss(0, 0.045),
      asym: r.float(0.8, 1.2),
      uni: r.bool(0.06),
    },

    nose: {
      u: r.gauss(0, 0.035),
      v: r.float(-0.14, 0.02),
      type: r.pickWeighted(NOSE_WEIGHTS),
      size: r.float(0.22, 0.4),
      flip: r.bool(0.5),
    },

    mouth: {
      u: r.gauss(0, 0.03),
      v: mouthV,
      type: r.pickWeighted(MOUTH_WEIGHTS),
      size: r.float(0.24, 0.42),
    },

    ears: {
      u: r.float(1.26, 1.42),
      v: r.float(-0.08, 0.08),
      type: r.pickWeighted(EAR_WEIGHTS),
      size: r.float(0.17, 0.28),
      earring: r.bool(0.12),
      earringColor: r.pick([ACCENT.yellow, ACCENT.red, pal.ink, ACCENT.cyan]),
    },

    hair: (() => {
      const type = r.pickWeighted(HAIR_WEIGHTS)
      const lineKind = r.pickWeighted([
        ['peak', 7], ['m', 6], ['tilted', 5], ['receding', 4], ['wavy', 4], ['level', 2],
      ])
      const amp = r.float(0.1, 0.24)

      return {
        type,
        v: r.float(0.34, 0.6),
        color: hairColor,
        lineKind,
        line: lineKind === 'level' ? null : HAIRLINES[lineKind]!(amp),
        lineAmp: amp,
        hatchAngle: r.float(-1.4, 1.4),
        filled: r.bool(0.72),
        volume: r.float(0.16, 0.42),
        bunU: r.gauss(0, 0.3),
        bunSize: r.float(0.13, 0.24),
        hatchBun: r.bool(0.4),
        flip: r.sign(),
      }
    })(),

    hat: (() => {
      const type = r.pickWeighted(HAT_WEIGHTS)
      const color = r.pickWeighted([[r.pick(CLOTH), 5], [r.pick(WASH), 4], [r.pick(HAIR.slice(0, 3)), 3]])

      return {
        type,
        v: r.float(0.42, 0.66),
        width: r.float(0.16, 0.3),
        grow: r.float(0.03, 0.09),
        height: r.float(0.4, 0.75),
        color,
        pomColor: r.pick([...WASH, ...CLOTH]),
        pattern: r.pickWeighted([['none', 4], ['stripe', 4], ['zigzag', 3], ['hatch', 4]]),
        knotSide: r.sign(),
      }
    })(),

    beard: (() => {
      const type = r.pickWeighted(BEARD_WEIGHTS)

      return {
        type,
        v: Math.min(eyeV - 0.34, mouthV + r.float(-0.12, 0.24)),
        color: r.bool(0.75) ? hairColor : r.pick(HAIR),
        filled: r.bool(0.55),
        hatchAngle: r.float(0.8, 1.8),
        length: r.float(0.25, 0.7),
        line: HAIRLINES.jaw!(r.float(0.07, 0.2)),
        moustache: type === 'moustache'
          ? r.pickWeighted(MOUSTACHE_WEIGHTS.filter((m) => m[0] !== 'none'))
          : r.pickWeighted(MOUSTACHE_WEIGHTS),
        moustacheSize: r.float(0.16, 0.3),
      }
    })(),

    accessories: [] as AccessoryGenome[],
    marks: [] as MarkGenome[],

    backdrop: (() => {
      const type = r.pickWeighted(BACKDROP_WEIGHTS)

      return {
        type,
        color: r.pick(WASH),
        alpha: r.float(0.5, 0.85),
        pad: r.float(1.08, 1.32),
        dx: r.gauss(0, 6),
        dy: r.gauss(0, 6),
        rot: r.float(-0.25, 0.25),
        spikes: r.int(5, 8),
      }
    })(),
  }

  // Fix up the moustache type: 'moustache' is a beard variant that only draws
  // the moustache, so route it through the shared renderer.
  if (g.beard.type === 'moustache') g.beard.type = 'moustacheOnly'

  // Accessories: at most a couple, and never two things fighting over the eyes.
  const ar = rng.fork('accessories')
  const count = ar.pickWeighted([[0, 8], [1, 10], [2, 5], [3, 1]])
  const taken = new Set<string>()
  const eyeSlots = new Set(['glasses', 'monocle', 'eyepatch', 'mask'])
  for (let i = 0; i < count; i++) {
    const type = ar.pickWeighted(ACCESSORY_WEIGHTS)
    if (taken.has(type)) continue
    if (eyeSlots.has(type) && [...taken].some((t) => eyeSlots.has(t))) continue
    taken.add(type)
    g.accessories.push(makeAccessory(type, ar, pal, g))
  }

  const mr = rng.fork('marks')
  const mcount = mr.pickWeighted([[0, 7], [1, 10], [2, 6], [3, 2]])
  const mtaken = new Set<string>()
  for (let i = 0; i < mcount; i++) {
    const type = mr.pickWeighted(MARK_WEIGHTS)
    if (mtaken.has(type)) continue
    mtaken.add(type)
    g.marks.push(makeMark(type, mr, pal))
  }

  return applyOverrides(g, overrides)
}

function makeAccessory(type: string, r: Rng, pal: Palette, g: Genome): AccessoryGenome {
  const a: AccessoryGenome = { type }
  switch (type) {
    case 'glasses':
      a.shape = r.pickWeighted([['round', 6], ['square', 3], ['rounded', 3]])
      a.size = Math.max(0.17, Math.max(g.eyes.left.size, g.eyes.right.size) * r.float(1.15, 1.6))
      a.color = r.bool(0.85) ? pal.ink : r.pick([ACCENT.blue, ACCENT.red, '#6b5b4a'])
      a.weight = r.float(0.7, 1.3)
      if (r.bool(0.18)) {
        a.tint = pal.ink; a.tintAlpha = r.float(0.6, 0.9)
      } else if (r.bool(0.1)) {   // sunglasses
        a.tint = null
      }
      if (r.bool(0.08)) {
        a.tint = null; a.threeD = true
      }
      break
    case 'monocle':
      a.side = r.sign()
      a.size = 0.2
      a.color = pal.ink
      a.weight = r.float(0.8, 1.2)
      break
    case 'eyepatch':
      a.side = r.sign()
      a.size = 0.2
      a.color = r.pickWeighted([[pal.ink, 6], ['#3a3f57', 2], ['#4a3a32', 2]])
      break
    case 'mask':
      a.color = r.pickWeighted([[pal.ink, 6], ['#2a2e38', 3]])
      break
    case 'faceMask':
      a.color = r.pick(['#dfe3e2', '#c9d2d8', ...WASH])
      break
    case 'bowtie':
      a.size = r.float(0.13, 0.22)
      a.color = r.pick([...CLOTH, ACCENT.red, ACCENT.blue, ACCENT.green])
      break
    case 'necktie':
      a.size = r.float(0.16, 0.26)
      a.color = r.pick([...CLOTH, ACCENT.red])
      break
    case 'collar':
      a.buttons = r.bool(0.5)
      break
    case 'scarf':
      a.color = r.pick([...WASH, ...CLOTH])
      break
    case 'flower':
      a.u = r.float(0.7, 1.1) * r.sign()
      a.v = r.float(0.5, 0.75)
      a.color = r.pick([ACCENT.pink, ACCENT.red, ACCENT.yellow, '#c9d4c0'])
      break
    case 'sweat':
      a.side = r.sign()
      break
    default:
      break
  }

  return a
}

function makeMark(type: string, r: Rng, pal: Palette): MarkGenome {
  const m: MarkGenome = { type }
  if (type === 'blush') {
    m.color = r.pick([ACCENT.pink, '#d9a08f', '#c98f8f', ACCENT.red])
    m.style = r.pickWeighted([['wash', 6], ['hatch', 3]])
  } else if (type === 'freckles') {
    m.count = r.int(4, 10)
    m.color = r.pick([pal.ink, '#8a5f42'])
  } else if (type === 'mole' || type === 'scar') {
    m.u = r.float(0.4, 0.95) * r.sign()
    m.v = r.float(-0.35, 0.35)
  } else if (type === 'wrinkles') {
    m.count = r.int(1, 3)
  }

  return m
}

const isPlain = (v: unknown): v is Record<string, unknown> => v != null && typeof v === 'object' && !Array.isArray(v) && typeof v !== 'function'

/**
 * Merge overrides into a genome.
 *
 * A bare string sets that category's `type`, so `{ nose: 'hook' }` does what
 * you'd expect. Objects merge deeply, so `{ eyes: { left: { type: 'spiral' } } }`
 * changes one eye's type and leaves its size alone.
 */
export function applyOverrides<T>(g: T, overrides: Overrides = {}): T {
  const node = g as Record<string, any>
  for (const [k, v] of Object.entries(overrides)) {
    if (k === 'palette' || v == null) continue
    if (typeof v === 'string' && isPlain(node[k])) node[k].type = v
    else if (isPlain(v) && isPlain(node[k])) applyOverrides(node[k], v)
    else node[k] = v
  }

  return g
}

/** A one-line human description, handy for captions and debugging. */
export function describe(g: Genome): string {
  const bits = [
    g.skull.name,
    `${g.eyes.left.type}/${g.eyes.right.type} eyes`,
    `${g.nose.type} nose`,
    `${g.mouth.type} mouth`,
  ]
  if (g.hair.type !== 'none') bits.push(`${g.hair.type} hair`)
  if (g.hat.type !== 'none') bits.push(g.hat.type)
  if (g.beard.type !== 'none') bits.push(g.beard.type)
  for (const a of g.accessories) bits.push(a.type)

  return bits.join(', ')
}
