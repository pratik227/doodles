import test from 'node:test'
import assert from 'node:assert/strict'

import { drawFaceOnCanvas, drawPlateOnCanvas, pickFace } from '../src/integrations/core'

/** Just enough CanvasRenderingContext2D to record what the pen asked for. */
function stubCanvas() {
  const calls: string[] = []
  const ctx = new Proxy({} as Record<string, unknown>, {
    get(target, prop: string) {
      if (prop === 'canvas') return canvas
      if (!(prop in target)) {
        target[prop] = (...args: unknown[]) => {
          calls.push(prop)
          for (const a of args) {
            assert.ok(typeof a !== 'number' || Number.isFinite(a),
              `${prop}() got a non-finite coordinate`)
          }
        }
      }

      return target[prop]
    },
    set() {
      return true
    },
  })
  const canvas = {
    width: 0,
    height: 0,
    style: {} as Record<string, string>,
    getContext: () => ctx,
  }

  return { canvas, calls }
}

test('a face paints to a 2D context without a single NaN', () => {
  const { canvas, calls } = stubCanvas()
  const res = drawFaceOnCanvas(canvas as never, { seed: 'ada', yaw: 35, width: 300 })
  assert.ok(res, 'expected a genome back')
  assert.match(res.genome.eyes.left.type, /\w/)
  assert.ok(calls.includes('beginPath') && calls.includes('stroke'))
  assert.equal(canvas.width, 300)
  assert.equal(canvas.height, 360)
  assert.equal(canvas.style.width, '300px')
})

test('a plate paints every cell and reports where they landed', () => {
  const { canvas } = stubCanvas()
  const faces = drawPlateOnCanvas(canvas as never, { cols: 3, rows: 2, seed: 'p', width: 600 })
  assert.equal(faces.length, 6)
  assert.equal(new Set(faces.map((f) => f.seed)).size, 6)
})

test('pickFace finds the face under a point, and nothing in the gutter', () => {
  const { canvas } = stubCanvas()
  const faces = drawPlateOnCanvas(canvas as never, { cols: 3, rows: 2, seed: 'p', width: 600 })
  const target = faces[4]
  assert.equal(pickFace(faces, target.cx, target.cy)?.seed, target.seed)
  assert.equal(pickFace(faces, -5000, -5000), null)
})
