'use client'

import { useEffect, useRef } from 'react'
import type { PoseLandmarks } from '@/lib/mediapipe'
import { calculateAllAngles, calculateFrontalAngles } from '@/lib/angleCalc'

interface PoseOverlayProps {
  landmarks: PoseLandmarks | null
  /** コンテナ要素の表示サイズ（px） */
  width: number
  height: number
  /** 動画の実際のピクセルサイズ（object-contain のレターボックス補正に使用） */
  videoNaturalWidth?: number
  videoNaturalHeight?: number
  plane?: 'frontal' | 'sagittal'
}

const CONNECTIONS: [number, number][] = [
  [11, 12], [11, 23], [12, 24], [23, 24],
  [23, 25], [24, 26], [25, 27], [26, 28],
  [27, 31], [28, 32],
]

/**
 * 解剖学的に不正なランドマークを除外したインデックスセットを返す。
 *
 * FOOT_TOLERANCE: 背屈時につま先がわずかに持ち上がる場合（立ち上がり動作など）を
 * 誤排除しないよう、差が閾値以上の場合のみ無効とする。
 */
const FOOT_TOLERANCE = 0.08
/** visibility がこの値未満のランドマークは信頼できないとして除外 */
const VIS_THRESHOLD = 0.35

function getInvalidLandmarks(lm: PoseLandmarks): Set<number> {
  const invalid = new Set<number>()

  // ① visibility が低いランドマーク（MediaPipe が自信を持てていない）
  const lowerBody = [23, 24, 25, 26, 27, 28, 29, 30, 31, 32]
  for (const idx of lowerBody) {
    if (lm[idx] && (lm[idx].visibility ?? 1) < VIS_THRESHOLD) invalid.add(idx)
  }

  // ② 解剖学的順序チェック: 膝が股関節より上（y値が小さい）= 誤検出
  if (lm[25] && lm[23] && lm[25].y < lm[23].y) { invalid.add(25); invalid.add(27); invalid.add(31) }
  if (lm[26] && lm[24] && lm[26].y < lm[24].y) { invalid.add(26); invalid.add(28); invalid.add(32) }

  // ③ 解剖学的順序チェック: 足首が股関節より上 = 誤検出
  if (lm[27] && lm[23] && lm[27].y < lm[23].y) { invalid.add(27); invalid.add(31) }
  if (lm[28] && lm[24] && lm[28].y < lm[24].y) { invalid.add(28); invalid.add(32) }

  // ④ 足首が膝より FOOT_TOLERANCE 以上上（既存ロジック、許容幅付き）
  if (lm[27] && lm[25] && !invalid.has(25) && lm[27].y < lm[25].y - FOOT_TOLERANCE) { invalid.add(27); invalid.add(31) }
  if (lm[28] && lm[26] && !invalid.has(26) && lm[28].y < lm[26].y - FOOT_TOLERANCE) { invalid.add(28); invalid.add(32) }

  // ⑤ foot_index が足首より FOOT_TOLERANCE 以上上（既存ロジック）
  if (lm[31] && lm[27] && !invalid.has(27) && lm[31].y < lm[27].y - FOOT_TOLERANCE) { invalid.add(31) }
  if (lm[32] && lm[28] && !invalid.has(28) && lm[32].y < lm[28].y - FOOT_TOLERANCE) { invalid.add(32) }

  return invalid
}

const JOINT_COLORS: Record<number, string> = {
  11: '#22c55e', 12: '#22c55e',
  23: '#3b82f6', 24: '#3b82f6',
  25: '#3b82f6', 26: '#3b82f6',
  27: '#f97316', 28: '#f97316',
}

/**
 * object-contain でビデオが表示される実際の描画領域を計算する。
 * ランドマーク正規化座標をコンテナ座標へ変換するために必要。
 */
function getContainRect(
  cW: number, cH: number,
  vW: number, vH: number
): { x: number; y: number; w: number; h: number } {
  if (!vW || !vH) return { x: 0, y: 0, w: cW, h: cH }
  const scale = Math.min(cW / vW, cH / vH)
  const w = vW * scale
  const h = vH * scale
  return { x: (cW - w) / 2, y: (cH - h) / 2, w, h }
}

export default function PoseOverlay({
  landmarks,
  width,
  height,
  videoNaturalWidth,
  videoNaturalHeight,
  plane = 'sagittal',
}: PoseOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, width, height)
    if (!landmarks || landmarks.length === 0) return

    // object-contain のレターボックスを考慮したマッピング
    const rect = getContainRect(width, height, videoNaturalWidth ?? 0, videoNaturalHeight ?? 0)
    const toX = (nx: number) => rect.x + nx * rect.w
    const toY = (ny: number) => rect.y + ny * rect.h

    // 解剖学的に不正なランドマークを除外
    const invalidLm = getInvalidLandmarks(landmarks)

    // 骨格ライン
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 2
    for (const [i, j] of CONNECTIONS) {
      if (invalidLm.has(i) || invalidLm.has(j)) continue
      const a = landmarks[i]
      const b = landmarks[j]
      if (!a || !b) continue
      ctx.beginPath()
      ctx.moveTo(toX(a.x), toY(a.y))
      ctx.lineTo(toX(b.x), toY(b.y))
      ctx.stroke()
    }

    // 関節点
    const keyPoints = [11, 12, 23, 24, 25, 26, 27, 28, 31, 32]
    for (const idx of keyPoints) {
      if (invalidLm.has(idx)) continue
      const lm = landmarks[idx]
      if (!lm) continue
      ctx.beginPath()
      ctx.arc(toX(lm.x), toY(lm.y), 5, 0, 2 * Math.PI)
      ctx.fillStyle = JOINT_COLORS[idx] ?? '#ffffff'
      ctx.fill()
    }

    // 角度ラベル
    const angles = plane === 'frontal'
      ? calculateFrontalAngles(landmarks)
      : calculateAllAngles(landmarks)

    const labelPositions = plane === 'frontal'
      ? [
          { lm: 23, label: `骨盤 ${angles.hip}°`,    color: '#a855f7' },
          { lm: 25, label: `膝外反 ${angles.knee}°`, color: '#3b82f6' },
          { lm: 11, label: `肩 ${angles.ankle}°`,    color: '#22c55e' },
          { lm: 24, label: `側屈 ${angles.trunk}°`,  color: '#f97316' },
        ]
      : [
          { lm: 23, label: `股 ${angles.hip}°`,     color: '#3b82f6' },
          { lm: 25, label: `膝 ${angles.knee}°`,    color: '#3b82f6' },
          { lm: 27, label: `足 ${angles.ankle}°`,   color: '#f97316' },
          { lm: 11, label: `体幹 ${angles.trunk}°`, color: '#22c55e' },
        ]

    ctx.font = 'bold 12px sans-serif'
    for (const { lm: idx, label, color } of labelPositions) {
      // ランドマークが解剖学的に無効な場合はラベルも表示しない
      if (invalidLm.has(idx)) continue
      const lm = landmarks[idx]
      if (!lm) continue
      const x = toX(lm.x) + 8
      const y = toY(lm.y) - 4
      ctx.fillStyle = 'rgba(0,0,0,0.65)'
      ctx.fillRect(x - 2, y - 12, label.length * 7, 16)
      ctx.fillStyle = color
      ctx.fillText(label, x, y)
    }
  }, [landmarks, width, height, videoNaturalWidth, videoNaturalHeight, plane])

  if (!landmarks || landmarks.length === 0) {
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <p className="text-yellow-400 text-xs bg-black/60 px-2 py-1 rounded">
          骨格を検出できませんでした
        </p>
      </div>
    )
  }

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="absolute inset-0 pointer-events-none"
    />
  )
}
