import type { Landmark, PoseLandmarks } from './mediapipe'

/**
 * 矢状面で使用する側の指定。
 * 'auto' はフレームごとに visibility スコアを比較して自動選択する。
 */
export type Side = 'left' | 'right' | 'both' | 'auto'

/** 1フレーム分のランドマークから、より可視性の高い側を返す */
function detectFrameSide(lm: PoseLandmarks): 'left' | 'right' {
  const leftVis  = (lm[LM.LEFT_HIP]?.visibility   ?? 0)
                 + (lm[LM.LEFT_KNEE]?.visibility   ?? 0)
                 + (lm[LM.LEFT_ANKLE]?.visibility  ?? 0)
  const rightVis = (lm[LM.RIGHT_HIP]?.visibility   ?? 0)
                 + (lm[LM.RIGHT_KNEE]?.visibility  ?? 0)
                 + (lm[LM.RIGHT_ANKLE]?.visibility ?? 0)
  return leftVis >= rightVis ? 'left' : 'right'
}

// MediaPipe Pose ランドマークインデックス
const LM = {
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
  LEFT_HEEL: 29,
  RIGHT_HEEL: 30,
  LEFT_FOOT_INDEX: 31,
  RIGHT_FOOT_INDEX: 32,
}

/**
 * 3点から角度を計算（度数）
 * A-B-C の B における角度を返す
 */
function calcAngle(a: Landmark, b: Landmark, c: Landmark): number {
  const ab = { x: a.x - b.x, y: a.y - b.y }
  const cb = { x: c.x - b.x, y: c.y - b.y }
  const dot = ab.x * cb.x + ab.y * cb.y
  const magAB = Math.sqrt(ab.x ** 2 + ab.y ** 2)
  const magCB = Math.sqrt(cb.x ** 2 + cb.y ** 2)
  if (magAB === 0 || magCB === 0) return 0
  const cosAngle = Math.max(-1, Math.min(1, dot / (magAB * magCB)))
  return Math.round(Math.acos(cosAngle) * (180 / Math.PI))
}

function midpoint(a: Landmark, b: Landmark): Landmark {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 }
}

/**
 * 股関節屈曲角度（大腿の垂直軸からの偏位角）
 *
 * 旧方式: 180 - calcAngle(shoulder, hip, knee)
 *   → 肩ランドマークを体幹の基準に使うため、立ち上がり時の大きな体幹前傾で
 *     肩が前方に移動し、股関節角度に体幹傾斜分の誤差が混入していた。
 *
 * 新方式: 大腿ベクトル（hip→knee）と鉛直下向き（0,1）のなす角（絶対値）
 *   → 肩に依存しないため立ち上がり・歩行ともに正確。
 *   → 直立:0°、屈曲:正値（最大約90°以上）、伸展は小さな正値として表れる。
 */
export function calculateHipAngle(landmarks: PoseLandmarks, side: Side = 'auto'): number {
  if (landmarks.length === 0) return 0
  const lHip  = landmarks[LM.LEFT_HIP]
  const lKnee = landmarks[LM.LEFT_KNEE]
  const rHip  = landmarks[LM.RIGHT_HIP]
  const rKnee = landmarks[LM.RIGHT_KNEE]

  if (!lHip || !lKnee || !rHip || !rKnee) return 0

  /** 大腿ベクトルの垂直軸からの角度（画像座標: y下向き正） */
  const thighAngle = (hip: Landmark, knee: Landmark): number => {
    const dx = knee.x - hip.x
    const dy = knee.y - hip.y
    // Math.abs(dx) → 屈曲・伸展ともに正値（0°=直立）
    // Math.max(dy, 0.001) → ゼロ除算防止（膝が股関節と同じ高さの場合）
    return Math.round(Math.atan2(Math.abs(dx), Math.max(dy, 0.001)) * (180 / Math.PI))
  }

  const resolved = side === 'auto' ? detectFrameSide(landmarks) : side
  if (resolved === 'left')  return thighAngle(lHip, lKnee)
  if (resolved === 'right') return thighAngle(rHip, rKnee)
  return Math.round((thighAngle(lHip, lKnee) + thighAngle(rHip, rKnee)) / 2)
}

/**
 * 膝関節屈曲角度（左右平均）
 * 臨床定義: 完全伸展 = 0°、屈曲方向が正値
 * calcAngle(hip, knee, ankle) は大腿-膝-下腿の内角で完全伸展時に約180° →
 * 180° から引くことで伸展0°基準に変換する
 */
export function calculateKneeAngle(landmarks: PoseLandmarks, side: Side = 'auto'): number {
  if (landmarks.length === 0) return 0
  const lHip   = landmarks[LM.LEFT_HIP]
  const lKnee  = landmarks[LM.LEFT_KNEE]
  const lAnkle = landmarks[LM.LEFT_ANKLE]
  const rHip   = landmarks[LM.RIGHT_HIP]
  const rKnee  = landmarks[LM.RIGHT_KNEE]
  const rAnkle = landmarks[LM.RIGHT_ANKLE]

  if (!lHip || !lKnee || !lAnkle || !rHip || !rKnee || !rAnkle) return 0

  const resolved   = side === 'auto' ? detectFrameSide(landmarks) : side
  const leftAngle  = 180 - calcAngle(lHip, lKnee, lAnkle)
  const rightAngle = 180 - calcAngle(rHip, rKnee, rAnkle)
  if (resolved === 'left')  return Math.round(leftAngle)
  if (resolved === 'right') return Math.round(rightAngle)
  return Math.round((leftAngle + rightAngle) / 2)
}

/**
 * 足関節背屈角度
 * 臨床定義: 中立位（直立）= 0°、背屈が正値（+）、底屈が負値（−）
 *
 * calcAngle(knee, ankle, foot) は下腿-足首-足部の内角を返す:
 *   中立位 ≈ 90°、背屈で内角が縮む（< 90°）、底屈で内角が開く（> 90°）
 * → 90 - calcAngle とすることで「背屈 = 正・底屈 = 負」に変換する
 *   （angle - 90 だと逆になる）
 */
export function calculateAnkleAngle(landmarks: PoseLandmarks, side: Side = 'auto'): number {
  if (landmarks.length === 0) return 0
  const lKnee  = landmarks[LM.LEFT_KNEE]
  const lAnkle = landmarks[LM.LEFT_ANKLE]
  const lFoot  = landmarks[LM.LEFT_FOOT_INDEX]
  const rKnee  = landmarks[LM.RIGHT_KNEE]
  const rAnkle = landmarks[LM.RIGHT_ANKLE]
  const rFoot  = landmarks[LM.RIGHT_FOOT_INDEX]

  if (!lKnee || !lAnkle || !lFoot || !rKnee || !rAnkle || !rFoot) return 0

  const FOOT_TOLERANCE = 0.08
  const VIS_THRESHOLD  = 0.35
  // 足首が股関節より上 / visibility 不足 / 足先が足首より大幅に上 → 誤検出としてスキップ
  const lHip = landmarks[LM.LEFT_HIP]
  const rHip = landmarks[LM.RIGHT_HIP]
  const lAnkleValid = (lAnkle.visibility ?? 1) >= VIS_THRESHOLD
                   && (!lHip || lAnkle.y >= lHip.y)
  const rAnkleValid = (rAnkle.visibility ?? 1) >= VIS_THRESHOLD
                   && (!rHip || rAnkle.y >= rHip.y)
  const lFootValid = lAnkleValid && lFoot.y >= lAnkle.y - FOOT_TOLERANCE
  const rFootValid = rAnkleValid && rFoot.y >= rAnkle.y - FOOT_TOLERANCE

  const resolved = side === 'auto' ? detectFrameSide(landmarks) : side
  if (resolved === 'left')  return lFootValid ? Math.round(90 - calcAngle(lKnee, lAnkle, lFoot)) : 0
  if (resolved === 'right') return rFootValid ? Math.round(90 - calcAngle(rKnee, rAnkle, rFoot)) : 0

  const values: number[] = []
  if (lFootValid) values.push(90 - calcAngle(lKnee, lAnkle, lFoot))
  if (rFootValid) values.push(90 - calcAngle(rKnee, rAnkle, rFoot))
  if (values.length === 0) return 0
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length)
}

/** 体幹傾斜角度（垂直方向からの傾き・度数） */
export function calculateTrunkAngle(landmarks: PoseLandmarks): number {
  if (landmarks.length === 0) return 0
  const lShoulder = landmarks[LM.LEFT_SHOULDER]
  const rShoulder = landmarks[LM.RIGHT_SHOULDER]
  const lHip = landmarks[LM.LEFT_HIP]
  const rHip = landmarks[LM.RIGHT_HIP]

  if (!lShoulder || !rShoulder || !lHip || !rHip) return 0

  const shoulderMid = midpoint(lShoulder, rShoulder)
  const hipMid = midpoint(lHip, rHip)

  // 垂直軸との角度（xの差分 / yの差分）
  const dx = shoulderMid.x - hipMid.x
  const dy = shoulderMid.y - hipMid.y
  if (dy === 0) return 0
  return Math.round(Math.atan2(Math.abs(dx), Math.abs(dy)) * (180 / Math.PI))
}

/** 全関節角度を一度に計算（矢状面用） */
export function calculateAllAngles(landmarks: PoseLandmarks, side: Side = 'auto') {
  return {
    hip:   calculateHipAngle(landmarks, side),
    knee:  calculateKneeAngle(landmarks, side),
    ankle: calculateAnkleAngle(landmarks, side),
    trunk: calculateTrunkAngle(landmarks), // 体幹は左右対称なので常に両側
  }
}

/**
 * 全フレームのランドマーク visibility スコアから撮影側を自動判定する。
 * 下肢3関節（股・膝・足首）の visibility 合計を左右で比較し、高い方を返す。
 */
export function detectSideFromVisibility(allLandmarks: PoseLandmarks[]): 'left' | 'right' {
  let leftVis = 0, rightVis = 0
  for (const lm of allLandmarks) {
    if (!lm || lm.length === 0) continue
    leftVis  += (lm[LM.LEFT_HIP]?.visibility   ?? 0)
             +  (lm[LM.LEFT_KNEE]?.visibility   ?? 0)
             +  (lm[LM.LEFT_ANKLE]?.visibility  ?? 0)
    rightVis += (lm[LM.RIGHT_HIP]?.visibility   ?? 0)
             +  (lm[LM.RIGHT_KNEE]?.visibility  ?? 0)
             +  (lm[LM.RIGHT_ANKLE]?.visibility ?? 0)
  }
  return leftVis >= rightVis ? 'left' : 'right'
}

// ── 前額面専用 ────────────────────────────────────────────────────────────

/**
 * 【前額面】骨盤側方傾斜角（度）
 * 水平線から骨盤ラインがどれだけ傾いているか。
 * 正値 = 右骨盤下降（左 Trendelenburg）
 */
export function calculatePelvicObliquity(landmarks: PoseLandmarks): number {
  const lHip = landmarks[LM.LEFT_HIP]
  const rHip = landmarks[LM.RIGHT_HIP]
  if (!lHip || !rHip) return 0
  const dx = rHip.x - lHip.x
  const dy = rHip.y - lHip.y // 画像座標: 下方向が正
  if (Math.abs(dx) < 0.001) return 0
  return Math.round(Math.atan2(dy, Math.abs(dx)) * (180 / Math.PI))
}

/**
 * 【前額面】膝外反/内反偏位角（度）
 * 股関節-足首ラインの中点に対して膝が内側に入っていれば正値（外反 = valgus）、
 * 外側に開いていれば負値（内反 = varus）。左右平均を返す。
 *
 * 左膝外反: knee.x > midpoint(hip, ankle).x（膝が中心寄り = 画像上で右方向）
 * 右膝外反: knee.x < midpoint(hip, ankle).x（膝が中心寄り = 画像上で左方向）
 */
export function calculateKneeValgus(landmarks: PoseLandmarks): number {
  const lHip   = landmarks[LM.LEFT_HIP]
  const lKnee  = landmarks[LM.LEFT_KNEE]
  const lAnkle = landmarks[LM.LEFT_ANKLE]
  const rHip   = landmarks[LM.RIGHT_HIP]
  const rKnee  = landmarks[LM.RIGHT_KNEE]
  const rAnkle = landmarks[LM.RIGHT_ANKLE]
  if (!lHip || !lKnee || !lAnkle || !rHip || !rKnee || !rAnkle) return 0

  const lMidX = (lHip.x + lAnkle.x) / 2
  const rMidX = (rHip.x + rAnkle.x) / 2
  const lDev  = 180 - calcAngle(lHip, lKnee, lAnkle)
  const rDev  = 180 - calcAngle(rHip, rKnee, rAnkle)

  // 左: 膝が中心寄り（x大きい）= 外反 = 正
  const lSigned = lKnee.x > lMidX ? lDev : -lDev
  // 右: 膝が中心寄り（x小さい）= 外反 = 正
  const rSigned = rKnee.x < rMidX ? rDev : -rDev

  return Math.round((lSigned + rSigned) / 2)
}

/**
 * 【前額面】肩傾斜角（度）
 * 水平線から肩ラインがどれだけ傾いているか。
 * 正値 = 右肩下降。
 */
export function calculateShoulderObliquity(landmarks: PoseLandmarks): number {
  const lShoulder = landmarks[LM.LEFT_SHOULDER]
  const rShoulder = landmarks[LM.RIGHT_SHOULDER]
  if (!lShoulder || !rShoulder) return 0
  const dx = rShoulder.x - lShoulder.x
  const dy = rShoulder.y - lShoulder.y
  if (Math.abs(dx) < 0.001) return 0
  return Math.round(Math.atan2(dy, Math.abs(dx)) * (180 / Math.PI))
}

/**
 * 前額面の全角度を計算。
 * FrameData の同じフィールドに前額面の意味を割り当てる:
 *   hip   → 骨盤傾斜角
 *   knee  → 膝外反角
 *   ankle → 肩傾斜角
 *   trunk → 体幹側屈角（calculateTrunkAngle を流用: 垂直軸からの水平偏位）
 */
export function calculateFrontalAngles(landmarks: PoseLandmarks) {
  return {
    hip:   calculatePelvicObliquity(landmarks),
    knee:  calculateKneeValgus(landmarks),
    ankle: calculateShoulderObliquity(landmarks),
    trunk: calculateTrunkAngle(landmarks),
  }
}
