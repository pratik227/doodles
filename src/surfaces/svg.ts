/**
 * SVG output. Works anywhere, including Node with no native dependencies.
 * The whole drawing API is four calls: path, clip, rect, background.
 */

import type { PaperTextureOptions, PathCmd, PathStyle, Surface } from '../types'

export interface SVGSurfaceOptions {
  width?: number
  height?: number
  background?: string | null
  precision?: number
  paper?: boolean
}

const round = (n: number, p = 2): number => {
  const v = Number(n.toFixed(p))

  return Object.is(v, -0) ? 0 : v
}

function esc(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function pathData(cmds: PathCmd[], precision: number): string {
  const out: string[] = []
  for (const c of cmds) {
    if (c[0] === 'Z') {
      out.push('Z'); continue
    }
    const nums = (c.slice(1) as number[]).map((n) => round(n, precision)).join(' ')
    out.push(c[0] + nums)
  }

  return out.join(' ')
}

/**
 * Colours and dash patterns come from the caller, and the result is routinely
 * injected as markup (`dangerouslySetInnerHTML`, `v-html`), so anything that is
 * not a number we generated ourselves gets escaped on the way out.
 */
function attrs(style: PathStyle): string {
  const a: string[] = []
  if (style.fill) {
    a.push(`fill="${esc(style.fill)}"`)
    if (style.alpha != null && style.alpha < 1) a.push(`fill-opacity="${round(style.alpha, 3)}"`)
    if (style.fillRule) a.push(`fill-rule="${esc(style.fillRule)}"`)
  } else {
    a.push('fill="none"')
  }
  if (style.stroke) {
    a.push(`stroke="${esc(style.stroke)}"`)
    a.push(`stroke-width="${round(style.width ?? 1, 2)}"`)
    if (style.alpha != null && style.alpha < 1) a.push(`stroke-opacity="${round(style.alpha, 3)}"`)
    if (style.cap) a.push(`stroke-linecap="${esc(style.cap)}"`)
    if (style.join) a.push(`stroke-linejoin="${esc(style.join)}"`)
    if (style.dash) a.push(`stroke-dasharray="${esc(style.dash)}"`)
  }

  return a.join(' ')
}

export class SVGSurface implements Surface {
  width: number
  height: number
  precision: number
  out: string[]
  defs: string[]
  private _clipId: number
  private _bg: string | null
  private _paper: boolean
  private _grain: number | null = null

  constructor({ width = 400, height = 500, background = null, precision = 1, paper = false }: SVGSurfaceOptions = {}) {
    this.width = width
    this.height = height
    this.precision = precision
    this.out = []
    this.defs = []
    this._clipId = 0
    this._bg = background
    this._paper = paper
  }

  path(cmds: PathCmd[], style: PathStyle): void {
    if (!cmds || !cmds.length) return
    const d = pathData(cmds, this.precision)
    if (!d) return
    this.out.push(`<path d="${d}" ${attrs(style)}/>`)
  }

  clip(cmds: PathCmd[], fn: () => void): void {
    const id = `c${this._clipId++}`
    this.defs.push(`<clipPath id="${id}"><path d="${pathData(cmds, this.precision)}"/></clipPath>`)
    this.out.push(`<g clip-path="url(#${id})">`)
    fn()
    this.out.push('</g>')
  }

  rect(x: number, y: number, w: number, h: number, style: PathStyle): void {
    this.out.push(`<rect x="${round(x)}" y="${round(y)}" width="${round(w)}" height="${round(h)}" ${attrs(style)}/>`)
  }

  group(transform: string, fn: () => void): void {
    this.out.push(`<g transform="${esc(transform)}">`)
    fn()
    this.out.push('</g>')
  }

  background(color: string): void {
    this._bg = color
  }

  /** Aged-paper grain, done with a filter so the file stays tiny. */
  paperTexture(opts: PaperTextureOptions = {}): void {
    const { opacity = 0.5, freq = 0.9, octaves = 2, seed = 3 } = opts
    this.defs.push(
      '<filter id="grain" x="0" y="0" width="100%" height="100%">'
      + `<feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="${octaves}" seed="${seed}" result="n"/>`
      + '<feColorMatrix in="n" type="saturate" values="0"/>'
      + '</filter>',
    )
    this._grain = opacity
  }

  toString(): string {
    const head = `<svg xmlns="http://www.w3.org/2000/svg" width="${this.width}" height="${this.height}" `
      + `viewBox="0 0 ${this.width} ${this.height}">`
    const bg = this._bg ? `<rect width="100%" height="100%" fill="${esc(this._bg)}"/>` : ''
    const grain = this._grain
      ? `<rect width="100%" height="100%" filter="url(#grain)" opacity="${this._grain}" style="mix-blend-mode:multiply"/>`
      : ''
    const defs = this.defs.length ? `<defs>${this.defs.join('')}</defs>` : ''

    return `${head}${defs}${bg}${this.out.join('')}${grain}</svg>`
  }
}

export default SVGSurface
