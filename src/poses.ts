/**
 * Poses: an orientation as a function of time.
 *
 * A pose takes `t` in [0, 1) -- one trip round the loop -- and returns degrees
 * of yaw, pitch and roll. Every pose here is *periodic*, meaning the value at
 * t = 1 is the value at t = 0, so a clip rendered across one full cycle joins
 * back onto itself with no seam. That is the whole trick behind a loopable
 * animation: nothing fades or resets, the head simply arrives back where it
 * started.
 */

export interface Orientation {
  /** Degrees. */
  yaw: number
  pitch: number
  roll: number
}

/** `t` runs 0 -> 1 over one loop. Must be periodic to loop cleanly. */
export type Pose = (t: number) => Partial<Orientation>

export interface Keyframe extends Partial<Orientation> {
  /** Where in the loop this frame sits, 0 -> 1. */
  at: number
}

const TAU = Math.PI * 2

/** Zero at t = 0 and t = 1, so anything built on it loops. */
const wave = (t: number, cycles = 1, phase = 0): number => Math.sin(t * TAU * cycles + phase)

/** A single soft bump, centred at `c`, that dies away well before the ends. */
const bump = (t: number, c: number, w: number): number => Math.exp(-(((t - c) / w) ** 2))

/**
 * Flattens a sine near its extremes, so the head dwells before coming back.
 *
 * A fractional power would do it too, but its slope is infinite at zero, which
 * makes the head snap through centre on every pass. A quarter-sine is flat at
 * ±1, smooth everywhere, and leaves 0 -> 0 for a clean seam.
 */
const dwell = (s: number): number => Math.sin((s * Math.PI) / 2)

export const poses: Record<string, Pose> = {
  /** The default: a wide, unhurried look left and right. */
  turntable: (t) => ({ yaw: 70 * wave(t) }),

  /** All the way round, back of the head included. */
  spin: (t) => ({ yaw: 360 * t }),

  /** Yes. */
  nod: (t) => ({ pitch: 22 * wave(t) }),

  /** No -- twice per loop, because one shake reads as a slow swivel. */
  shake: (t) => ({ yaw: 26 * wave(t, 2) }),

  /** Leaning into the turn, the way a head actually moves. */
  sway: (t) => ({ yaw: 20 * wave(t), roll: -8 * wave(t, 1, 0.6) }),

  /** Curiosity, or a cocked ear. */
  tilt: (t) => ({ roll: 16 * wave(t), pitch: 4 * wave(t, 2) }),

  /** A sweep that pauses at each end before starting back. */
  scan: (t) => ({ yaw: 62 * dwell(wave(t)), pitch: -3 * wave(t, 2) }),

  /** Still, then a quick glance over the shoulder and back. */
  peek: (t) => ({
    yaw: 58 * bump(t, 0.5, 0.09),
    pitch: -6 * bump(t, 0.5, 0.07),
    roll: 5 * bump(t, 0.56, 0.06),
  }),

  /** A lazy figure-eight. */
  wobble: (t) => ({
    yaw: 24 * wave(t),
    pitch: 14 * wave(t, 2, 0.4),
    roll: 6 * wave(t, 1, Math.PI / 2) - 6,
  }),

  /** Barely moving -- an avatar that is alive but not demanding attention. */
  idle: (t) => ({
    yaw: 5 * wave(t) + 2 * wave(t, 3),
    pitch: 3 * wave(t, 2) + 1 * wave(t, 5),
    roll: 1.5 * wave(t, 1, 1.1),
  }),
}

export type PoseName = keyof typeof poses & string

export const POSE_NAMES = Object.keys(poses) as PoseName[]

const clamp01 = (t: number): number => (Number.isFinite(t) ? t - Math.floor(t) : 0)

const smooth = (x: number): number => x * x * (3 - 2 * x)

/**
 * Build a pose.
 *
 * Pass a function for full control, or keyframes to be interpolated:
 *
 *   definePose([{ at: 0, yaw: -30 }, { at: 0.5, yaw: 30 }])
 *
 * Keyframes wrap around, so the last one eases back into the first and the
 * result loops without you having to repeat a frame at `at: 1`.
 */
export function definePose(spec: Pose | Keyframe[]): Pose {
  if (typeof spec === 'function') return (t) => spec(clamp01(t))
  const keys = spec
    .map((k) => ({ ...k, at: clamp01(k.at) }))
    .sort((a, b) => a.at - b.at)

  if (keys.length === 0) return () => ({})
  if (keys.length === 1) {
    const only = keys[0]

    return () => ({ yaw: only.yaw, pitch: only.pitch, roll: only.roll })
  }

  return (time) => {
    const t = clamp01(time)
    let i = keys.length - 1
    for (let k = 0; k < keys.length; k++) if (keys[k].at <= t) i = k
    // The final segment wraps past the end of the loop into the first frame.
    const a = keys[i]
    const b = keys[(i + 1) % keys.length]
    const span = (b.at - a.at + 1) % 1 || 1
    const local = ((t - a.at + 1) % 1) / span
    const e = smooth(Math.min(1, Math.max(0, local)))
    const mix = (x = 0, y = 0) => x + (y - x) * e

    return {
      yaw: mix(a.yaw, b.yaw),
      pitch: mix(a.pitch, b.pitch),
      roll: mix(a.roll, b.roll),
    }
  }
}

/** A name, a function, or keyframes -- all become a pose. */
export function resolvePose(pose: PoseName | Pose | Keyframe[] | undefined): Pose {
  if (!pose) return poses.turntable
  if (typeof pose === 'string') return poses[pose] ?? poses.turntable

  return definePose(pose)
}

/** The orientation at time `t`, laid over whatever the caller already set. */
export function poseAt(pose: Pose, t: number, base: Partial<Orientation> = {}): Orientation {
  const o = pose(clamp01(t))

  return {
    yaw: (base.yaw ?? 0) + (o.yaw ?? 0),
    pitch: (base.pitch ?? 0) + (o.pitch ?? 0),
    roll: (base.roll ?? 0) + (o.roll ?? 0),
  }
}
