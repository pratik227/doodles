#!/usr/bin/env node
/**
 * naives CLI
 *
 *   naives face   --seed bob --yaw 25 -o bob.svg
 *   naives plate  --cols 6 --rows 8 --seed monday -o plate.svg
 *   naives turn   --seed bob --frames 12 -o turn.svg
 *   naives sheet  --category eyes -o eyes.svg
 *   naives list   [category]
 *   naives genome --seed bob
 */

import { describe, makeGenome } from '../src/genome'
import { dirname, resolve } from 'node:path'
import { mkdirSync, writeFileSync } from 'node:fs'

import { PAPER } from '../src/palette'
import { Rng } from '../src/rng'
import { SVGSurface } from '../src/surfaces/svg'
import { catalogue } from '../src/index'
import { renderFace } from '../src/face'
import { renderPlate } from '../src/plate'

import type { Overrides } from '../src/types'

/** Parsed flags. `_` holds the positional arguments. */
interface Args {
  _: string[]
  [flag: string]: string | boolean | string[]
}

function parseArgs(argv: string[]): Args {
  const out: Args = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=')
      if (v !== undefined) out[k] = v
      else if (argv[i + 1] && !argv[i + 1].startsWith('-')) out[k] = argv[++i]
      else out[k] = true
    } else if (a.startsWith('-') && a.length === 2) {
      out[a.slice(1)] = argv[i + 1] && !argv[i + 1].startsWith('-') ? argv[++i] : true
    } else out._.push(a)
  }

  return out
}

type Flag = string | boolean | string[] | undefined

const num = (v: Flag, d: number): number => (v === undefined ? d : Number(v))
const deg = (v: Flag, d: number): number => (num(v, d) * Math.PI) / 180
const str = (v: Flag, d: string): string => (typeof v === 'string' ? v : d)

function save(path: string, text: string): void {
  const p = resolve(path)
  mkdirSync(dirname(p), { recursive: true })
  writeFileSync(p, text)
  const kb = (Buffer.byteLength(text) / 1024).toFixed(0)
  console.log(`wrote ${path}  (${kb} kB)`)
}

const args = parseArgs(process.argv.slice(2))
const cmd = args._[0] || 'plate'
const out = (args.o ?? args.out) as string | undefined

if (args.help || args.h || cmd === 'help') {
  console.log(`naives -- algorithmic doodle faces

  naives face   [--seed s] [--yaw deg] [--pitch deg] [--roll deg] [--size px] [-o file.svg]
  naives plate  [--cols 6] [--rows 8] [--seed s] [--turn deg] [--width px] [-o file.svg]
  naives turn   [--seed s] [--frames 12] [--sweep deg] [-o file.svg]
  naives sheet  --category eyes|nose|mouth|hair|hat|beard|... [-o file.svg]
  naives genome [--seed s] [--json]
  naives list   [category]

  Any feature can be pinned:  naives face --nose hook --eyes.left.type spiral
`)
  process.exit(0)
}

// Collect --nose hook / --hair.type mohawk style overrides into traits.
const KNOWN = new Set(['seed', 'yaw', 'pitch', 'roll', 'size', 'width', 'height', 'cols', 'rows',
  'turn', 'tilt', 'lean', 'frames', 'sweep', 'o', 'out', 'category', 'json', 'paper', 'scale',
  'rough', 'jitter', 'bg', '_'])
const traits: Overrides = {}
for (const [k, v] of Object.entries(args)) {
  if (KNOWN.has(k)) continue
  const path = k.split('.')
  let node = traits
  while (path.length > 1) {
    const p = path.shift()!
    node[p] = node[p] || {}
    node = node[p]
  }
  const last = path[0]
  const val = v === 'true' ? true : v === 'false' ? false : Number.isNaN(Number(v)) ? v : Number(v)
  if (path.length === 1 && node === traits) node[last] = val
  else node[last] = val
}

if (cmd === 'face') {
  const size = num(args.size, 440)
  const s = new SVGSurface({ width: size, height: Math.round(size * 1.2) })
  s.background(str(args.bg, PAPER[0]))
  s.paperTexture({ opacity: 0.25 })
  const { genome } = renderFace(s, {
    seed: str(args.seed, 'naive'),
    scale: size * 0.3,
    yaw: deg(args.yaw, 0), pitch: deg(args.pitch, 0), roll: deg(args.roll, 0),
    rough: num(args.rough, 1),
    traits,
  })
  save(out || 'face.svg', s.toString())
  console.log(describe(genome))
} else if (cmd === 'plate') {
  const cols = num(args.cols, 6)
  const rows = num(args.rows, 8)
  const width = num(args.width, 960)
  const height = num(args.height, Math.round((width / cols) * rows * 1.02))
  const s = new SVGSurface({ width, height })
  renderPlate(s, {
    cols, rows,
    seed: str(args.seed, 'plate'),
    turn: deg(args.turn, 0), tilt: deg(args.tilt, 0), lean: deg(args.lean, 3),
    scaleFactor: num(args.scale, 0.3),
    rough: num(args.rough, 1),
    paper: args.paper !== 'false',
  })
  save(out || 'plate.svg', s.toString())
} else if (cmd === 'turn') {
  // One face, rotated -- proof that the features live on a skull.
  const frames = num(args.frames, 12)
  const sweep = deg(args.sweep, 150)
  const cols = Math.min(frames, 6)
  const rows = Math.ceil(frames / cols)
  const cell = 240
  const s = new SVGSurface({ width: cell * cols, height: cell * rows })
  s.background(PAPER[1])
  s.paperTexture({ opacity: 0.25 })
  const g = makeGenome(str(args.seed, 'naive'), traits)
  for (let i = 0; i < frames; i++) {
    const t = frames === 1 ? 0 : i / (frames - 1)
    renderFace(s, {
      genome: g,
      cx: cell * (0.5 + (i % cols)),
      cy: cell * (0.5 + Math.floor(i / cols)),
      scale: cell * 0.3,
      yaw: -sweep / 2 + sweep * t,
      pitch: Math.sin(t * Math.PI * 2) * 0.18,
      roll: 0,
      backdrop: i === 0,
    })
  }
  save(out || 'turn.svg', s.toString())
  console.log(describe(g))
} else if (cmd === 'sheet') {
  // Every variant of one category, side by side, everything else held still.
  const cat = str(args.category, 'eyes')
  const all = await catalogue()
  const list = all[cat]
  if (!list) {
    console.error(`unknown category. try: ${Object.keys(all).join(', ')}`); process.exit(1)
  }
  const cols = Math.min(6, list.length)
  const rows = Math.ceil(list.length / cols)
  const cell = 230
  const s = new SVGSurface({ width: cell * cols, height: cell * rows })
  s.background(PAPER[0])
  s.paperTexture({ opacity: 0.22 })
  const rng = new Rng('sheet')
  list.forEach((name, i) => {
    const t: Overrides = { ...traits }
    if (cat === 'eyes') t.eyes = { left: { type: name, size: 0.16 }, right: { type: name, size: 0.16 } }
    else if (cat === 'accessories') t.accessories = [{ type: name, ...defaultsFor(name, rng) }]
    else if (cat === 'marks') t.marks = [{ type: name, count: 6, color: '#c98f8f', style: 'wash', u: 0.7, v: 0 }]
    else t[cat] = name
    renderFace(s, {
      seed: `sheet-${cat}`,
      traits: t,
      cx: cell * (0.5 + (i % cols)),
      cy: cell * (0.5 + Math.floor(i / cols)),
      scale: cell * 0.29,
      backdrop: false,
    })
  })
  save(out || `sheet-${cat}.svg`, s.toString())
  console.log(`${list.length} variants: ${list.join(', ')}`)
} else if (cmd === 'genome') {
  const g = makeGenome(str(args.seed, 'naive'), traits)
  if (args.json) console.log(JSON.stringify(g, (k, v) => (typeof v === 'function' ? '<fn>' : v), 2))
  else console.log(describe(g))
} else if (cmd === 'list') {
  const all = await catalogue()
  const only = args._[1]
  for (const [k, v] of Object.entries(all)) {
    if (only && k !== only) continue
    console.log(`${k.padEnd(12)} ${v.length.toString().padStart(3)}  ${v.join(' ')}`)
  }
  console.log(`\n${Object.values(all).reduce((a, b) => a + b.length, 0)} variants total`)
} else {
  console.error(`unknown command "${cmd}". try: naives help`)
  process.exit(1)
}

/** One plausible set of knobs, so a contact sheet shows every accessory. */
function defaultsFor(_name: string, _rng: Rng) {
  const d = { size: 0.2, color: '#2b2723', weight: 1, shape: 'round', side: 1, u: 0.9, v: 0.6, buttons: true }

  return d
}
