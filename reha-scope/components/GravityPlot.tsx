'use client'

import type { FrameData } from '@/context/SessionContext'

interface GravityPlotProps {
  beforeData: FrameData[]
  afterData: FrameData[]
  currentFrame?: number
}

const FOOT_WIDTH = 120
const FOOT_HEIGHT = 180
const PAD = 20

export default function GravityPlot({ beforeData, afterData, currentFrame }: GravityPlotProps) {
  const W = FOOT_WIDTH + PAD * 2
  const H = FOOT_HEIGHT + PAD * 2

  const toSvgX = (nx: number) => PAD + nx * FOOT_WIDTH
  const toSvgY = (ny: number) => PAD + ny * FOOT_HEIGHT

  const beforePoint = currentFrame !== undefined
    ? beforeData[currentFrame]
    : beforeData[Math.floor(beforeData.length / 2)]

  const afterPoint = currentFrame !== undefined
    ? afterData[currentFrame]
    : afterData[Math.floor(afterData.length / 2)]

  return (
    <div className="flex flex-col items-center">
      <h3 className="text-sm font-semibold text-gray-600 mb-2">重心位置プロット</h3>
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        className="border border-gray-200 rounded-lg bg-gray-50"
      >
        {/* 足底アウトライン（簡略化） */}
        <ellipse
          cx={W / 2}
          cy={H * 0.65}
          rx={FOOT_WIDTH * 0.42}
          ry={FOOT_HEIGHT * 0.33}
          fill="#e5e7eb"
          stroke="#9ca3af"
          strokeWidth={1}
        />
        {/* つま先 */}
        <ellipse
          cx={W / 2}
          cy={PAD + FOOT_HEIGHT * 0.18}
          rx={FOOT_WIDTH * 0.3}
          ry={FOOT_HEIGHT * 0.18}
          fill="#e5e7eb"
          stroke="#9ca3af"
          strokeWidth={1}
        />

        {/* 中心線 */}
        <line x1={W / 2} y1={PAD} x2={W / 2} y2={H - PAD} stroke="#d1d5db" strokeWidth={1} strokeDasharray="4 2" />
        <line x1={PAD} y1={H / 2} x2={W - PAD} y2={H / 2} stroke="#d1d5db" strokeWidth={1} strokeDasharray="4 2" />

        {/* Before重心点 */}
        {beforePoint && (
          <>
            <circle
              cx={toSvgX(beforePoint.gravityX ?? 0.5)}
              cy={toSvgY(beforePoint.gravityY ?? 0.5)}
              r={8}
              fill="#3b82f6"
              opacity={0.8}
            />
            <text
              x={toSvgX(beforePoint.gravityX ?? 0.5) + 10}
              y={toSvgY(beforePoint.gravityY ?? 0.5) + 4}
              fontSize={10}
              fill="#3b82f6"
              fontWeight="bold"
            >
              B
            </text>
          </>
        )}

        {/* After重心点 */}
        {afterPoint && (
          <>
            <circle
              cx={toSvgX(afterPoint.gravityX ?? 0.5)}
              cy={toSvgY(afterPoint.gravityY ?? 0.5)}
              r={8}
              fill="#f97316"
              opacity={0.8}
            />
            <text
              x={toSvgX(afterPoint.gravityX ?? 0.5) + 10}
              y={toSvgY(afterPoint.gravityY ?? 0.5) + 4}
              fontSize={10}
              fill="#f97316"
              fontWeight="bold"
            >
              A
            </text>
          </>
        )}
      </svg>

      {/* 凡例 */}
      <div className="flex gap-4 mt-2 text-xs text-gray-600">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-[#3b82f6]" />
          <span>Before</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-[#f97316]" />
          <span>After</span>
        </div>
      </div>
    </div>
  )
}
