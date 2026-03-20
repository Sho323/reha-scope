import type { FrameData } from '@/context/SessionContext'

const FPS = 15

function smooth(arr: number[], win: number): number[] {
  return arr.map((_, i) => {
    const s = arr.slice(Math.max(0, i - win), Math.min(arr.length, i + win + 1))
    return s.reduce((a, b) => a + b, 0) / s.length
  })
}

function countCrossings(arr: number[]): { up: number; down: number } {
  let up = 0, down = 0
  for (let i = 1; i < arr.length; i++) {
    if (arr[i - 1] <= 0 && arr[i] > 0) up++
    if (arr[i - 1] >= 0 && arr[i] < 0) down++
  }
  return { up, down }
}

// ─── 立ち上がり ───────────────────────────────────────────────────────────

export interface StandingMetrics {
  duration: number         // 秒
  phases?: {
    leanForward: number    // 体幹前傾フェーズ（秒）
    rise: number           // 離殿〜伸展フェーズ（秒）
  }
}

/**
 * 立ち上がり所要時間とフェーズ分割を計算する。
 *
 * 矢状面では体幹前傾角（trunk フィールド）が最大となるフレームを境に
 * 「前傾フェーズ」と「離殿・伸展フェーズ」に分割する。
 * 前額面では合計時間のみ返す。
 */
export function calcStandingMetrics(
  data: FrameData[],
  validity: boolean[],
  plane: 'frontal' | 'sagittal'
): StandingMetrics {
  const validData = data.filter((_, i) => validity[i] !== false)
  if (validData.length === 0) return { duration: 0 }

  const duration = Math.round((validData.length / FPS) * 10) / 10

  if (plane === 'sagittal') {
    const trunks = validData.map(d => d.trunk)
    const maxIdx = trunks.indexOf(Math.max(...trunks))
    const leanForward = Math.round(((maxIdx + 1) / FPS) * 10) / 10
    const rise = Math.round((duration - leanForward) * 10) / 10
    return { duration, phases: { leanForward, rise } }
  }

  return { duration }
}

// ─── 歩行 ─────────────────────────────────────────────────────────────────

export interface WalkingMetrics {
  duration: number       // 秒
  speed?: number         // m/s（walkingDistance 指定時のみ）
  cadence: number        // 歩/分
  stepLength?: number    // cm（walkingDistance 指定時のみ）
  stepCount: number      // 総歩数
  symmetryIndex: number  // %（100 = 完全対称）
}

/**
 * 歩行指標を計算する。
 *
 * ステップ検出アルゴリズム:
 *   前額面 → 骨盤傾斜角（hip フィールド）が1歩ごとに左右交互に振動
 *   矢状面 → 膝関節屈曲角（knee フィールド）が1歩ごとに増減
 *
 * 平均値を引いてゼロ中心化し、ゼロクロス回数から歩数を推定する。
 * walkingDistance (m) を渡すと歩行速度・歩幅も算出する。
 */
export function calcWalkingMetrics(
  data: FrameData[],
  validity: boolean[],
  plane: 'frontal' | 'sagittal',
  walkingDistance?: number
): WalkingMetrics {
  const validData = data.filter((_, i) => validity[i] !== false)
  if (validData.length < 10) {
    return { duration: 0, cadence: 0, stepCount: 0, symmetryIndex: 0 }
  }

  const duration = validData.length / FPS

  // ゼロ中心化した歩行リズム信号
  const raw = plane === 'frontal'
    ? validData.map(d => d.hip)   // 骨盤傾斜角（自然にゼロ付近で振動）
    : validData.map(d => d.knee)  // 膝屈曲角（平均除去でゼロ中心化）
  const mean = raw.reduce((a, b) => a + b, 0) / raw.length
  const centered = raw.map(v => v - mean)
  const smoothed = smooth(centered, 3)

  const { up, down } = countCrossings(smoothed)
  const stepCount = up + down

  const cadence = stepCount > 0 ? Math.round((stepCount / duration) * 60) : 0

  // 左右対称性: 上下クロス数の差が小さいほど対称（100%＝完全対称）
  const symmetryIndex = stepCount > 0
    ? Math.round(100 * (1 - Math.abs(up - down) / stepCount))
    : 100

  const speed = walkingDistance !== undefined
    ? Math.round((walkingDistance / duration) * 100) / 100
    : undefined

  // 歩幅 = 歩行距離 / 総歩数（1歩あたりの進行距離）
  const stepLength = walkingDistance !== undefined && stepCount > 0
    ? Math.round((walkingDistance / stepCount) * 100)
    : undefined

  return {
    duration:      Math.round(duration * 10) / 10,
    speed,
    cadence,
    stepLength,
    stepCount,
    symmetryIndex,
  }
}
