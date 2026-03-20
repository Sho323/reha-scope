import type { PoseLandmarks } from './mediapipe'

/**
 * 【前額面・正面撮影】カメラに向いているフレームを判定する。
 * 鼻ランドマーク (index 0) の visibility が高い = 正面を向いている。
 *
 * 正面から撮影することで方向転換問題を回避する前提のため、
 * 時間的平滑化（前後5フレームの過半数判定）を行い、
 * 自然な頭部動揺や瞬間的な検出ノイズによる誤除外を防ぐ。
 */
export function detectFrontalValidity(allLandmarks: PoseLandmarks[]): boolean[] {
  const NOSE_THRESHOLD = 0.25
  const SMOOTH_WIN = 5  // 前後5フレーム（15fps 換算で約 0.67 秒）

  // 各フレームの生判定
  const raw = allLandmarks.map(lm => {
    if (!lm || lm.length === 0) return false
    const nose = lm[0]
    return (nose?.visibility ?? 0) > NOSE_THRESHOLD
  })

  // 時間平滑化：ウィンドウ内の過半数が有効なら有効
  return raw.map((_, i) => {
    const slice = raw.slice(Math.max(0, i - SMOOTH_WIN), Math.min(raw.length, i + SMOOTH_WIN + 1))
    const validCount = slice.filter(Boolean).length
    return validCount / slice.length > 0.5
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

/**
 * 解剖学的妥当性チェック（前額面・矢状面共通）
 *
 * 以下のいずれかに該当するフレームを無効とする：
 *   - 主要下肢ランドマークの visibility が低い（MediaPipe の検出不信頼）
 *   - 膝 or 足首が股関節より上（y座標が小さい）= 解剖学的に不正
 */
export function detectAnatomicalValidity(allLandmarks: PoseLandmarks[]): boolean[] {
  const VIS_THRESHOLD = 0.35

  return allLandmarks.map(lm => {
    if (!lm || lm.length === 0) return false

    // 左右どちらかで解剖学的に正常なら有効とみなす
    const checkSide = (hip: number, knee: number, ankle: number): boolean => {
      const h = lm[hip]; const k = lm[knee]; const a = lm[ankle]
      if (!h || !k || !a) return false
      // visibility チェック
      if ((h.visibility ?? 1) < VIS_THRESHOLD) return false
      if ((k.visibility ?? 1) < VIS_THRESHOLD) return false
      if ((a.visibility ?? 1) < VIS_THRESHOLD) return false
      // 解剖学的順序チェック（画像座標: y下向き正）
      if (k.y < h.y) return false  // 膝が股関節より上
      if (a.y < h.y) return false  // 足首が股関節より上
      return true
    }

    const leftOk  = checkSide(23, 25, 27)
    const rightOk = checkSide(24, 26, 28)
    return leftOk || rightOk
  })
}

export function detectValidity(
  allLandmarks: PoseLandmarks[],
  plane: 'frontal' | 'sagittal'
): boolean[] {
  const directional  = plane === 'frontal'
    ? detectFrontalValidity(allLandmarks)
    : detectSagittalValidity(allLandmarks)
  const anatomical = detectAnatomicalValidity(allLandmarks)

  // 両方の条件を満たすフレームのみ有効
  return directional.map((d, i) => d && anatomical[i])
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
