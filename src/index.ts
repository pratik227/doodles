/**
 * naives -- algorithmic doodle faces.
 *
 *   import { face, plate, SVGSurface } from 'naives';
 *
 *   const svg = new SVGSurface({ width: 400, height: 500 });
 *   face(svg, { seed: 'hello', yaw: 0.4 });
 *   console.log(svg.toString());
 */

import * as accessoriesModule from './features/accessories'
import * as backdropModule from './features/backdrop'
import * as eyesModule from './features/eyes'
import * as facialHairModule from './features/facialhair'
import * as hairModule from './features/hair'
import * as hatsModule from './features/hats'
import * as marksModule from './features/marks'
import * as mouthModule from './features/mouth'
import * as noseModule from './features/nose'

export { Head } from './head'
export { Pen } from './pen'
export { Rng, hashSeed } from './rng'
export { SVGSurface } from './surfaces/svg'
export { Canvas2DSurface } from './surfaces/canvas2d'
export { makeGenome, describe, applyOverrides, SKULLS } from './genome'
export { makePalette, PAPER, INK, SKIN, HAIR, WASH, CLOTH, ACCENT } from './palette'
export { renderFace, renderFace as face } from './face'
export { renderPlate, renderPlate as plate } from './plate'
export * as shapes from './shapes'
export { drawRig } from './rig'
export { poses, POSE_NAMES, definePose, resolvePose, poseAt } from './poses'

/** Framework-free helpers -- the same ones naives/react and naives/vue wrap. */
export {
  faceSVG, plateSVG, drawFaceOnCanvas, drawPlateOnCanvas, pickFace, pointerToCanvas,
} from './integrations/core'
export {
  faceFile, plateFile, faceVideoFile, canRecordVideo, pickVideoMime,
} from './integrations/export'

export { eyes, EYE_WEIGHTS } from './features/eyes'
export { noses, NOSE_WEIGHTS } from './features/nose'
export { mouths, brows, ears, MOUTH_WEIGHTS, BROW_WEIGHTS, EAR_WEIGHTS } from './features/mouth'
export { hair, HAIR_WEIGHTS, HAIRLINES } from './features/hair'
export { hats, HAT_WEIGHTS } from './features/hats'
export { facialHair, BEARD_WEIGHTS, MOUSTACHE_WEIGHTS } from './features/facialhair'
export { accessories, ACCESSORY_WEIGHTS } from './features/accessories'
export { marks, MARK_WEIGHTS } from './features/marks'
export { backdrops, BACKDROP_WEIGHTS } from './features/backdrop'

export type * from './types'
export type { Keyframe, Orientation, Pose, PoseName } from './poses'
export type { FaceOptions, PlateOptions } from './integrations/core'
export type {
  ImageFileOptions, ImageFormat, PlateFileOptions, VideoFileOptions,
} from './integrations/export'
export type { Seed } from './rng'
export type { PenOptions } from './pen'
export type { SVGSurfaceOptions } from './surfaces/svg'
export type { Ctx2D } from './surfaces/canvas2d'
export type { RenderFaceOptions, RenderFaceResult } from './face'
export type { RenderPlateOptions, PlateCell } from './plate'
export type { RigOptions } from './rig'

/** Every feature variant, by category -- useful for building pickers. */
export type Catalogue = Record<string, string[]>

export async function catalogue(): Promise<Catalogue> {
  // The modules are already linked in above, so this is just a shape --
  // it stays async because that is the signature callers were given.
  return {
    eyes: Object.keys(eyesModule.eyes),
    nose: Object.keys(noseModule.noses),
    mouth: Object.keys(mouthModule.mouths),
    brow: Object.keys(mouthModule.brows),
    ears: Object.keys(mouthModule.ears),
    hair: Object.keys(hairModule.hair),
    hat: Object.keys(hatsModule.hats),
    beard: Object.keys(facialHairModule.facialHair),
    accessories: Object.keys(accessoriesModule.accessories),
    marks: Object.keys(marksModule.marks),
    backdrop: Object.keys(backdropModule.backdrops),
  }
}
