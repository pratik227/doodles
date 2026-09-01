/**
 * The shapes everything else agrees on.
 *
 * Nothing here has a runtime existence -- it is the vocabulary the library
 * already spoke in comments, written down so the compiler can hear it too.
 */

import type { Head } from './head'
import type { Pen } from './pen'
import type { Rng } from './rng'

// ------------------------------------------------------------------- maths

/** A screen point. Always exactly two numbers, so it can be spread. */
export type Point2 = [number, number]

/**
 * A point in feature space: [x, y] across and down the face, with an optional
 * third component standing off the skin. Callers read `p[2] || 0`.
 */
export type Pt = number[]

export type Vec3 = [number, number, number]

/** Row-major 3x3, nine elements. */
export type Mat3 = number[]

/** `[value, weight]` pairs, as fed to `Rng#pickWeighted`. */
export type Weighted<T> = ReadonlyArray<readonly [T, number]>

// ---------------------------------------------------------------- surfaces

/** `['M', x, y]`, `['Q', cx, cy, x, y]`, `['Z']` -- SVG path commands. */
export type PathCmd = [cmd: string, ...args: number[]]

export type LineCap = 'butt' | 'round' | 'square'
export type LineJoin = 'miter' | 'round' | 'bevel'
export type FillRule = 'nonzero' | 'evenodd'

export interface PathStyle {
  fill?: string | null
  stroke?: string | null
  width?: number
  alpha?: number
  cap?: LineCap
  join?: LineJoin
  dash?: string | null
  fillRule?: FillRule
}

export interface PaperTextureOptions {
  opacity?: number
  /** SVG grain: turbulence frequency, octaves and seed. */
  freq?: number
  octaves?: number
  seed?: number
  /** Canvas grain: speckle size, and where the speckles come from. */
  scale?: number
  rng?: () => number
}

/** The whole drawing API: four calls, plus two the plate asks about first. */
export interface Surface {
  width: number
  height: number
  path(cmds: PathCmd[], style: PathStyle): void
  clip(cmds: PathCmd[], fn: () => void): void
  rect(x: number, y: number, w: number, h: number, style: PathStyle): void
  group?(transform: string, fn: () => void): void
  background(color: string): void
  paperTexture?(opts?: PaperTextureOptions): void
}

// -------------------------------------------------------------------- pen

/** Options shared by every inked mark. Individual calls ignore what they must. */
export interface StrokeOptions {
  closed?: boolean
  color?: string
  alpha?: number
  weight?: number
  passes?: number
  rough?: number
  bow?: number
  overshoot?: number
  fill?: string | null
  fillAlpha?: number
  dash?: string | null
  fillRule?: FillRule
  /** Resampling multiplier: bigger means coarser, wobblier lines. */
  step?: number
  /** strokeMany: resample two-point strokes instead of just twitching them. */
  detail?: boolean
}

export interface BlobOptions {
  color?: string
  alpha?: number
  rough?: number
  step?: number
  outline?: string | null
  weight?: number
  passes?: number
}

export interface EllipseOptions extends StrokeOptions {
  segments?: number
  /** `false` draws the fill only. */
  stroke?: string | false
}

export interface DotOptions {
  color?: string
  alpha?: number
  /** How far out of the skin the dot sits, in feature units. */
  z?: number
}

export interface HatchOptions {
  angle?: number
  gap?: number
  color?: string
  alpha?: number
  weight?: number
  cross?: boolean
  jitterGap?: number
}

export interface ScribbleOptions {
  color?: string
  alpha?: number
  weight?: number
  loops?: number
}

export interface SpeckleOptions {
  count?: number
  color?: string
  alpha?: number
  len?: number
}

// ------------------------------------------------------------------- head

export interface Lobe {
  dir: Vec3
  amp: number
  power: number
}

export interface Wobble {
  dir: Vec3
  amp: number
  freq: number
  phase: number
}

export interface HeadOptions {
  rx?: number
  ry?: number
  rz?: number
  lobes?: Lobe[]
  wobble?: Wobble[]
  cx?: number
  cy?: number
  scale?: number
  focal?: number
  yaw?: number
  pitch?: number
  roll?: number
}

export interface Projection {
  x: number
  y: number
  z: number
  /** Perspective divide applied at this depth. */
  s: number
}

/** A drawing plane glued to the skull at one (u, v). */
export interface Frame {
  u: number
  v: number
  o: Point2
  ex: Point2
  ey: Point2
  ez: Point2
  map(a: number, b: number, c?: number): Point2
  poly(pts: Pt[]): Point2[]
  /** > 0 means this patch of skin faces the viewer. */
  facing: number
  depth: number
  scale: number
  /** How much horizontal room is left after foreshortening (0..1). */
  squash: number
}

export interface Silhouette {
  pts: Pt[]
  dirs: Vec3[]
  center: Point2
  segments: number
}

export interface Bounds {
  x0: number
  y0: number
  x1: number
  y1: number
  w: number
  h: number
}

/** Bends a ring away from level: `(theta, v) => v'`. */
export type Hairline = (theta: number, v: number) => number

export interface RingOptions {
  v?: number
  axis?: Vec3
  grow?: number
  lift?: number
  segments?: number
  vAt?: Hairline | null
  /** cap() only; ring() ignores these. */
  below?: boolean
  edgeOnly?: boolean
}

export interface RingPoint {
  d: Vec3
  p: Point2
  facing: number
  theta: number
  z: number
}

export interface Cap {
  /** The visible arc of the ring, in order. */
  edge: Pt[]
  dirs: Vec3[]
  ring: RingPoint[]
  visible: number[]
  edgeLen: number
  /** The stretch of silhouette that closes the region off. */
  crown: Pt[]
  poly: Pt[]
}

// ---------------------------------------------------------------- genome

export interface Accents {
  red: string
  cyan: string
  blue: string
  green: string
  yellow: string
  pink: string
  purple: string
}

export interface Palette {
  paper: string
  ink: string
  /** null means no fill: a pure line drawing. */
  skin: string | null
  hair: string
  wash: string
  cloth: string
  accent: Accents
}

export interface PaletteOptions {
  paper?: string
  ink?: string
  skin?: string | null
  hair?: string
  wash?: string
  cloth?: string
}

export interface Skull {
  name: string
  rx: number
  ry: number
  rz: number
  lobes: Lobe[]
  wobble: Wobble[]
}

export interface EyeSpec {
  type: string
  size: number
  bag: boolean
}

export interface EyesGenome {
  u: number
  v: number
  skewU: number
  skewV: number
  left: EyeSpec
  right: EyeSpec
}

export interface BrowGenome {
  type: string
  v: number
  size: number
  lift: number
  asym: number
  uni: boolean
}

export interface NoseGenome {
  type: string
  u: number
  v: number
  size: number
  flip: boolean
}

export interface MouthGenome {
  type: string
  u: number
  v: number
  size: number
}

export interface EarsGenome {
  type: string
  u: number
  v: number
  size: number
  earring: boolean
  earringColor: string
}

export interface HairGenome {
  type: string
  v: number
  color: string
  lineKind: string
  line: Hairline | null
  lineAmp: number
  hatchAngle: number
  filled: boolean
  volume: number
  bunU: number
  bunSize: number
  hatchBun: boolean
  flip: number
}

export interface HatGenome {
  type: string
  v: number
  width: number
  grow: number
  height: number
  color: string
  pomColor: string
  pattern: string
  knotSide: number
  /** Beanies only, and off unless something asks for it. */
  ribs?: boolean
}

export interface BeardGenome {
  type: string
  v: number
  color: string
  filled: boolean
  hatchAngle: number
  length: number
  line: Hairline
  moustache: string
  moustacheSize: number
  /** Set while drawing the beard mass, so the moustache can land on top later. */
  deferMoustache?: boolean
}

export interface AccessoryGenome {
  type: string
  shape?: string
  size?: number
  color?: string
  weight?: number
  tint?: string | null
  tintAlpha?: number
  threeD?: boolean
  side?: number
  buttons?: boolean
  u?: number
  v?: number
}

export interface MarkGenome {
  type: string
  color?: string
  style?: string
  count?: number
  u?: number
  v?: number
}

export interface BackdropGenome {
  type: string
  color: string
  alpha: number
  pad: number
  dx: number
  dy: number
  rot: number
  spikes: number
}

export interface Genome {
  seed: string | number
  skull: Skull
  palette: Palette
  ink: string
  skin: string | null
  paper: string
  orientation: { yaw: number, pitch: number, roll: number }
  eyes: EyesGenome
  brow: BrowGenome
  nose: NoseGenome
  mouth: MouthGenome
  ears: EarsGenome
  hair: HairGenome
  hat: HatGenome
  beard: BeardGenome
  accessories: AccessoryGenome[]
  marks: MarkGenome[]
  backdrop: BackdropGenome
  /** `false` suppresses the shading pass. */
  shade?: boolean
}

/**
 * Overrides pinned onto a genome. A bare string sets that category's `type`,
 * an object merges deeply, anything else replaces outright -- so this is
 * deliberately looser than `Genome` itself.
 */
export type Overrides = Record<string, any>

// -------------------------------------------------------- feature context

/** What a feature is handed. Everything speaks feature space. */
export interface FeatureContext {
  pen: Pen
  head: Head
  rng: Rng
  g: Genome
  /** Pixels per head radius. */
  px: number
  pal: Palette
  draw(f: Frame, pts: Pt[], o?: StrokeOptions): void
  fill(f: Frame, pts: Pt[], o?: BlobOptions): void
  oval(f: Frame, cx: number, cy: number, rx: number, ry: number, rot?: number,
    o?: StrokeOptions & { segments?: number, z?: number }): void
  dot(f: Frame, x: number, y: number, r: number, o?: DotOptions): void
  hatch(f: Frame, pts: Pt[], o?: HatchOptions): void
  earFrame(f: Frame): Frame
  mirrorFrame(f: Frame): Frame
}

export type FeatureFn<G> = (c: FeatureContext, g: G) => void
export type AnchoredFn<G> = (c: FeatureContext, f: Frame, s: G) => void
