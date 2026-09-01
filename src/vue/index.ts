/**
 * naives for Vue 3.
 *
 *   import { Face, Plate, useTurntable } from 'naives/vue'
 *
 *   <Face seed="ada" :yaw="30" :width="280" />
 *
 * `vue` is a peer dependency: nothing here is pulled into the core library.
 */

import {
  computed, defineComponent, h, onMounted, onScopeDispose, ref, shallowRef, toValue, watch,
} from 'vue'

import {
  drawFaceOnCanvas, drawPlateOnCanvas, faceSVG, faceSize, pickFace,
  plateSVG, plateSize,
} from '../integrations/core'
import { canRecordVideo, faceFile, faceVideoFile, plateFile } from '../integrations/export'
import { describe } from '../genome'

import type { ComputedRef, MaybeRefOrGetter, PropType, Ref } from 'vue'
import type { FaceOptions, PlateOptions } from '../integrations/core'
import type { Genome, Overrides } from '../types'
import type { ImageFileOptions, PlateFileOptions, VideoFileOptions } from '../integrations/export'
import type { PlateCell } from '../plate'
import type { Seed } from '../rng'

export type { FaceOptions, PlateOptions } from '../integrations/core'
export type { ImageFileOptions, PlateFileOptions, VideoFileOptions, ImageFormat } from '../integrations/export'
export type { Keyframe, Orientation, Pose, PoseName } from '../poses'
export { poses, POSE_NAMES, definePose, resolvePose, poseAt } from '../poses'
export { canRecordVideo, pickVideoMime } from '../integrations/export'

// -------------------------------------------------------------- composables

export interface UseFaceResult {
  svg: ComputedRef<string>
  genome: ComputedRef<Genome>
  /** A one-line summary -- good alt text. */
  description: ComputedRef<string>
}

/**
 * One face as SVG. Pass refs, a getter, or a plain object -- anything
 * reactive re-renders, and nothing else recomputes.
 */
export function useFace(options: MaybeRefOrGetter<FaceOptions> = {}): UseFaceResult {
  const result = computed(() => faceSVG(toValue(options)))

  return {
    svg: computed(() => result.value.svg),
    genome: computed(() => result.value.genome),
    description: computed(() => describe(result.value.genome)),
  }
}

export interface UsePlateResult {
  svg: ComputedRef<string>
  faces: ComputedRef<PlateCell[]>
}

/** A grid of faces as SVG, plus where each face landed. */
export function usePlate(options: MaybeRefOrGetter<PlateOptions> = {}): UsePlateResult {
  const result = computed(() => plateSVG(toValue(options)))

  return {
    svg: computed(() => result.value.svg),
    faces: computed(() => result.value.faces),
  }
}

export interface TurntableOptions {
  yaw?: number
  pitch?: number
  /** Degrees of turn per pixel dragged. */
  sensitivity?: number
  maxYaw?: number
  maxPitch?: number
}

export interface Turntable {
  yaw: Ref<number>
  pitch: Ref<number>
  dragging: Ref<boolean>
  reset: () => void
  /** `v-bind` this onto the element that should respond to dragging. */
  bind: ComputedRef<Record<string, unknown>>
}

/** Drag-to-turn, in the units `<Face>` takes. */
export function useTurntable(options: TurntableOptions = {}): Turntable {
  const { yaw: yaw0 = 0, pitch: pitch0 = 0, sensitivity = 0.4, maxYaw = 90, maxPitch = 40 } = options
  const yaw = ref(yaw0)
  const pitch = ref(pitch0)
  const dragging = ref(false)
  let from: { x: number, y: number, yaw: number, pitch: number } | null = null

  const onPointerdown = (e: PointerEvent) => {
    from = { x: e.clientX, y: e.clientY, yaw: yaw.value, pitch: pitch.value }
    dragging.value = true;
    (e.currentTarget as Element | null)?.setPointerCapture?.(e.pointerId)
  }
  const onPointermove = (e: PointerEvent) => {
    if (!from) return
    const clamp = (v: number, m: number) => Math.max(-m, Math.min(m, v))
    yaw.value = clamp(from.yaw + (e.clientX - from.x) * sensitivity, maxYaw)
    pitch.value = clamp(from.pitch - (e.clientY - from.y) * sensitivity * 0.625, maxPitch)
  }
  const end = () => {
    from = null; dragging.value = false
  }

  return {
    yaw,
    pitch,
    dragging,
    reset: () => {
      yaw.value = yaw0; pitch.value = pitch0
    },
    bind: computed(() => ({
      onPointerdown,
      onPointermove,
      onPointerup: end,
      onPointercancel: end,
      style: { cursor: dragging.value ? 'grabbing' : 'grab', touchAction: 'none' },
    })),
  }
}

// ------------------------------------------------------------- file export

export interface FileState<O> {
  /** Build the file. Pass overrides to tweak this one call. */
  create: (overrides?: Partial<O>) => Promise<File>
  /** Build it and hand it straight to the browser as a download. */
  download: (overrides?: Partial<O>) => Promise<File>
  /** The most recent result, and an object URL for previewing it. */
  file: Ref<File | null>
  url: Ref<string | null>
  pending: Ref<boolean>
  error: Ref<Error | null>
  reset: () => void
}

/**
 * Keeps the newest file, and exactly one object URL for it.
 *
 * Object URLs are a leak if you forget them, so this owns the lifecycle: the
 * previous one is revoked whenever a new file lands, and the last one when the
 * scope goes away.
 */
function useFileSlot() {
  const file = shallowRef<File | null>(null)
  const url = ref<string | null>(null)
  const pending = ref(false)
  const error = shallowRef<Error | null>(null)

  const put = (next: File | null) => {
    if (url.value) URL.revokeObjectURL(url.value)
    file.value = next
    url.value = next ? URL.createObjectURL(next) : null
  }
  onScopeDispose(() => {
    if (url.value) URL.revokeObjectURL(url.value)
  })

  return {
    file,
    url,
    pending,
    error,
    reset: () => {
      put(null); error.value = null
    },
    async run(make: () => Promise<File>): Promise<File> {
      pending.value = true
      error.value = null
      try {
        const next = await make()
        put(next)

        return next
      } catch (e) {
        error.value = e instanceof Error ? e : new Error(String(e))
        throw error.value
      } finally {
        pending.value = false
      }
    },
  }
}

/** Click a link on the user's behalf. */
function saveFile(file: File): void {
  const href = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = href
  a.download = file.name
  a.click()
  setTimeout(() => URL.revokeObjectURL(href), 1000)
}

/**
 * A face as a downloadable `File` -- png, jpeg, webp or svg.
 *
 *   const { download, url, pending } = useFaceFile(() => ({ seed, format: 'webp' }))
 */
export function useFaceFile(
  options: MaybeRefOrGetter<ImageFileOptions> = {},
): FileState<ImageFileOptions> {
  const slot = useFileSlot()
  const create = (overrides: Partial<ImageFileOptions> = {}) =>
    slot.run(() => faceFile({ ...toValue(options), ...overrides }))

  return {
    ...slot,
    create,
    download: async (overrides) => {
      const f = await create(overrides ?? {})
      saveFile(f)

      return f
    },
  }
}

/** A whole plate as a downloadable `File`. */
export function usePlateFile(
  options: MaybeRefOrGetter<PlateFileOptions> = {},
): FileState<PlateFileOptions> {
  const slot = useFileSlot()
  const create = (overrides: Partial<PlateFileOptions> = {}) =>
    slot.run(() => plateFile({ ...toValue(options), ...overrides }))

  return {
    ...slot,
    create,
    download: async (overrides) => {
      const f = await create(overrides ?? {})
      saveFile(f)

      return f
    },
  }
}

export interface VideoState extends FileState<VideoFileOptions> {
  /** 0 -> 1 while recording. Recording runs in real time. */
  progress: Ref<number>
  /** Stop early. The clip so far is discarded. */
  cancel: () => void
  /** False when the browser has no webm recorder. */
  supported: boolean
}

/**
 * A looping webm of the face moving through a pose.
 *
 *   const { create, progress, supported } = useFaceVideo(() => ({ seed, pose: 'nod' }))
 *
 * Recording is real time, so a ten second clip takes ten seconds; `progress`
 * and `pending` are there to say so.
 */
export function useFaceVideo(
  options: MaybeRefOrGetter<VideoFileOptions> = {},
): VideoState {
  const slot = useFileSlot()
  const progress = ref(0)
  const supported = canRecordVideo()
  let abort: AbortController | null = null

  onScopeDispose(() => abort?.abort())

  const create = (overrides: Partial<VideoFileOptions> = {}) => {
    abort?.abort()
    const controller = new AbortController()
    abort = controller
    progress.value = 0
    const base = toValue(options)

    return slot.run(() => faceVideoFile({
      ...base,
      ...overrides,
      signal: controller.signal,
      onProgress: (p) => {
        progress.value = p
        base.onProgress?.(p)
      },
    }))
  }

  return {
    ...slot,
    create,
    download: async (overrides) => {
      const f = await create(overrides ?? {})
      saveFile(f)

      return f
    },
    progress,
    supported,
    cancel: () => abort?.abort(),
  }
}

// -------------------------------------------------------------- components

const faceProps = {
  seed: { type: [String, Number] as PropType<Seed>, default: 'naives' },
  genome: { type: Object as PropType<Genome | null>, default: null },
  traits: { type: Object as PropType<Overrides>, default: undefined },
  /** Degrees. */
  yaw: { type: Number, default: 0 },
  pitch: { type: Number, default: 0 },
  roll: { type: Number, default: 0 },
  width: { type: Number, default: undefined },
  height: { type: Number, default: undefined },
  scale: { type: Number, default: undefined },
  background: { type: String as PropType<string | null>, default: null },
  paper: { type: [Boolean, Number] as PropType<boolean | number>, default: undefined },
  backdrop: { type: Boolean, default: true },
  rough: { type: Number, default: 1 },
  focal: { type: Number, default: 7 },
  rig: { type: Boolean, default: false },
  /**
   * `svg` inlines a vector drawing and works during server rendering;
   * `canvas` paints, which is cheaper to re-run every frame.
   */
  as: { type: String as PropType<'svg' | 'canvas'>, default: 'svg' },
  /** Overrides the generated description used as the accessible label. */
  label: { type: String, default: undefined },
} as const

/** Everything the renderer cares about, with the presentation props removed. */
const pickFaceOptions = (p: Record<string, unknown>): FaceOptions => ({
  seed: p.seed as Seed,
  genome: p.genome as Genome | null,
  traits: p.traits as Overrides | undefined,
  yaw: p.yaw as number,
  pitch: p.pitch as number,
  roll: p.roll as number,
  width: p.width as number | undefined,
  height: p.height as number | undefined,
  scale: p.scale as number | undefined,
  background: p.background as string | null,
  paper: p.paper as boolean | number | undefined,
  backdrop: p.backdrop as boolean,
  rough: p.rough as number,
  focal: p.focal as number,
  rig: p.rig as boolean,
})

/**
 * One doodle face.
 *
 *   <Face seed="ada" :yaw="30" />
 *   <Face seed="ada" as="canvas" :traits="{ nose: 'hook' }" />
 */
export const Face = defineComponent({
  name: 'NaivesFace',
  props: faceProps,
  emits: {
    genome: (g: Genome) => !!g,
  },
  setup(props, { emit }) {
    const options = computed(() => pickFaceOptions(props))
    const canvas = ref<HTMLCanvasElement | null>(null)
    const painted = shallowRef<Genome | null>(null)

    const svg = computed(() => (props.as === 'svg' ? faceSVG(options.value) : null))
    watch(svg, (v) => {
      if (v) emit('genome', v.genome)
    }, { immediate: true })

    const paint = () => {
      if (props.as !== 'canvas' || !canvas.value) return
      const res = drawFaceOnCanvas(canvas.value, options.value)
      if (res) {
        painted.value = res.genome
        emit('genome', res.genome)
      }
    }
    onMounted(paint)
    watch(options, paint)
    watch(() => props.as, paint)

    return () => {
      const size = faceSize(options.value)
      if (props.as === 'canvas') {
        return h('canvas', {
          ref: canvas,
          role: 'img',
          'aria-label': props.label
            ?? (painted.value ? describe(painted.value) : 'a doodle face'),
          style: { width: `${size.width}px`, height: `${size.height}px` },
        })
      }

      return h('div', {
        role: 'img',
        'aria-label': props.label ?? describe(svg.value!.genome),
        style: { display: 'inline-block', lineHeight: 0 },
        innerHTML: svg.value!.svg,
      })
    }
  },
})

const plateProps = {
  cols: { type: Number, default: 6 },
  rows: { type: Number, default: 8 },
  seed: { type: [String, Number] as PropType<Seed>, default: 'plate' },
  traits: { type: Object as PropType<Overrides>, default: undefined },
  /** Degrees: the widest each face may turn, tilt and lean. */
  turn: { type: Number, default: 0 },
  tilt: { type: Number, default: 0 },
  lean: { type: Number, default: 3 },
  width: { type: Number, default: undefined },
  height: { type: Number, default: undefined },
  scaleFactor: { type: Number, default: 0.3 },
  background: { type: String as PropType<string | null>, default: null },
  paper: { type: [Boolean, Number] as PropType<boolean | number>, default: undefined },
  rough: { type: Number, default: 1 },
  as: { type: String as PropType<'svg' | 'canvas'>, default: 'svg' },
  label: { type: String, default: undefined },
} as const

const pickPlateOptions = (p: Record<string, unknown>): PlateOptions => ({
  cols: p.cols as number,
  rows: p.rows as number,
  seed: p.seed as Seed,
  traits: p.traits as Overrides | undefined,
  turn: p.turn as number,
  tilt: p.tilt as number,
  lean: p.lean as number,
  width: p.width as number | undefined,
  height: p.height as number | undefined,
  scaleFactor: p.scaleFactor as number,
  background: p.background as string | null,
  paper: p.paper as boolean | number | undefined,
  rough: p.rough as number,
})

/**
 * A sheet of faces.
 *
 *   <Plate :cols="6" :rows="8" seed="monday" @select="f => seed = f.seed" />
 */
export const Plate = defineComponent({
  name: 'NaivesPlate',
  props: plateProps,
  emits: {
    select: (cell: PlateCell) => !!cell,
    faces: (cells: PlateCell[]) => Array.isArray(cells),
  },
  setup(props, { emit }) {
    const options = computed(() => pickPlateOptions(props))
    const canvas = ref<HTMLCanvasElement | null>(null)
    const painted = shallowRef<PlateCell[]>([])

    const svg = computed(() => (props.as === 'svg' ? plateSVG(options.value) : null))
    const faces = computed(() => svg.value?.faces ?? painted.value)
    watch(faces, (v) => {
      if (v.length) emit('faces', v)
    }, { immediate: true })

    const paint = () => {
      if (props.as !== 'canvas' || !canvas.value) return
      painted.value = drawPlateOnCanvas(canvas.value, options.value)
    }
    onMounted(paint)
    watch(options, paint)
    watch(() => props.as, paint)

    const onClick = (e: MouseEvent) => {
      const el = e.currentTarget as HTMLElement
      const { width, height } = plateSize(options.value)
      const rect = el.getBoundingClientRect()
      const x = ((e.clientX - rect.left) / (rect.width || 1)) * width
      const y = ((e.clientY - rect.top) / (rect.height || 1)) * height
      const hit = pickFace(faces.value, x, y)
      if (hit) emit('select', hit)
    }

    return () => {
      const { width, height } = plateSize(options.value)
      const label = props.label ?? `${faces.value.length} doodle faces`
      if (props.as === 'canvas') {
        return h('canvas', {
          ref: canvas,
          role: 'img',
          'aria-label': label,
          style: { width: `${width}px`, height: `${height}px`, cursor: 'pointer' },
          onClick,
        })
      }

      return h('div', {
        role: 'img',
        'aria-label': label,
        style: { display: 'inline-block', lineHeight: 0, cursor: 'pointer' },
        innerHTML: svg.value!.svg,
        onClick,
      })
    }
  },
})

/** Convenience helpers: the same output the components and composables produce. */
export { faceSVG, plateSVG, pickFace, pointerToCanvas } from '../integrations/core'
export { faceFile, plateFile, faceVideoFile } from '../integrations/export'
