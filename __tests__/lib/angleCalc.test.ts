import { calculateHipAngle, calculateKneeAngle, calculateAllAngles } from '@/lib/angleCalc'
import type { PoseLandmarks } from '@/lib/mediapipe'

// MediaPipe Poseの33ランドマークをモック（T字型の人体）
function makeMockLandmarks(): PoseLandmarks {
  const lm = Array(33).fill(null).map(() => ({ x: 0.5, y: 0.5, z: 0, visibility: 1 }))
  // 左肩[11], 右肩[12]
  lm[11] = { x: 0.4, y: 0.3, z: 0, visibility: 1 }
  lm[12] = { x: 0.6, y: 0.3, z: 0, visibility: 1 }
  // 左腰[23], 右腰[24]
  lm[23] = { x: 0.4, y: 0.6, z: 0, visibility: 1 }
  lm[24] = { x: 0.6, y: 0.6, z: 0, visibility: 1 }
  // 左膝[25], 右膝[26]
  lm[25] = { x: 0.4, y: 0.8, z: 0, visibility: 1 }
  lm[26] = { x: 0.6, y: 0.8, z: 0, visibility: 1 }
  // 左足首[27], 右足首[28]
  lm[27] = { x: 0.4, y: 1.0, z: 0, visibility: 1 }
  lm[28] = { x: 0.6, y: 1.0, z: 0, visibility: 1 }
  // 左足先[31], 右足先[32]
  lm[31] = { x: 0.35, y: 1.05, z: 0, visibility: 1 }
  lm[32] = { x: 0.65, y: 1.05, z: 0, visibility: 1 }
  return lm
}

describe('calculateHipAngle', () => {
  test('正常なランドマークで角度が計算される', () => {
    const lm = makeMockLandmarks()
    const angle = calculateHipAngle(lm)
    expect(angle).toBeGreaterThanOrEqual(0)
    expect(angle).toBeLessThanOrEqual(180)
  })

  test('空のランドマークで0を返す', () => {
    expect(calculateHipAngle([])).toBe(0)
  })
})

describe('calculateKneeAngle', () => {
  test('正常なランドマークで角度が計算される', () => {
    const lm = makeMockLandmarks()
    const angle = calculateKneeAngle(lm)
    expect(angle).toBeGreaterThanOrEqual(0)
    expect(angle).toBeLessThanOrEqual(180)
  })
})

describe('calculateAllAngles', () => {
  test('全関節の角度が返される', () => {
    const lm = makeMockLandmarks()
    const angles = calculateAllAngles(lm)
    expect(angles).toHaveProperty('hip')
    expect(angles).toHaveProperty('knee')
    expect(angles).toHaveProperty('ankle')
    expect(angles).toHaveProperty('trunk')
  })
})
