/**
 * Library usage, in Node, writing SVG files. Run: node examples/basic.js
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import {
  SVGSurface, renderFace, renderPlate, makeGenome, describe, Head, drawRig,
} from '../src/index'

mkdirSync('out', { recursive: true })

// 1. One face from a seed.
{
  const svg = new SVGSurface({ width: 400, height: 480, background: '#efe9dd' })
  const { genome } = renderFace(svg, { seed: 'ada', scale: 130 })
  writeFileSync('out/example-1-face.svg', svg.toString())
  console.log('1.', describe(genome))
}

// 2. The same face, turned. The genome is reused, so it is the same person.
{
  const svg = new SVGSurface({ width: 1200, height: 260, background: '#efe9dd' })
  const genome = makeGenome('ada')
  for (let i = 0; i < 6; i++) {
    renderFace(svg, {
      genome,
      cx: 100 + i * 200, cy: 130, scale: 70,
      yaw: -1.2 + i * 0.48,
      pitch: 0.1,
      backdrop: false,
    })
  }
  writeFileSync('out/example-2-turn.svg', svg.toString())
  console.log('2. six angles of one person')
}

// 3. Pin some features and let the seed decide the rest.
{
  const svg = new SVGSurface({ width: 400, height: 480, background: '#efe9dd' })
  const { genome } = renderFace(svg, {
    seed: 'ada',
    scale: 130,
    traits: {
      nose: 'hook',
      hair: 'mohawk',
      eyes: { left: { type: 'spiral' }, right: { type: 'saucer' } },
      accessories: [{ type: 'bowtie', size: 0.18, color: '#b4483f' }],
    },
  })
  writeFileSync('out/example-3-pinned.svg', svg.toString())
  console.log('3.', describe(genome))
}

// 4. A plate, and the genomes it produced.
{
  const svg = new SVGSurface({ width: 960, height: 1280 })
  const faces = renderPlate(svg, { cols: 6, rows: 8, seed: 'monday', turn: 0.35 })
  writeFileSync('out/example-4-plate.svg', svg.toString())
  console.log(`4. ${faces.length} faces, e.g. ${faces[0].seed}: ${describe(faces[0].genome)}`)
}

// 5. Ask the head where a feature is, without drawing anything.
{
  const genome = makeGenome('ada')
  const head = new Head({ ...genome.skull, scale: 100, cx: 0, cy: 0, yaw: 0.6 })
  const eye = head.frame(genome.eyes.u, genome.eyes.v)
  console.log('5. right eye at', eye.o.map(Math.round), 'facing', eye.facing.toFixed(2))
  console.log('   nose tip 0.2 out along the normal:', eye.map(0, 0, 0.2).map(Math.round))

  // And draw the skull itself, for debugging.
  const svg = new SVGSurface({ width: 400, height: 480, background: '#efe9dd' })
  const res = renderFace(svg, { genome, scale: 130, yaw: 0.6, pitch: 0.12 })
  drawRig(svg, res.head, genome)
  writeFileSync('out/example-5-rig.svg', svg.toString())
}
