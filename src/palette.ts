/**
 * Colours lifted from the reference plates: aged paper, muted watercolour
 * washes, ink that is never quite black.
 */

import type { Accents, Palette, PaletteOptions } from './types'

import type { Rng } from './rng'

export const PAPER = ['#efe9dd', '#ece5d8', '#f2ecdf', '#e9e1d2']

export const INK = ['#2b2723', '#26221f', '#332b26', '#2a2e38', '#3a2c26']

export const SKIN = [
  '#f2ddc6', '#eccfae', '#e3b98f', '#d9a878', '#c78d5e',
  '#a96b44', '#8a5133', '#6d3f28', '#f6e6d3', '#dfc0a4',
]

export const HAIR = [
  '#1d1a18', '#241f1d', '#3b2a20', '#5b3d28', '#7a5334',
  '#a8763f', '#c9a05a', '#d9c07a', '#2c3348', '#43324f',
  '#6b4a6b', '#8a8f96', '#b9bdc0', '#e4ded2', '#4a5a4a',
]

export const WASH = [
  '#a9c3ce', '#c6d6c4', '#e2c9c4', '#d8ce9d', '#bba9c9',
  '#cfc5b2', '#9fb8ad', '#e0baa1', '#c9c9d6', '#dcd3c0',
  '#b7c9d4', '#e6d2b8', '#cbbfd8', '#aab8a6', '#e3c0b6',
]

export const CLOTH = [
  '#7f8f7a', '#8a6f5c', '#5f6d80', '#9a5f57', '#6b6a7d',
  '#8f8256', '#4f5f5a', '#a8794f',
]

export const ACCENT: Accents = {
  red: '#b4483f',
  cyan: '#5a95a8',
  blue: '#4a5f8a',
  green: '#6f8a5c',
  yellow: '#d9b455',
  pink: '#d99a9a',
  purple: '#7a5c8a',
}

/** Pull a coherent set of colours for one face. */
export function makePalette(rng: Rng, opts: PaletteOptions = {}): Palette {
  const paper = opts.paper ?? rng.pick(PAPER)
  const ink = opts.ink ?? rng.pick(INK)
  const skin = opts.skin ?? rng.pickWeighted<string | null>([
    [rng.pick(SKIN.slice(0, 4)), 5],
    [rng.pick(SKIN.slice(4, 8)), 3],
    [null, 4], // no fill: pure line drawing, like the ink-only plates
  ])
  const hair = opts.hair ?? rng.pickWeighted([
    [HAIR[rng.int(0, 1)], 6],      // the ubiquitous solid black cap
    [rng.pick(HAIR.slice(2, 8)), 4],
    [rng.pick(HAIR.slice(8)), 2],
  ])
  const wash = opts.wash ?? rng.pick(WASH)
  const cloth = opts.cloth ?? rng.pick(CLOTH)

  return { paper, ink, skin, hair, wash, cloth, accent: ACCENT }
}
