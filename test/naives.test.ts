import test from 'node:test'
import assert from 'node:assert/strict'

import { Rng } from '../src/rng'
import { Head } from '../src/head'
import { SVGSurface } from '../src/surfaces/svg'
import { makeGenome, describe as describeFace } from '../src/genome'
import { renderFace } from '../src/face'
import { renderPlate } from '../src/plate'

import type { Overrides, Pt } from '../src/types'
import type { RenderFaceOptions } from '../src/face'
import { catalogue } from '../src/index'

const render = (opts: RenderFaceOptions) => {
  const s = new SVGSurface({ width: 300, height: 360 })
  const res = renderFace(s, { scale: 90, ...opts })
  
return { svg: s.toString(), ...res }
}

test('the same seed always gives the same numbers', () => {
  const a = new Rng('hello')
  const b = new Rng('hello')
  const c = new Rng('hello!')
  const seqA = Array.from({ length: 8 }, () => a.next())
  const seqB = Array.from({ length: 8 }, () => b.next())
  const seqC = Array.from({ length: 8 }, () => c.next())
  assert.deepEqual(seqA, seqB)
  assert.notDeepEqual(seqA, seqC)
})

test('the same seed always gives the same face', () => {
  assert.equal(render({ seed: 'stable' }).svg, render({ seed: 'stable' }).svg)
  assert.notEqual(render({ seed: 'stable' }).svg, render({ seed: 'other' }).svg)
})

test('a genome is plain data and round-trips through an override', () => {
  const g = makeGenome('gene')
  assert.equal(typeof g.eyes.left.type, 'string')
  assert.equal(makeGenome('gene', { nose: 'hook' }).nose.type, 'hook')
  assert.equal(makeGenome('gene', { eyes: { left: { type: 'spiral' } } }).eyes.left.type, 'spiral')
  assert.match(describeFace(g), /eyes/)
})

test('eyes never collide over the bridge of the nose', () => {
  for (let i = 0; i < 400; i++) {
    const g = makeGenome(`eye-${i}`)
    const widest = Math.max(g.eyes.left.size, g.eyes.right.size)
    assert.ok(Math.sin(g.eyes.u) > widest, `seed eye-${i}: eyes overlap`)
  }
})

test('beards stay below the eyes', () => {
  for (let i = 0; i < 400; i++) {
    const g = makeGenome(`beard-${i}`)
    assert.ok(g.beard.v < g.eyes.v, `seed beard-${i}: beard is over the eyes`)
  }
})

test('features stay on the head', () => {
  for (let i = 0; i < 60; i++) {
    const g = makeGenome(`fit-${i}`)
    const head = new Head({ ...g.skull, scale: 100, cx: 0, cy: 0 })
    for (const yaw of [0, 0.5, 1.1]) {
      head.orient(yaw, 0.1, 0)
      const b = head.bounds()
      const slack = 8   // features may sit a little proud of the outline
      for (const [u, v] of [[g.eyes.u, g.eyes.v], [-g.eyes.u, g.eyes.v], [g.mouth.u, g.mouth.v], [0, g.brow.v]]) {
        const f = head.frame(u, v)
        assert.ok(f.o[0] > b.x0 - slack && f.o[0] < b.x1 + slack, `fit-${i} yaw ${yaw}: anchor off the head`)
        assert.ok(f.o[1] > b.y0 - slack && f.o[1] < b.y1 + slack, `fit-${i} yaw ${yaw}: anchor off the head`)
      }
    }
  }
})

test('turning the head hides the far side', () => {
  const head = new Head({ scale: 100 })
  head.orient(0, 0, 0)
  assert.ok(head.frame(0.45, 0.1).facing > 0.8, 'front-on eye should face the viewer')
  head.orient(1.4, 0, 0)
  assert.ok(head.frame(0.45, 0.1).facing < 0, 'eye should be hidden at near-profile')
  assert.ok(head.frame(-0.45, 0.1).facing > 0.5, 'other eye should still be visible')
})

test('the silhouette is a closed loop that scales with the skull', () => {
  const head = new Head({ scale: 100, rx: 1, ry: 1.2, rz: 0.9 })
  const { pts } = head.silhouette(96)
  assert.equal(pts.length, 96)
  const b = head.bounds()
  assert.ok(Math.abs(b.w - 200) < 25, `width ${b.w}`)
  assert.ok(Math.abs(b.h - 240) < 30, `height ${b.h}`)
})

test('caps cover a sane slice of the face, at every angle', () => {
  const head = new Head({ scale: 100 })
  const area = (p: Pt[]) => {
    let a = 0
    for (let i = 0; i < p.length; i++) {
      const q = p[(i + 1) % p.length]
      a += p[i][0] * q[1] - q[0] * p[i][1]
    }
    
return Math.abs(a / 2)
  }
  for (const yaw of [0, 0.4, 0.9, 1.3]) {
    head.orient(yaw, 0.1, 0)
    const face = area(head.silhouette().pts)
    const hair = area(head.cap({ v: 0.45 }).poly) / face
    const beard = area(head.cap({ v: -0.3, below: true }).poly) / face
    assert.ok(hair > 0.05 && hair < 0.4, `yaw ${yaw}: hair covers ${(hair * 100) | 0}%`)
    assert.ok(beard > 0.1 && beard < 0.5, `yaw ${yaw}: beard covers ${(beard * 100) | 0}%`)
  }
})

test('every feature variant renders', async () => {
  const cat = await catalogue()
  for (const [category, variants] of Object.entries(cat)) {
    for (const name of variants) {
      const traits: Overrides = category === 'eyes'
        ? { eyes: { left: { type: name }, right: { type: name } } }
        : category === 'accessories'
          ? { accessories: [{ type: name, size: 0.2, color: '#2b2723', weight: 1, shape: 'round', side: 1, u: 0.9, v: 0.6 }] }
          : category === 'marks'
            ? { marks: [{ type: name, count: 5, color: '#c98f8f', style: 'wash', u: 0.7, v: 0 }] }
            : { [category]: name }
      for (const yaw of [0, 0.8]) {
        const { svg } = render({ seed: `v-${category}-${name}`, traits, yaw })
        assert.ok(svg.length > 400, `${category}/${name} at yaw ${yaw} drew nothing`)
        assert.ok(!svg.includes('NaN'), `${category}/${name} at yaw ${yaw} produced NaN coordinates`)
      }
    }
  }
})

test('a plate reports one genome per cell', () => {
  const s = new SVGSurface({ width: 600, height: 400 })
  const faces = renderPlate(s, { cols: 4, rows: 3, seed: 'p' })
  assert.equal(faces.length, 12)
  assert.equal(new Set(faces.map((f) => f.seed)).size, 12)
  assert.ok(!s.toString().includes('NaN'))
})
