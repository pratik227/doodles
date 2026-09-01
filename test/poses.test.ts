import test from 'node:test'
import assert from 'node:assert/strict'

import { POSE_NAMES, definePose, poseAt, poses, resolvePose } from '../src/poses'

test('there are ten built-in poses', () => {
  assert.equal(POSE_NAMES.length, 10)
  assert.deepEqual(POSE_NAMES, Object.keys(poses))
})

test('every built-in pose loops seamlessly', () => {
  for (const name of POSE_NAMES) {
    const p = poses[name]
    const start = poseAt(p, 0)
    // Just shy of a full turn: the pose must be arriving back at the start.
    const end = poseAt(p, 0.9995)
    // `spin` comes home the long way round, so compare the actual orientation.
    const wrap = (d: number) => ((d % 360) + 540) % 360 - 180
    for (const axis of ['yaw', 'pitch', 'roll'] as const) {
      const gap = Math.abs(wrap(end[axis] - start[axis]))
      assert.ok(gap < 1.5, `${name}.${axis} jumps ${gap.toFixed(2)}° at the seam`)
    }
  }
})

test('poses stay within angles the renderer is happy with', () => {
  for (const name of POSE_NAMES) {
    if (name === 'spin') continue        // a full turn is the point of it
    for (let i = 0; i < 200; i++) {
      const o = poseAt(poses[name], i / 200)
      assert.ok(Math.abs(o.yaw) <= 90, `${name} yaw ${o.yaw}`)
      assert.ok(Math.abs(o.pitch) <= 45, `${name} pitch ${o.pitch}`)
      assert.ok(Math.abs(o.roll) <= 35, `${name} roll ${o.roll}`)
    }
  }
})

test('every pose actually moves', () => {
  for (const name of POSE_NAMES) {
    const seen = new Set<string>()
    for (let i = 0; i < 40; i++) {
      const o = poseAt(poses[name], i / 40)
      seen.add(`${o.yaw.toFixed(1)}/${o.pitch.toFixed(1)}/${o.roll.toFixed(1)}`)
    }
    assert.ok(seen.size > 8, `${name} barely moves`)
  }
})

test('a pose lays over the orientation already set', () => {
  const o = poseAt(poses.nod, 0.25, { yaw: 30, roll: -5 })
  assert.equal(o.yaw, 30)
  assert.equal(o.roll, -5)
  assert.ok(o.pitch > 20, 'the nod should still be at its peak')
})

test('custom poses can be plain functions', () => {
  const p = definePose((t) => ({ yaw: t * 10 }))
  assert.equal(poseAt(p, 0.5).yaw, 5)
  // Time outside [0, 1) wraps rather than running off.
  assert.equal(poseAt(p, 1.5).yaw, 5)
})

test('custom poses can be keyframes, and wrap back to the first', () => {
  const p = definePose([{ at: 0, yaw: -30 }, { at: 0.5, yaw: 30 }])
  assert.equal(poseAt(p, 0).yaw, -30)
  assert.equal(poseAt(p, 0.5).yaw, 30)
  assert.ok(Math.abs(poseAt(p, 0.25).yaw) < 1, 'should be mid-swing')
  assert.ok(Math.abs(poseAt(p, 0.999).yaw - -30) < 1, 'should return to the first frame')
})

test('keyframes are sorted, and a single frame holds still', () => {
  const p = definePose([{ at: 0.75, roll: 9 }, { at: 0.25, roll: -9 }])
  assert.equal(poseAt(p, 0.25).roll, -9)
  assert.equal(poseAt(p, 0.75).roll, 9)

  const held = definePose([{ at: 0.3, yaw: 12 }])
  assert.equal(poseAt(held, 0).yaw, 12)
  assert.equal(poseAt(held, 0.9).yaw, 12)
})

test('resolvePose takes a name, a function or keyframes', () => {
  assert.equal(resolvePose('nod'), poses.nod)
  assert.equal(resolvePose(undefined), poses.turntable)
  assert.equal(resolvePose('nope' as 'nod'), poses.turntable)
  assert.equal(poseAt(resolvePose([{ at: 0, yaw: 5 }]), 0).yaw, 5)
  assert.equal(poseAt(resolvePose((t) => ({ pitch: t })), 0.5).pitch, 0.5)
})
