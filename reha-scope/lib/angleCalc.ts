import type { Landmark, PoseLandmarks } from './mediapipe'

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

/** 股関節屈曲角度（左右平均） */
export function calculateHipAngle(landmarks: PoseLandmarks): number {
  if (landmarks.length === 0) return 0
  const lShoulder = landmarks[LM.LEFT_SHOULDER]
  const lHip = landmarks[LM.LEFT_HIP]
  const lKnee = landmarks[LM.LEFT_KNEE]
  const rShoulder = landmarks[LM.RIGHT_SHOULDER]
  const rHip = landmarks[LM.RIGHT_HIP]
  const rKnee = landmarks[LM.RIGHT_KNEE]

  if (!lShoulder || !lHip || !lKnee || !rShoulder || !rHip || !rKnee) return 0

  const leftAngle = calcAngle(lShoulder, lHip, lKnee)
  const rightAngle = calcAngle(rShoulder, rHip, rKnee)
  return Math.round((leftAngle + rightAngle) / 2)
}

/** 膝関節屈曲角度（左右平均） */
export function calculateKneeAngle(landmarks: PoseLandmarks): number {
  if (landmarks.length === 0) return 0
  const lHip = landmarks[LM.LEFT_HIP]
  const lKnee = landmarks[LM.LEFT_KNEE]
  const lAnkle = landmarks[LM.LEFT_ANKLE]
  const rHip = landmarks[LM.RIGHT_HIP]
  const rKnee = landmarks[LM.RIGHT_KNEE]
  const rAnkle = landmarks[LM.RIGHT_ANKLE]

  if (!lHip || !lKnee || !lAnkle || !rHip || !rKnee || !rAnkle) return 0

  const leftAngle = calcAngle(lHip, lKnee, lAnkle)
  const rightAngle = calcAngle(rHip, rKnee, rAnkle)
  return Math.round((leftAngle + rightAngle) / 2)
}

/** 足関節背屈角度（左右平均） */
export function calculateAnkleAngle(landmarks: PoseLandmarks): number {
  if (landmarks.length === 0) return 0
  const lKnee = landmarks[LM.LEFT_KNEE]
  const lAnkle = landmarks[LM.LEFT_ANKLE]
  const lFoot = landmarks[LM.LEFT_FOOT_INDEX]
  const rKnee = landmarks[LM.RIGHT_KNEE]
  const rAnkle = landmarks[LM.RIGHT_ANKLE]
  const rFoot = landmarks[LM.RIGHT_FOOT_INDEX]

  if (!lKnee || !lAnkle || !lFoot || !rKnee || !rAnkle || !rFoot) return 0

  const leftAngle = calcAngle(lKnee, lAnkle, lFoot)
  const rightAngle = calcAngle(rKnee, rAnkle, rFoot)
  return Math.round((leftAngle + rightAngle) / 2)
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

/** 全関節角度を一度に計算 */
export function calculateAllAngles(landmarks: PoseLandmarks) {
  return {
    hip: calculateHipAngle(landmarks),
    knee: calculateKneeAngle(landmarks),
    ankle: calculateAnkleAngle(landmarks),
    trunk: calculateTrunkAngle(landmarks),
  }
}
