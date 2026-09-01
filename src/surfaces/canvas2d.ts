/**
 * CanvasRenderingContext2D output -- browser canvas, OffscreenCanvas, or the
 * `canvas` npm package in Node if you want PNGs. Same four calls as SVG.
 */

import type { PaperTextureOptions, PathCmd, PathStyle, Surface, Vec3 } from '../types'

/** The slice of the 2D context this surface actually touches. */
export type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D

function hexToRgb(hex: string): Vec3 {
  let h = hex.replace('#', '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  const n = parseInt(h, 16)

  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function withAlpha(color: string, alpha?: number): string {
  if (alpha == null || alpha >= 1) return color
  if (color.startsWith('#')) {
    const [r, g, b] = hexToRgb(color)

    return `rgba(${r},${g},${b},${alpha.toFixed(3)})`
  }

  return color
}

export class Canvas2DSurface implements Surface {
  ctx: Ctx2D
  width: number
  height: number

  constructor(ctx: Ctx2D, width?: number, height?: number) {
    this.ctx = ctx
    this.width = width ?? ctx.canvas?.width ?? 400
    this.height = height ?? ctx.canvas?.height ?? 500
  }

  private _trace(cmds: PathCmd[]): void {
    const c = this.ctx
    c.beginPath()
    for (const cmd of cmds) {
      switch (cmd[0]) {
        case 'M': c.moveTo(cmd[1], cmd[2]); break
        case 'L': c.lineTo(cmd[1], cmd[2]); break
        case 'Q': c.quadraticCurveTo(cmd[1], cmd[2], cmd[3], cmd[4]); break
        case 'C': c.bezierCurveTo(cmd[1], cmd[2], cmd[3], cmd[4], cmd[5], cmd[6]); break
        case 'Z': c.closePath(); break
        default: break
      }
    }
  }

  path(cmds: PathCmd[], style: PathStyle): void {
    if (!cmds || !cmds.length) return
    const c = this.ctx
    this._trace(cmds)
    if (style.fill) {
      c.fillStyle = withAlpha(style.fill, style.alpha)
      c.fill(style.fillRule === 'evenodd' ? 'evenodd' : 'nonzero')
    }
    if (style.stroke) {
      c.strokeStyle = withAlpha(style.stroke, style.alpha)
      c.lineWidth = style.width ?? 1
      c.lineCap = style.cap ?? 'round'
      c.lineJoin = style.join ?? 'round'
      if (style.dash) c.setLineDash(String(style.dash).split(/[ ,]+/).map(Number))
      c.stroke()
      if (style.dash) c.setLineDash([])
    }
  }

  clip(cmds: PathCmd[], fn: () => void): void {
    const c = this.ctx
    c.save()
    this._trace(cmds)
    c.clip()
    fn()
    c.restore()
  }

  rect(x: number, y: number, w: number, h: number, style: PathStyle): void {
    this.path([['M', x, y], ['L', x + w, y], ['L', x + w, y + h], ['L', x, y + h], ['Z']], style)
  }

  group(transform: string, fn: () => void): void {
    const c = this.ctx
    c.save()
    const m = /translate\(([-\d.]+)[ ,]+([-\d.]+)\)/.exec(transform)
    if (m) c.translate(Number(m[1]), Number(m[2]))
    fn()
    c.restore()
  }

  background(color: string): void {
    const c = this.ctx
    c.save()
    c.fillStyle = color
    c.fillRect(0, 0, this.width, this.height)
    c.restore()
  }

  /** Speckled grain, drawn once into an offscreen tile and repeated. */
  paperTexture({ opacity = 0.055, scale = 1, rng = Math.random }: PaperTextureOptions = {}): void {
    const c = this.ctx
    const step = Math.max(1, Math.round(scale))
    c.save()
    c.globalAlpha = opacity
    for (let y = 0; y < this.height; y += step) {
      for (let x = 0; x < this.width; x += step) {
        const v = rng()
        if (v > 0.55) {
          c.fillStyle = v > 0.86 ? '#1a1512' : '#8a7f70'
          c.fillRect(x, y, step, step)
        }
      }
    }
    c.restore()
  }
}

export default Canvas2DSurface
