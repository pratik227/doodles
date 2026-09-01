import test from 'node:test'
import assert from 'node:assert/strict'
import { renderToStaticMarkup } from 'react-dom/server'

import { Face, Plate, faceSVG } from '../src/react/index'

test('<Face> renders an inline svg with a described label', () => {
  const html = renderToStaticMarkup(<Face seed="ada" width={300} />)
  assert.match(html, /<svg /)
  assert.match(html, /role="img"/)
  assert.match(html, /aria-label="[^"]*eyes[^"]*"/)
  assert.ok(!html.includes('NaN'))
})

test('<Face> is a pure function of its props', () => {
  const a = renderToStaticMarkup(<Face seed="ada" yaw={30} />)
  const b = renderToStaticMarkup(<Face seed="ada" yaw={30} />)
  const c = renderToStaticMarkup(<Face seed="ada" yaw={31} />)
  assert.equal(a, b)
  assert.notEqual(a, c)
})

test('<Face> takes degrees, matching the CLI', () => {
  const component = renderToStaticMarkup(<Face seed="ada" yaw={40} width={320} />)
  const direct = faceSVG({ seed: 'ada', yaw: 40, width: 320 })
  assert.ok(component.includes(direct.svg))
})

test('<Face> honours pinned traits', () => {
  const html = renderToStaticMarkup(
    <Face seed="ada" traits={{ nose: 'hook', hair: 'mohawk' }} />,
  )
  assert.match(html, /mohawk hair/)
  assert.match(html, /hook nose/)
})

test('<Face> sizes the box from width, portrait by default', () => {
  const html = renderToStaticMarkup(<Face seed="ada" width={200} />)
  assert.match(html, /width="200" height="240"/)
})

test('<Plate> renders every cell and labels the count', () => {
  const html = renderToStaticMarkup(<Plate cols={4} rows={3} seed="p" />)
  assert.match(html, /aria-label="12 doodle faces"/)
  assert.ok(!html.includes('NaN'))
})

test('a caller-supplied colour cannot break out of an attribute', () => {
  const html = renderToStaticMarkup(
    <Face seed="ada" background={'"><script>alert(1)</script>'} />,
  )
  assert.ok(!html.includes('<script>'), 'the injected tag survived escaping')
  assert.match(html, /&quot;&gt;&lt;script&gt;/)
})
