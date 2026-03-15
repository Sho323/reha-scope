import type { Landmark, PoseLandmarks } from './mediapipe'

// 重心推定に使うランドマーク（インデックス・重み）
const COG_WEIGHTS: { index: number; weight: number }[] = [
  { index: 11, weight: 0.15 }, // 左肩
  { index: 12, weight: 0.15 }, // 右肩
  { index: 23, weight: 0.25 }, // 左腰
  { index: 24, weight: 0.25 }, // 右腰
  { index: 25, weight: 0.1 },  // 左膝
  { index: 26, weight: 0.1 },  // 右膝
]

/**
 * 身体重心を推定（正規化座標 0〜1）
 */
export function calculateCenterOfGravity(landmarks: PoseLandmarks): { x: number; y: number } {
  if (landmarks.length === 0) return { x: 0.5, y: 0.5 }

  let totalWeight = 0
  let wx = 0
  let wy = 0

  for (const { index, weight } of COG_WEIGHTS) {
    const lm = landmarks[index] as Landmark | undefined
    if (!lm) continue
    wx += lm.x * weight
    wy += lm.y * weight
    totalWeight += weight
  }

  if (totalWeight === 0) return { x: 0.5, y: 0.5 }
  return {
    x: Math.round((wx / totalWeight) * 1000) / 1000,
    y: Math.round((wy / totalWeight) * 1000) / 1000,
  }
}

/**
 * 重心偏位の左右方向（正:右偏位, 負:左偏位, 単位:正規化座標差）
 */
export function getLateralDeviation(landmarks: PoseLandmarks): number {
  const cog = calculateCenterOfGravity(landmarks)
  return Math.round((cog.x - 0.5) * 1000) / 1000
}

/**
 * 重心偏位の前後方向（正:前方偏位, 負:後方偏位）
 * 矢状面の場合のみ有効
 */
export function getAnteriorPosteriorDeviation(landmarks: PoseLandmarks): number {
  const cog = calculateCenterOfGravity(landmarks)
  return Math.round((cog.y - 0.5) * 1000) / 1000
}
