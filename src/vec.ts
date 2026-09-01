/** Tiny 3D math. Matrices are row-major 9-element arrays. */

import type { Mat3, Vec3 } from './types'

export const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

export const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]

export function norm3(a: Vec3): Vec3 {
  const l = Math.hypot(a[0], a[1], a[2]) || 1

  return [a[0] / l, a[1] / l, a[2] / l]
}

export const scale3 = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k]
export const add3 = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
export const sub3 = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]

export function matApply(m: Mat3, v: Vec3): Vec3 {
  return [
    m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
    m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
    m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
  ]
}

export function matMul(a: Mat3, b: Mat3): Mat3 {
  const o: Mat3 = new Array(9)
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      o[r * 3 + c] = a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c]
    }
  }

  return o
}

export const identity = (): Mat3 => [1, 0, 0, 0, 1, 0, 0, 0, 1]

export function rotX(t: number): Mat3 {
  const c = Math.cos(t), s = Math.sin(t)

  return [1, 0, 0, 0, c, -s, 0, s, c]
}

export function rotY(t: number): Mat3 {
  const c = Math.cos(t), s = Math.sin(t)

  return [c, 0, s, 0, 1, 0, -s, 0, c]
}

export function rotZ(t: number): Mat3 {
  const c = Math.cos(t), s = Math.sin(t)

  return [c, -s, 0, s, c, 0, 0, 0, 1]
}

/** Any orthonormal pair perpendicular to `axis`. */
export function basisFor(axis: Vec3): [Vec3, Vec3] {
  const a = norm3(axis)
  const seed: Vec3 = Math.abs(a[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]
  const t1 = norm3(cross(a, seed))
  const t2 = norm3(cross(a, t1))

  return [t1, t2]
}
