import type { PoseLandmarks } from './mediapipe'

/**
 * 【前額面】カメラを向いているフレームを判定する。
 * 鼻ランドマーク (index 0) の visibility が高い = 正面を向いている。
 * 方向転換で背中を向けると visibility が急落する。
 */
export function detectFrontalValidity(allLandmarks: PoseLandmarks[]): boolean[] {
  const THRESHOLD = 0.25
  return allLandmarks.map(lm => {
    if (!lm || lm.length === 0) return false
    const nose = lm[0]
    return (nose?.visibility ?? 0) > THRESHOLD
  })
}

/**
 * 【矢状面】一定方向に歩いているフレームを判定する。
 * 重心 x 座標の速度を求め、方向が反転した周辺フレームを無効とする。
 * 往路・復路どちらも含まれるが折り返し区間（立ち止まり〜再歩行）を除外する。
 */
export function detectSagittalValidity(allLandmarks: PoseLandmarks[]): boolean[] {
  const n = allLandmarks.length
  const valid = new Array<boolean>(n).fill(true)
  if (n < 10) return valid

  // 重心 x 座標を取得
  const centerXs: (number | null)[] = allLandmarks.map(lm => {
    if (!lm || lm.length < 25) return null
    const lHip = lm[23], rHip = lm[24]
    if (!lHip || !rHip) return null
    return (lHip.x + rHip.x) / 2
  })

  // 移動平均で平滑化（ノイズ除去）
  const SMOOTH = 5
  const smoothed = centerXs.map((_, i) => {
    const slice = centerXs.slice(Math.max(0, i - SMOOTH), i + SMOOTH + 1)
    const nums = slice.filter((v): v is number => v !== null)
    return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null
  })

  // 方向反転点を検出して前後 BUFFER フレームを無効化
  const WIN = 12    // 速度計算ウィンドウ（フレーム数）
  const BUFFER = 10 // 反転前後の除外幅
  const MIN_VEL = 0.003 // ノイズ閾値（静止と移動の区別）

  for (let i = WIN; i < n - WIN; i++) {
    const before = smoothed.slice(Math.max(0, i - WIN), i).filter((v): v is number => v !== null)
    const after  = smoothed.slice(i, Math.min(n, i + WIN)).filter((v): v is number => v !== null)
    if (before.length < 4 || after.length < 4) continue

    const velBefore = (before[before.length - 1] - before[0]) / before.length
    const velAfter  = (after[after.length - 1]  - after[0])  / after.length

    const isReversal =
      Math.abs(velBefore) > MIN_VEL &&
      Math.abs(velAfter)  > MIN_VEL &&
      velBefore * velAfter < 0 // 符号が逆 = 方向転換

    if (isReversal) {
      for (let j = Math.max(0, i - BUFFER); j < Math.min(n, i + BUFFER); j++) {
        valid[j] = false
      }
    }
  }

  return valid
}

export function detectValidity(
  allLandmarks: PoseLandmarks[],
  plane: 'frontal' | 'sagittal'
): boolean[] {
  return plane === 'frontal'
    ? detectFrontalValidity(allLandmarks)
    : detectSagittalValidity(allLandmarks)
}

/** 有効フレームのみを使ってデータ配列をフィルタリング */
export function filterByValidity<T>(data: T[], validity: boolean[]): T[] {
  return data.filter((_, i) => validity[i] !== false)
}

/** 有効フレーム数と割合を返す */
export function validityStats(validity: boolean[]): { valid: number; total: number; ratio: number } {
  const valid = validity.filter(Boolean).length
  return { valid, total: validity.length, ratio: validity.length ? valid / validity.length : 1 }
}
