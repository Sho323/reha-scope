'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import type { FrameData } from '@/context/SessionContext'

const FPS = 15

interface GravityPlotProps {
  beforeData: FrameData[]
  afterData: FrameData[]
  beforeValidity?: boolean[]
  afterValidity?: boolean[]
  plane?: 'frontal' | 'sagittal'
  /** 動画の現在再生時刻（秒）— グラフにカーソルを表示 */
  currentTime?: number
  /** グラフをクリックしたときに呼ばれるコールバック（秒） */
  onSeek?: (time: number) => void
}

/**
 * 矢状面：縦軸 = 上下変位
 *   1 - gravityY で「上が大きい値」に変換し、平均を引いて0基準に正規化する。
 *   →「0 = 平均高さ」「正 = 平均より高い」「負 = 平均より低い」
 *
 * 前額面：縦軸 = 左右変位
 *   gravityX - 0.5 で「右が正・左が負・中央が0」に変換。
 */
function toValue(d: FrameData, plane: 'frontal' | 'sagittal'): number {
  return plane === 'sagittal'
    ? +(1 - (d.gravityY ?? 0.5)).toFixed(4)
    : +((d.gravityX ?? 0.5) - 0.5).toFixed(4)
}

function mean(vals: number[]): number {
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
}

function calcStats(vals: number[]) {
  if (!vals.length) return null
  const max = Math.max(...vals)
  const min = Math.min(...vals)
  return {
    range: +(max - min).toFixed(3),
    max:   +max.toFixed(3),
    min:   +min.toFixed(3),
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow px-3 py-2 text-xs">
      <div className="text-gray-500 mb-1">{label}秒</div>
      {payload.map((p: { name: string; value: number; color: string }) => (
        <div key={p.name} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span style={{ color: p.color }} className="font-medium">
            {p.name === 'before' ? 'Before' : 'After'}
          </span>
          <span className="text-gray-700">{p.value > 0 ? '+' : ''}{p.value.toFixed(3)}</span>
        </div>
      ))}
    </div>
  )
}

export default function GravityPlot({
  beforeData,
  afterData,
  beforeValidity,
  afterValidity,
  plane = 'sagittal',
  currentTime,
  onSeek,
}: GravityPlotProps) {
  const hasAfter = afterData.length > 0
  const isSagittal = plane === 'sagittal'

  // 矢状面は平均を引いてゼロ基準に（高さの絶対値より変動幅を見やすくする）
  // 無効フレームは null にしてグラフから除外（統計・平均にも含めない）
  const bRaw = beforeData.map((d, i) =>
    beforeValidity && beforeValidity[i] === false ? null : toValue(d, plane)
  )
  const aRaw = hasAfter ? afterData.map((d, i) =>
    afterValidity && afterValidity[i] === false ? null : toValue(d, plane)
  ) : []

  const bValid = bRaw.filter((v): v is number => v !== null)
  const aValid = aRaw.filter((v): v is number => v !== null)
  const bMean = isSagittal ? mean(bValid) : 0
  const aMean = isSagittal ? mean(aValid) : 0

  const bVals = bRaw.map(v => v === null ? null : +(v - bMean).toFixed(3))
  const aVals = aRaw.map(v => v === null ? null : +(v - aMean).toFixed(3))

  const maxLen = Math.max(bVals.length, aVals.length)
  const chartData = Array.from({ length: maxLen }, (_, i) => ({
    time:   +(i / FPS).toFixed(2),
    before: bVals[i] ?? null,
    after:  hasAfter ? (aVals[i] ?? null) : null,
  }))

  const bStats = calcStats(bVals.filter((v): v is number => v !== null))
  const aStats = hasAfter ? calcStats(aVals.filter((v): v is number => v !== null)) : null

  const deltaRange = bStats && aStats
    ? +((aStats.range - bStats.range) * (isSagittal ? 1 : 1)).toFixed(3)
    : null

  return (
    <div className="w-full">
      {/* ヘッダー */}
      <div className="flex items-baseline gap-2 mb-1 flex-wrap">
        <h3 className="text-sm font-bold text-gray-700">
          重心 {isSagittal ? '上下' : '左右'}変位
        </h3>
        <span className="text-[10px] text-gray-400">
          {isSagittal
            ? '垂直方向（＋＝平均より高い）'
            : '水平方向（＋＝右偏位　−＝左偏位）'}
        </span>
      </div>

      {/* 統計カード */}
      <div className={`grid ${hasAfter ? 'grid-cols-3' : 'grid-cols-1'} gap-2 mb-3`}>
        {bStats && (
          <StatCard
            color="#3b82f6"
            label="Before 変位量"
            value={bStats.range.toFixed(3)}
            sub={isSagittal
              ? `最高 +${bStats.max.toFixed(3)} / 最低 ${bStats.min.toFixed(3)}`
              : `最右 +${bStats.max.toFixed(3)} / 最左 ${bStats.min.toFixed(3)}`}
          />
        )}
        {aStats && (
          <StatCard
            color="#f97316"
            label="After 変位量"
            value={aStats.range.toFixed(3)}
            sub={isSagittal
              ? `最高 +${aStats.max.toFixed(3)} / 最低 ${aStats.min.toFixed(3)}`
              : `最右 +${aStats.max.toFixed(3)} / 最左 ${aStats.min.toFixed(3)}`}
          />
        )}
        {deltaRange !== null && (
          <StatCard
            color={deltaRange < 0 ? '#22c55e' : deltaRange > 0 ? '#ef4444' : '#6b7280'}
            label="変化量（After − Before）"
            value={`${deltaRange > 0 ? '+' : ''}${deltaRange.toFixed(3)}`}
            sub={deltaRange < 0 ? '変位量 減少（改善）' : deltaRange > 0 ? '変位量 増加' : '変化なし'}
            highlight
          />
        )}
      </div>

      {/* グラフ */}
      {onSeek && (
        <div className="flex justify-end mb-1">
          <span className="text-[10px] text-[#3b82f6] flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5" />
            </svg>
            グラフをクリックで動画シーク
          </span>
        </div>
      )}
      <ResponsiveContainer width="100%" height={200}>
        <LineChart
          data={chartData}
          margin={{ top: 4, right: 8, left: 0, bottom: 24 }}
          onClick={e => {
            const t = e?.activeLabel
            if (t !== undefined && onSeek) onSeek(Number(t))
          }}
          style={{ cursor: onSeek ? 'crosshair' : undefined }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
          <XAxis
            dataKey="time"
            tick={{ fontSize: 10, fill: '#9ca3af' }}
            tickLine={false}
            axisLine={{ stroke: '#e5e7eb' }}
            label={{ value: '時間（秒）', position: 'insideBottom', offset: -12, fontSize: 10, fill: '#9ca3af' }}
          />
          <YAxis
            tick={{ fontSize: 10, fill: '#9ca3af' }}
            tickLine={false}
            axisLine={false}
            width={44}
            tickFormatter={v => v.toFixed(2)}
          />
          {/* ゼロ基準線 */}
          <ReferenceLine y={0} stroke="#d1d5db" strokeWidth={1} />

          {/* 動画再生位置カーソル */}
          {currentTime !== undefined && (
            <ReferenceLine
              x={+currentTime.toFixed(2)}
              stroke="#1e3a5f"
              strokeWidth={1}
              strokeDasharray="4 3"
            />
          )}

          <Tooltip content={<CustomTooltip />} />

          <Line
            type="monotone" dataKey="before" name="before"
            stroke="#3b82f6" strokeWidth={2} dot={false} connectNulls
          />
          {hasAfter && (
            <Line
              type="monotone" dataKey="after" name="after"
              stroke="#f97316" strokeWidth={2} dot={false} connectNulls
            />
          )}
        </LineChart>
      </ResponsiveContainer>

      {/* 凡例 */}
      <div className="flex justify-center gap-6 mt-1">
        <LegendItem color="#3b82f6" label="Before" />
        {hasAfter && <LegendItem color="#f97316" label="After" />}
      </div>
    </div>
  )
}

function StatCard({ color, label, value, sub, highlight }: {
  color: string; label: string; value: string; sub: string; highlight?: boolean
}) {
  return (
    <div className={`rounded-xl px-3 py-2 text-center ${highlight ? 'bg-gray-50 border-2 border-gray-200' : 'bg-gray-50'}`}>
      <div className="text-[10px] text-gray-400 mb-0.5 leading-tight">{label}</div>
      <div className="text-lg font-bold leading-tight" style={{ color }}>{value}</div>
      <div className="text-[10px] text-gray-400 mt-0.5 leading-tight">{sub}</div>
    </div>
  )
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-5 h-[2px] rounded-full" style={{ background: color }} />
      <span className="text-xs text-gray-500">{label}</span>
    </div>
  )
}
