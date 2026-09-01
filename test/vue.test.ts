import test from 'node:test'
import assert from 'node:assert/strict'
import { createSSRApp, h, ref } from 'vue'
import { renderToString } from 'vue/server-renderer'

import { Face, Plate, useFace, useTurntable } from '../src/vue/index'

import type { Component } from 'vue'

const render = (c: Component, props: Record<string, unknown> = {}) =>
  renderToString(createSSRApp({ render: () => h(c, props) }))

test('<Face> renders an inline svg with a described label', async () => {
  const html = await render(Face, { seed: 'ada', width: 300 })
  assert.match(html, /<svg /)
  assert.match(html, /role="img"/)
  assert.match(html, /aria-label="[^"]*eyes[^"]*"/)
  assert.ok(!html.includes('NaN'))
})

test('<Face> is a pure function of its props', async () => {
  const a = await render(Face, { seed: 'ada', yaw: 30 })
  const b = await render(Face, { seed: 'ada', yaw: 30 })
  const c = await render(Face, { seed: 'ada', yaw: 31 })
  assert.equal(a, b)
  assert.notEqual(a, c)
})

test('<Face> honours pinned traits', async () => {
  const html = await render(Face, { seed: 'ada', traits: { nose: 'hook', hair: 'mohawk' } })
  assert.match(html, /mohawk hair/)
  assert.match(html, /hook nose/)
})

test('<Plate> renders every cell and labels the count', async () => {
  const html = await render(Plate, { cols: 4, rows: 3, seed: 'p' })
  assert.match(html, /aria-label="12 doodle faces"/)
  assert.ok(!html.includes('NaN'))
})

test('useFace tracks a ref', () => {
  const yaw = ref(0)
  const { svg, description } = useFace(() => ({ seed: 'ada', yaw: yaw.value }))
  const front = svg.value
  assert.match(description.value, /eyes/)
  yaw.value = 45
  assert.notEqual(svg.value, front, 'turning the head should redraw it')
})

test('useTurntable clamps a drag and resets', () => {
  const { yaw, pitch, reset, bind } = useTurntable({ maxYaw: 90 })
  const handlers = bind.value as Record<string, (e: PointerEvent) => void>
  handlers.onPointerdown({ clientX: 0, clientY: 0, currentTarget: null } as unknown as PointerEvent)
  handlers.onPointermove({ clientX: 100, clientY: 0 } as unknown as PointerEvent)
  assert.equal(yaw.value, 40)
  handlers.onPointermove({ clientX: 100000, clientY: 0 } as unknown as PointerEvent)
  assert.equal(yaw.value, 90, 'yaw should clamp')
  handlers.onPointerup({} as PointerEvent)
  reset()
  assert.equal(yaw.value, 0)
  assert.equal(pitch.value, 0)
})

test('a caller-supplied colour cannot break out of an attribute', async () => {
  const html = await render(Face, { seed: 'ada', background: '"><script>alert(1)</script>' })
  assert.ok(!html.includes('<script>'), 'the injected tag survived escaping')
})
