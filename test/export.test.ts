import test from 'node:test'
import assert from 'node:assert/strict'

import { canRecordVideo, faceFile, faceVideoFile, pickVideoMime, plateFile } from '../src/integrations/export'
import { poses } from '../src/poses'

// --------------------------------------------------------------- svg export

test('a face comes out as a File, named after its seed', async () => {
  const file = await faceFile({ seed: 'ada', format: 'svg', width: 200 })
  assert.ok(file instanceof File)
  assert.equal(file.name, 'naives-ada.svg')
  assert.equal(file.type, 'image/svg+xml')
  const text = await file.text()
  assert.match(text, /^<svg /)
  assert.match(text, /width="200" height="240"/)
  assert.ok(!text.includes('NaN'))
})

test('a plate comes out as a File too', async () => {
  const file = await plateFile({ seed: 'monday', format: 'svg', cols: 3, rows: 2, width: 600 })
  assert.equal(file.name, 'naives-monday.svg')
  assert.match(await file.text(), /^<svg /)
})

test('the filename can be given, and odd seeds are made safe', async () => {
  assert.equal((await faceFile({ format: 'svg', filename: 'me.svg' })).name, 'me.svg')
  assert.equal((await faceFile({ seed: 'a b/c:d', format: 'svg' })).name, 'naives-a-b-c-d.svg')
})

// ------------------------------------------------------------ raster export

/** A canvas that records what it was asked to encode. */
function stubOffscreen() {
  const seen: {
    width: number, height: number, type?: string, quality?: number, calls: string[],
  } = { width: 0, height: 0, calls: [] }
  class Stub {
    width: number
    height: number
    constructor(w: number, h: number) {
      this.width = w; this.height = h
      seen.width = w; seen.height = h
    }
    getContext() {
      return new Proxy({} as Record<string, unknown>, {
        get: (t, p: string) => (p === 'canvas' ? this : (t[p] ??= () => seen.calls.push(p))),
        set: () => true,
      })
    }
    convertToBlob(o: { type: string, quality: number }) {
      seen.type = o.type; seen.quality = o.quality

      return Promise.resolve(new Blob(['fake'], { type: o.type }))
    }
  }
  const prev = (globalThis as Record<string, unknown>).OffscreenCanvas;
  (globalThis as Record<string, unknown>).OffscreenCanvas = Stub

  return {
    seen,
    restore: () => {
      (globalThis as Record<string, unknown>).OffscreenCanvas = prev
    },
  }
}

test('png, jpeg and webp all round-trip through a canvas', async () => {
  const stub = stubOffscreen()
  try {
    for (const [format, mime, ext] of [
      ['png', 'image/png', 'png'],
      ['jpeg', 'image/jpeg', 'jpg'],
      ['webp', 'image/webp', 'webp'],
    ] as const) {
      const file = await faceFile({ seed: 'ada', format, width: 200, quality: 0.8 })
      assert.equal(file.type, mime, `${format} mime`)
      assert.equal(file.name, `naives-ada.${ext}`)
      assert.equal(stub.seen.type, mime)
      assert.equal(stub.seen.quality, 0.8)
    }
  } finally {
    stub.restore()
  }
})

test('jpeg gets an opaque ground -- the face\'s own paper, not a black box', async () => {
  const stub = stubOffscreen()
  try {
    await faceFile({ seed: 'ada', format: 'jpeg', width: 120 })
    assert.ok(stub.seen.calls.includes('fillRect'), 'jpeg was left transparent')

    stub.seen.calls.length = 0
    await faceFile({ seed: 'ada', format: 'png', width: 120 })
    assert.ok(!stub.seen.calls.includes('fillRect'), 'png should keep its alpha')
  } finally {
    stub.restore()
  }
})

test('an explicit background always wins', async () => {
  const svg = await (await faceFile({ seed: 'ada', format: 'svg', background: '#123456' })).text()
  assert.match(svg, /fill="#123456"/)
  const bare = await (await faceFile({ seed: 'ada', format: 'svg' })).text()
  assert.ok(!/<rect width="100%"/.test(bare), 'svg should stay transparent by default')
})

test('pixelRatio multiplies the backing store, not the layout size', async () => {
  const stub = stubOffscreen()
  try {
    await faceFile({ seed: 'ada', width: 200, pixelRatio: 3 })
    assert.equal(stub.seen.width, 600)
    assert.equal(stub.seen.height, 720)
  } finally {
    stub.restore()
  }
})

// ---------------------------------------------------------------- animation

test('video reports itself unsupported when there is no MediaRecorder', async () => {
  assert.equal(canRecordVideo(), false)
  assert.equal(pickVideoMime(), null)
  await assert.rejects(() => faceVideoFile({ seed: 'ada' }), /cannot record webm/)
})

/** Enough MediaRecorder and <canvas> to drive a real recording loop. */
function stubRecorder() {
  const g = globalThis as Record<string, unknown>
  const prev = { MR: g.MediaRecorder, doc: g.document, OC: g.OffscreenCanvas }
  const track = { stop() {} }
  const painted: number[] = []

  class Recorder {
    state = 'inactive'
    ondataavailable: ((e: { data: Blob }) => void) | null = null
    onstop: (() => void) | null = null
    onerror: (() => void) | null = null
    static isTypeSupported = (t: string) => t === 'video/webm;codecs=vp9'
    constructor(public stream: unknown, public opts: { mimeType: string }) {}
    start() {
      this.state = 'recording'
    }
    stop() {
      this.state = 'inactive'
      this.ondataavailable?.({ data: new Blob(['frame'], { type: this.opts.mimeType }) })
      this.onstop?.()
    }
  }

  const canvas = {
    width: 0,
    height: 0,
    style: {} as Record<string, string>,
    getContext: () => new Proxy({} as Record<string, unknown>, {
      get(t, p: string) {
        if (p === 'canvas') return canvas
        if (p === 'setTransform') return () => painted.push(1)

        return (t[p] ??= () => {})
      },
      set: () => true,
    }),
    captureStream: () => ({ getTracks: () => [track] }),
  }

  g.MediaRecorder = Recorder
  g.document = { createElement: () => canvas }
  delete g.OffscreenCanvas

  return {
    painted,
    restore() {
      g.MediaRecorder = prev.MR; g.document = prev.doc
      if (prev.OC) g.OffscreenCanvas = prev.OC
    },
  }
}

test('a clip records, loops through its pose, and lands as a webm File', async () => {
  const stub = stubRecorder()
  try {
    assert.equal(canRecordVideo(), true)
    assert.equal(pickVideoMime(), 'video/webm;codecs=vp9')

    const progress: number[] = []
    const file = await faceVideoFile({
      seed: 'ada',
      pose: 'nod',
      duration: 0.3,          // the same code path as ten seconds, 30x faster
      fps: 20,
      width: 120,
      onProgress: (p) => progress.push(p),
    })

    assert.ok(file instanceof File)
    assert.equal(file.name, 'naives-ada.webm')
    assert.equal(file.type, 'video/webm;codecs=vp9')
    assert.ok(file.size > 0)
    assert.ok(stub.painted.length > 2, `only ${stub.painted.length} frames drawn`)
    assert.equal(progress.at(-1), 1)
    assert.ok(progress.every((p, i) => i === 0 || p >= progress[i - 1]), 'progress went backwards')
  } finally {
    stub.restore()
  }
})

test('a custom pose drives the clip just like a built-in one', async () => {
  const stub = stubRecorder()
  const seen: number[] = []
  try {
    await faceVideoFile({
      seed: 'ada',
      duration: 0.2,
      fps: 20,
      width: 120,
      pose: (t) => {
        seen.push(t)

        return poses.nod(t)
      },
    })
    assert.ok(seen.length > 2)
    assert.ok(seen.every((t) => t >= 0 && t < 1), 't left the unit loop')
  } finally {
    stub.restore()
  }
})

test('recording can be aborted', async () => {
  const stub = stubRecorder()
  try {
    const controller = new AbortController()
    setTimeout(() => controller.abort(), 40)
    await assert.rejects(
      () => faceVideoFile({ seed: 'ada', duration: 5, width: 120, signal: controller.signal }),
      (e: Error) => e.name === 'AbortError',
    )
  } finally {
    stub.restore()
  }
})
