# naives

Algorithmic doodle faces, in plain JavaScript. No dependencies.

The trick that makes it work: **the features are not positioned on a flat
canvas.** Each one owns a coordinate on an invisible 3D head — a longitude and
a latitude on a lumpy ellipsoid — and asks that head where it lands on screen.
So you can turn the head, and everything comes along: features slide and
foreshorten, the far ear goes behind the cheek, the hairline wraps, and the
nose keeps sticking out because it was never flat to begin with.

Same code path draws a frontal 48-face plate and a head at 70°.

```txt
                 v (latitude)
                    ▲                    features live here, on the surface:
                 ___│___                   eye   (u = ±0.45, v = +0.10)
              ,-'   │   `-.                nose  (u =  0,    v = -0.05, lift out)
             /      │      \               mouth (u =  0,    v = -0.55)
            |    ●  │  ●    |   ──► u      ear   (u = ±1.40, v =  0.00)
            |       │       |   (longitude)
             \   ╰──┴──╯   /             ...then rotate the head and project.
              `-._     _.-'
                  `---'
```

## Quick start

```bash
npx tsx bin/naives.ts plate -o plate.svg          # a 6x8 sheet of faces
npx tsx bin/naives.ts face --seed ada --yaw 40    # one face, turned 40°
npx tsx bin/naives.ts turn --seed ada --frames 12 # one person, twelve angles
npm start                                         # the playground, on :5173
npm test
```

The source is TypeScript, run directly with [tsx][] in development and bundled
with [tsdown][] for publishing. After `npm run build` the CLI is plain Node:
`node lib/bin/naives.js plate -o plate.svg`.

[tsx]: https://tsx.is
[tsdown]: https://tsdown.dev

## React and Vue

Both wrappers ship in the same package, as `naives/react` and `naives/vue`.
They are optional peer dependencies, so installing naives does not drag either
framework in, and the core library never imports them.

```jsx
import { Face, Plate, useTurntable } from 'naives/react'

const { yaw, pitch, bind } = useTurntable()

<Face seed="ada" yaw={yaw} pitch={pitch} width={280} {...bind} />
<Plate cols={6} rows={8} seed="monday" onSelect={(f) => setSeed(f.seed)} />
```

```vue
<script setup>
import { Face, Plate, useTurntable } from 'naives/vue'

const { yaw, pitch, bind } = useTurntable()
</script>

<template>
  <Face seed="ada" :yaw="yaw" :pitch="pitch" :width="280" v-bind="bind" />
  <Plate :cols="6" :rows="8" seed="monday" @select="f => seed = f.seed" />
</template>
```

Angles are **degrees**, the same as the CLI's `--yaw 40` — a slider can be wired
straight to them.

| prop                     | meaning                                                        |
| ------------------------ | -------------------------------------------------------------- |
| `seed`                   | the string or number the whole face is derived from            |
| `yaw` `pitch` `roll`     | degrees                                                        |
| `traits`                 | pin features: `{ nose: 'hook', hair: 'mohawk' }`               |
| `genome`                 | a genome you already have; wins over `seed` and `traits`        |
| `width` `height` `scale` | pixels; height defaults to `width * 1.2`                        |
| `background` `paper`     | page colour, and the grain over it (`true`, `false`, or 0..1)   |
| `backdrop` `rough` `rig` | the wash behind the head, the ink wobble, the debug skull       |
| `as`                     | `"svg"` (default, server-renderable) or `"canvas"`              |

`<Face>` renders inline SVG by default, so it works under SSR and stays crisp
at any zoom; pass `as="canvas"` when you are redrawing every frame. Either way
it carries a generated `aria-label` — *"pear, ring/ring eyes, hook nose, gasp
mouth"* — which you can replace with `label`.

The hooks and composables are there when you want the pieces rather than the
component:

| React                 | Vue                   | gives you                               |
| --------------------- | --------------------- | --------------------------------------- |
| `useFace(opts)`       | `useFace(opts)`       | `svg`, `genome`, `description`          |
| `usePlate(opts)`      | `usePlate(opts)`      | `svg`, `faces`                          |
| `useTurntable(opts)`  | `useTurntable(opts)`  | `yaw`, `pitch`, `bind` for drag-to-turn |
| `useFaceFile(opts)`   | `useFaceFile(opts)`   | a face as a `File` — see below          |
| `usePlateFile(opts)`  | `usePlateFile(opts)`  | a plate as a `File`                     |
| `useFaceVideo(opts)`  | `useFaceVideo(opts)`  | a looping webm as a `File`              |

The Vue composables take a ref, a getter or a plain object, so
`useFace(() => ({ seed, yaw: yaw.value }))` recomputes on its own.

## Files

`useFaceFile` hands back a real `File`, which is what an upload, a `FormData`
or a download link all want.

```jsx
const { create, download, url, pending, error } = useFaceFile({
  seed: 'ada', format: 'webp', width: 512, pixelRatio: 2,
})

await download()                       // straight to the user's disk
const file = await create({ format: 'png' })   // or keep it
await fetch('/avatar', { method: 'POST', body: new FormData(...) })
```

| format | notes                                                            |
| ------ | ---------------------------------------------------------------- |
| `png`  | the default; keeps its transparency                              |
| `jpeg` | no alpha, so it is given the face's own paper colour as a ground |
| `webp` | smallest; `quality` applies                                      |
| `svg`  | no canvas involved, so it works under SSR and stays vector       |

`pixelRatio` multiplies the pixels without changing the layout size, so
`width: 512, pixelRatio: 2` is a 1024px file drawn at full detail rather than
an upscale. The result is named `naives-<seed>.<ext>` unless you pass
`filename`.

Outside a component, the same thing is `faceFile()` / `plateFile()` from
`naives`.

## Poses and animated webm

A **pose** is an orientation as a function of time: it takes `t` from 0 to 1
and returns degrees. Every built-in pose is *periodic*, so a clip rendered
across one full cycle joins back onto itself with no seam.

```js
import { poses, POSE_NAMES, definePose } from 'naives'
```

| pose        | what it does                                        |
| ----------- | --------------------------------------------------- |
| `turntable` | a wide, unhurried look left and right (the default) |
| `spin`      | all the way round, back of the head included        |
| `nod`       | yes                                                 |
| `shake`     | no, twice per loop                                  |
| `sway`      | leaning into the turn, the way a head really moves  |
| `tilt`      | curiosity, or a cocked ear                          |
| `scan`      | a sweep that pauses at each end before starting back |
| `peek`      | still, then a quick glance over the shoulder        |
| `wobble`    | a lazy figure-eight                                 |
| `idle`      | barely moving — alive, but not demanding attention  |

Custom poses are a function, or keyframes that wrap round for you:

```js
definePose((t) => ({ yaw: 40 * Math.sin(t * Math.PI * 2), roll: 6 }))
definePose([{ at: 0, yaw: -30 }, { at: 0.4, yaw: 30, pitch: 10 }])
```

Keep it periodic — value at `t = 1` equal to `t = 0` — and the loop is
seamless. Keyframes get that for free, because the last one eases back into
the first.

```jsx
const { create, download, progress, pending, supported } = useFaceVideo({
  seed: 'ada', pose: 'sway', duration: 10, fps: 24, width: 420,
})

{supported && <button onClick={() => download()} disabled={pending}>
  {pending ? `recording ${Math.round(progress * 100)}%` : 'save webm'}
</button>}
```

Recording goes through `MediaRecorder`, which stamps frames off the wall
clock — **a ten second clip takes ten seconds to record**. That is why there is
a `progress` value and a `cancel()`. `supported` is false where the browser has
no webm recorder; check it before offering the button.

Poses are wired into the playground too: pick one on the *3D head* tab and hit
**WEBM**.

## The playground

`npm start` then open <http://localhost:5173/>. Three views over the same library:

- **Plate** — a grid of faces. Click any face to open it in 3D.
- **3D head** — drag to turn it, or auto-spin. Pin individual features from the
  dropdowns. Tick _show the skull_ to see the invisible head, its latitude
  rings, and a cross at every feature anchor with its outward normal.
- **Turntable** — one genome rendered across a sweep of angles.

PNG and SVG export from any view.

## Library

```js
import { SVGSurface, renderFace, renderPlate, makeGenome } from 'naives';

const svg = new SVGSurface({ width: 400, height: 480, background: '#efe9dd' });
renderFace(svg, { seed: 'ada', scale: 130, yaw: 0.4, pitch: 0.1 });
console.log(svg.toString());
```

In a browser, swap the surface and everything else is identical:

```js
import { Canvas2DSurface, renderFace } from 'naives';
const surface = new Canvas2DSurface(canvas.getContext('2d'), 400, 480);
renderFace(surface, { seed: 'ada', scale: 130 });
```

### A face is a genome

Every face is a pure function of its seed, and the intermediate form is plain
serialisable data. Print it, change one field, hand it back.

```js
const genome = makeGenome('ada');
// { skull: { name: 'potato', rx, ry, rz, lobes, wobble },
//   eyes: { u, v, left: { type: 'slit', size }, right: {...} },
//   nose: { type: 'blob', size, v }, hair: {...}, hat: {...}, ... }

renderFace(svg, { genome, yaw: 0.6 }); // reuse: same person, new angle
renderFace(svg, { seed: 'ada', traits: { nose: 'hook', hair: 'mohawk' } });
renderFace(svg, {
  seed: 'ada',
  traits: { eyes: { left: { type: 'spiral' } } },
});
```

Overrides merge deeply and a bare string sets that category's `type`, so
`{ nose: 'hook' }` is shorthand for `{ nose: { type: 'hook' } }`. The CLI takes
the same paths: `naives face --nose hook --eyes.left.type spiral`.

### The head, on its own

`Head` is useful without any drawing. It answers geometric questions.

```js
import { Head } from 'naives';
const head = new Head({ rx: 1, ry: 1.15, rz: 0.9, scale: 100, yaw: 0.6 });

const f = head.frame(0.45, 0.1); // a drawing frame glued to the skull
f.map(0, 0); // -> [x, y] in pixels
f.map(0.1, 0, 0.2); // 0.1 across the face, 0.2 out of it
f.facing; // > 0 means this skin faces the viewer

head.silhouette(); // the outline, as an exact occluding contour
head.ring({ v: 0.45 }); // a latitude ring: hairlines, hatbands, straps
head.cap({ v: 0.45 }); // everything above that line, bounded by the outline
head.cap({ v: -0.3, below: true }); // ...and everything below it: beards, scarves
```

`cap()` is what hair, hats, beards and masks are built from, which is why they
wrap correctly at any angle instead of sliding off.

## How it draws

| module          | job                                                              |
| --------------- | ---------------------------------------------------------------- |
| `src/head.ts`   | the invisible head: anchors, silhouette, latitude rings, caps    |
| `src/pen.ts`    | the hand: resampling, wobble, double strokes, hatching, scribble |
| `src/surfaces/` | output targets — `SVGSurface`, `Canvas2DSurface` (4 calls each)  |
| `src/genome.ts` | seed → traits                                                    |
| `src/face.ts`   | layer order, and the feature-space helpers                       |
| `src/features/` | 132 variants across 11 categories                                |
| `src/rig.ts`    | draw the invisible head, visibly                                 |
| `src/types.ts`  | the shared vocabulary: points, frames, surfaces, the genome      |

Two details do most of the aesthetic work:

**The silhouette is exact, not sampled.** The screen shadow of an ellipsoid is
the image of the unit circle lying perpendicular to the view-null direction, so
`silhouette()` solves for it directly. Each contour point remembers which skull
direction produced it, which means the hand-drawn lumpiness is welded to the
skull and doesn't swim across the outline as the head turns.

**Nothing is a straight line.** Every stroke is resampled, pushed around by a
smooth AR(1) walk perpendicular to itself, bowed once across its length like a
wrist, drawn twice at different pressure, and allowed to overshoot its ends.

## Feature catalogue

```bash
npm run list                     # all 132 variants
npx tsx bin/naives.ts list eyes
npm run sheets                   # a contact sheet per category, in out/
```

eyes (17) · nose (13) · mouth (16) · brow (9) · ears (5) · hair (17) ·
hat (11) · beard (11) · accessories (12) · marks (10) · backdrop (11)

## CLI

```txt
naives face   [--seed s] [--yaw deg] [--pitch deg] [--roll deg] [--size px] [-o f.svg]
naives plate  [--cols 6] [--rows 8] [--seed s] [--turn deg] [--tilt deg] [-o f.svg]
naives turn   [--seed s] [--frames 12] [--sweep deg] [-o f.svg]
naives sheet  --category eyes|nose|mouth|brow|ears|hair|hat|beard|accessories|marks|backdrop
naives genome [--seed s] [--json]
naives list   [category]
```

Any trait can be pinned on any command.

## Deploy

`npm run build` bundles the playground into a single `app.js` beside the page —
about 123 kB, with nothing else to fetch.

```bash
npm run build          # -> dist/
npm start              # build, then preview exactly what will be deployed, on :5173
```

`netlify.toml` is already set up (`command = "npm run build"`, `publish = "dist"`),
so any of these work:

```bash
# 1. one-off, no account plumbing: drag dist/ onto app.netlify.com/drop

# 2. from the terminal
npx netlify-cli deploy --prod        # or: npm i -g netlify-cli && netlify deploy --prod

# 3. connect the Git repo in the Netlify UI and it reads netlify.toml
```

Nothing runs on the server — no functions, no env vars, no origin requests. It
is a static page that draws everything in the browser, so it also deploys
unchanged to GitHub Pages, Cloudflare Pages or Vercel; point them at
`npm run build` and `dist`.

## Credit

The look is modelled on Mannay's hand-drawn face plates. This is an attempt to
reach the same place with code — not a copy of any individual drawing.

MIT.
