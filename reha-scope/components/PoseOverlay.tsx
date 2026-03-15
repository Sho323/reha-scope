'use client'

import { useEffect, useRef } from 'react'
import type { PoseLandmarks } from '@/lib/mediapipe'
import { calculateAllAngles } from '@/lib/angleCalc'

interface PoseOverlayProps {
  landmarks: PoseLandmarks | null
  width: number
  height: number
}

// 描画する骨格の接続
const CONNECTIONS: [number, number][] = [
  [11, 12], // 肩
  [11, 23], // 左体幹
  [12, 24], // 右体幹
  [23, 24], // 腰
  [23, 25], // 左大腿
  [24, 26], // 右大腿
  [25, 27], // 左下腿
  [26, 28], // 右下腿
  [27, 31], // 左足
  [28, 32], // 右足
]

const JOINT_COLORS: Record<number, string> = {
  11: '#22c55e', 12: '#22c55e', // 肩: 緑
  23: '#3b82f6', 24: '#3b82f6', // 腰: 青
  25: '#3b82f6', 26: '#3b82f6', // 膝: 青
  27: '#f97316', 28: '#f97316', // 足首: 橙
}

export default function PoseOverlay({ landmarks, width, height }: PoseOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, width, height)

    if (!landmarks || landmarks.length === 0) return

    // 骨格ライン描画
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 2
    for (const [i, j] of CONNECTIONS) {
      const a = landmarks[i]
      const b = landmarks[j]
      if (!a || !b) continue
      ctx.beginPath()
      ctx.moveTo(a.x * width, a.y * height)
      ctx.lineTo(b.x * width, b.y * height)
      ctx.stroke()
    }

    // 関節点描画
    const keyPoints = [11, 12, 23, 24, 25, 26, 27, 28, 31, 32]
    for (const idx of keyPoints) {
      const lm = landmarks[idx]
      if (!lm) continue
      ctx.beginPath()
      ctx.arc(lm.x * width, lm.y * height, 5, 0, 2 * Math.PI)
      ctx.fillStyle = JOINT_COLORS[idx] ?? '#ffffff'
      ctx.fill()
    }

    // 角度ラベル描画
    const angles = calculateAllAngles(landmarks)
    const labelPositions = [
      { lm: 23, label: `股 ${angles.hip}°`, color: '#3b82f6' },
      { lm: 25, label: `膝 ${angles.knee}°`, color: '#3b82f6' },
      { lm: 27, label: `足 ${angles.ankle}°`, color: '#f97316' },
      { lm: 11, label: `体幹 ${angles.trunk}°`, color: '#22c55e' },
    ]

    ctx.font = 'bold 13px sans-serif'
    for (const { lm: idx, label, color } of labelPositions) {
      const lm = landmarks[idx]
      if (!lm) continue
      const x = lm.x * width + 8
      const y = lm.y * height - 4
      ctx.fillStyle = 'rgba(0,0,0,0.6)'
      ctx.fillRect(x - 2, y - 12, label.length * 7.5, 16)
      ctx.fillStyle = color
      ctx.fillText(label, x, y)
    }
  }, [landmarks, width, height])

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
