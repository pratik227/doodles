/**
 * Noses. These are the features that most want to be 3D: a nose is a ridge
 * standing off the front of the skull, so every point here carries a z lift.
 * Turn the head and the nose swings out past the silhouette on its own.
 */

import type { FeatureContext, Frame, Weighted } from '../types'
import { arc, curve, oval } from '../shapes'

export type NoseFn = (c: FeatureContext, f: Frame, s: number) => void

export const noses: Record<string, NoseFn> = {
  hook(c, f, s) {
    const z = s * 0.58
    c.draw(f, curve([
      [0, -s * 1.4, z * 0.15],
      [s * 0.12, -s * 0.4, z * 0.55],
      [s * 0.2, s * 0.25, z * 0.95],
      [-s * 0.25, s * 0.55, z * 0.55],
    ]), { weight: 1.45 })
    c.draw(f, [[-s * 0.28, s * 0.5, z * 0.5], [-s * 0.62, s * 0.42, z * 0.15]], { weight: 0.7, passes: 1 })
  },

  beak(c, f, s) {
    const z = s * 0.6
    c.draw(f, curve([
      [0, -s * 1.5, z * 0.1],
      [s * 0.1, -s * 0.2, z * 0.6],
      [s * 0.35, s * 0.7, z],
    ]), { weight: 1.35 })
    c.draw(f, [[s * 0.3, s * 0.72, z * 0.95], [-s * 0.35, s * 0.6, z * 0.3]], { weight: 0.9 })
  },

  long(c, f, s) {
    const z = s * 0.62
    c.draw(f, curve([
      [0, -s * 1.6, 0],
      [s * 0.08, -s * 0.3, z * 0.5],
      [s * 0.14, s * 1.05, z * 0.9],
      [-s * 0.2, s * 1.25, z * 0.5],
    ]), { weight: 1.25 })
  },

  roman(c, f, s) {
    const z = s * 0.68
    c.draw(f, curve([
      [0, -s * 1.4, z * 0.1],
      [s * 0.25, -s * 0.6, z * 0.7],
      [s * 0.1, s * 0.1, z * 0.85],
      [s * 0.22, s * 0.6, z * 0.7],
      [-s * 0.2, s * 0.7, z * 0.3],
    ]), { weight: 1.3 })
  },

  ski(c, f, s) {
    const z = s * 0.66
    c.draw(f, curve([
      [0, -s * 1.3, z * 0.5],
      [-s * 0.05, -s * 0.3, z * 0.4],
      [s * 0.25, s * 0.45, z],
      [-s * 0.15, s * 0.6, z * 0.5],
    ]), { weight: 1.3 })
  },

  button(c, f, s) {
    c.oval(f, 0, s * 0.1, s * 0.42, s * 0.38, 0, { weight: 0.9, z: s * 0.5 })
    if (c.rng.bool(0.4)) c.draw(f, [[0, -s * 1.1, s * 0.2], [0, -s * 0.35, s * 0.6]], { weight: 0.6, passes: 1 })
  },

  blob(c, f, s) {
    const pts = oval(0, s * 0.15, s * 0.6, s * 0.5, c.rng.jitter(0.3), 16, s * 0.55)
    c.draw(f, pts, { closed: true, weight: 1 })
    c.dot(f, -s * 0.28, s * 0.42, s * 0.1, { z: s * 0.45 })
    c.dot(f, s * 0.28, s * 0.42, s * 0.1, { z: s * 0.45 })
  },

  wide(c, f, s) {
    c.draw(f, arc(0, s * 0.1, s * 0.75, s * 0.6, Math.PI * 0.15, Math.PI * 0.85, 0, 12, s * 0.5), { weight: 1.25 })
    c.dot(f, -s * 0.6, s * 0.3, s * 0.12, { z: s * 0.3 })
    c.dot(f, s * 0.6, s * 0.3, s * 0.12, { z: s * 0.3 })
  },

  triangle(c, f, s) {
    const z = s * 0.58
    c.draw(f, [[0, -s * 1.1, z * 0.2], [s * 0.45, s * 0.6, z * 0.8], [-s * 0.45, s * 0.6, z * 0.8]],
      { weight: 1, rough: 1.2 })
  },

  tick(c, f, s) {
    const z = s * 0.55
    c.draw(f, [[0, -s * 0.5, z * 0.4], [0, s * 0.35, z], [-s * 0.45, s * 0.4, z * 0.4]], { weight: 1.25 })
  },

  nostrils(c, f, s) {
    c.dot(f, -s * 0.42, s * 0.2, s * 0.14, { z: s * 0.35 })
    c.dot(f, s * 0.42, s * 0.2, s * 0.14, { z: s * 0.35 })
  },

  snout(c, f, s) {
    const z = s * 0.58
    c.draw(f, curve([
      [-s * 0.7, -s * 0.3, z * 0.3],
      [0, s * 0.5, z],
      [s * 0.7, -s * 0.3, z * 0.3],
    ]), { weight: 1.3 })
    c.draw(f, [[0, s * 0.45, z], [0, s * 0.9, z * 0.7]], { weight: 0.6, passes: 1 })
  },

  pinch(c, f, s) {
    const z = s * 0.6
    c.draw(f, curve([[0, -s * 1.5, 0], [s * 0.06, -s * 0.5, z * 0.5], [s * 0.1, s * 0.3, z * 0.9]]),
      { weight: 0.9 })
    c.draw(f, arc(0, s * 0.35, s * 0.3, s * 0.22, Math.PI * 0.05, Math.PI * 0.95, 0, 8, z * 0.8), { weight: 0.7, passes: 1 })
  },
}

export const NOSE_WEIGHTS: Weighted<string> = [
  ['hook', 15], ['long', 11], ['beak', 8], ['roman', 6], ['ski', 6],
  ['wide', 6], ['button', 5], ['blob', 4], ['triangle', 4], ['tick', 4],
  ['snout', 3], ['pinch', 4], ['nostrils', 2],
]

export function drawNose(c: FeatureContext): void {
  const g = c.g.nose
  const f = c.head.frame(g.u, g.v);
  (noses[g.type] || noses.hook)(c, g.flip ? c.mirrorFrame(f) : f, g.size)
}
