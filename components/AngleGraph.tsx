'use client'

import { useState } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
} from 'recharts'
import type { FrameData } from '@/context/SessionContext'

const FPS = 15

const SAGITTAL_JOINTS = [
  { key: 'hip',   label: '股関節屈曲角', shortLabel: '股関節',  description: '大腿-体幹のなす角' },
  { key: 'knee',  label: '膝関節屈曲角', shortLabel: '膝関節',  description: '大腿-下腿のなす角' },
  { key: 'ankle', label: '足関節背屈角', shortLabel: '足関節',  description: '下腿-足部のなす角' },
  { key: 'trunk', label: '体幹前傾角',   shortLabel: '体幹',    description: '垂直軸からの前傾' },
] as const

const FRONTAL_JOINTS = [
  { key: 'hip',   label: '骨盤傾斜角',    shortLabel: '骨盤',    description: '骨盤の水平からの傾き（+:右下降）' },
  { key: 'knee',  label: '膝外反/内反角', shortLabel: '膝外反',  description: '外反（valgus）=＋　内反（varus）=−' },
  { key: 'ankle', label: '肩傾斜角',      shortLabel: '肩',      description: '肩ラインの水平からの傾き（+:右下降）' },
  { key: 'trunk', label: '体幹側屈角',    shortLabel: '体幹側屈', description: '垂直軸からの側方偏位' },
] as const

type JointKey = 'hip' | 'knee' | 'ankle' | 'trunk'

interface AngleGraphProps {
  beforeData: FrameData[]
  afterData: FrameData[]
  beforeValidity?: boolean[]
  afterValidity?: boolean[]
  plane?: 'frontal' | 'sagittal'
  selectedJoint?: JointKey
  /** 動画の現在再生時刻（秒）— グラフにカーソル縦線を表示 */
  currentTime?: number
  /** グラフをクリックしたときに呼ばれるコールバック（秒） */
  onSeek?: (time: number) => void
}

// validity フィルタ付き統計計算
function calcStats(data: FrameData[], key: JointKey, validity?: boolean[]) {
  const vals = data
    .filter((_, i) => !validity || validity[i])
    .map(d => d[key])
    .filter((v): v is number => v != null)
  if (vals.length === 0) return { avg: '—', max: '—', min: '—' }
  const avg = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
  return {
    avg: `${avg}°`,
    max: `${Math.round(Math.max(...vals))}°`,
    min: `${Math.round(Math.min(...vals))}°`,
  }
}

function deltaLabel(
  beforeData: FrameData[], afterData: FrameData[], key: JointKey,
  beforeValidity?: boolean[], afterValidity?: boolean[]
) {
  const bVals = beforeData
    .filter((_, i) => !beforeValidity || beforeValidity[i])
    .map(d => d[key]).filter((v): v is number => v != null)
  const aVals = afterData
    .filter((_, i) => !afterValidity || afterValidity[i])
    .map(d => d[key]).filter((v): v is number => v != null)
  if (!bVals.length || !aVals.length) return { text: '—', positive: null }
  const bAvg = bVals.reduce((a, b) => a + b, 0) / bVals.length
  const aAvg = aVals.reduce((a, b) => a + b, 0) / aVals.length
  const d = Math.round(aAvg - bAvg)
  return { text: `${d > 0 ? '+' : ''}${d}°`, positive: d > 0 ? true : d < 0 ? false : null }
}

/** 無効フレーム区間を [x1, x2] ペアの配列で返す */
function getInvalidSegments(validity: boolean[], fps: number) {
  const segments: { x1: number; x2: number }[] = []
  let inInvalid = false
  let segStart = 0
  for (let i = 0; i < validity.length; i++) {
    if (!validity[i] && !inInvalid) { inInvalid = true; segStart = i / fps }
    if ( validity[i] &&  inInvalid) { inInvalid = false; segments.push({ x1: segStart, x2: i / fps }) }
  }
  if (inInvalid) segments.push({ x1: segStart, x2: validity.length / fps })
  return segments
}

function validityRatio(validity?: boolean[]) {
  if (!validity || !validity.length) return null
  const v = validity.filter(Boolean).length
  return Math.round((v / validity.length) * 100)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label, beforeValidity, afterValidity }: any) {
  if (!active || !payload?.length) return null
  const frameIdx = Math.round(label * FPS)
  const bValid = !beforeValidity || beforeValidity[frameIdx] !== false
  const aValid = !afterValidity  || afterValidity[frameIdx]  !== false
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow px-3 py-2 text-xs">
      <div className="text-gray-500 mb-1">{label}秒</div>
      {payload.map((p: { name: string; value: number; color: string }) => {
        const isValid = p.name === 'before' ? bValid : aValid
        return (
          <div key={p.name} className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
            <span className="font-medium" style={{ color: p.color }}>
              {p.name === 'before' ? 'Before' : 'After'}
            </span>
            <span className="text-gray-700">{p.value}°</span>
            {!isValid && <span className="text-amber-500 text-[10px]">（除外）</span>}
          </div>
        )
      })}
    </div>
  )
}

export default function AngleGraph({
  beforeData, afterData,
  beforeValidity, afterValidity,
  plane = 'sagittal', selectedJoint,
  currentTime,
  onSeek,
}: AngleGraphProps) {
  const joints = plane === 'frontal' ? FRONTAL_JOINTS : SAGITTAL_JOINTS
  const [activeJoint, setActiveJoint] = useState<JointKey>('hip')
  const joint = selectedJoint ?? activeJoint
  const jointMeta = joints.find(j => j.key === joint) ?? joints[0]

  const maxLen = Math.max(beforeData.length, afterData.length)
  const chartData = Array.from({ length: maxLen }, (_, i) => ({
    time: +(i / FPS).toFixed(2),
    before: beforeData[i]?.[joint] ?? null,
    after:  afterData[i]?.[joint] ?? null,
  }))

  // 無効区間（グラフに灰色帯を表示）
  const bInvalidSegs = beforeValidity ? getInvalidSegments(beforeValidity, FPS) : []
  const aInvalidSegs = afterValidity  ? getInvalidSegments(afterValidity,  FPS) : []
  // Before と After の無効区間をマージ（いずれかが無効なら除外表示）
  const allInvalidSegs = [...bInvalidSegs, ...aInvalidSegs]

  const hasAfter = afterData.length > 0
  const bStats = calcStats(beforeData, joint, beforeValidity)
  const aStats = hasAfter ? calcStats(afterData, joint, afterValidity) : null
  const delta  = hasAfter ? deltaLabel(beforeData, afterData, joint, beforeValidity, afterValidity) : null

  const bRatio = validityRatio(beforeValidity)
  const aRatio = validityRatio(afterValidity)
  const hasExclusion = (bRatio !== null && bRatio < 100) || (aRatio !== null && aRatio < 100)

  return (
    <div data-testid="angle-graph" className="w-full">

      {/* ヘッダー行 */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
          plane === 'frontal' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
        }`}>
          {plane === 'frontal' ? '前額面' : '矢状面'}
        </span>

        {/* 往復検出バッジ */}
        {hasExclusion && (
          <span className="flex items-center gap-1 text-[10px] bg-amber-50 border border-amber-200 text-amber-700 px-2 py-0.5 rounded-full">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            方向転換を検出 — 灰色区間は統計から除外
          </span>
        )}

        {/* 有効フレーム率 */}
        {bRatio !== null && (
          <span className="text-[10px] text-gray-400">
            有効 Before {bRatio}% / After {aRatio}%
          </span>
        )}
      </div>

      {/* 関節タブ */}
      {!selectedJoint && (
        <div className="flex gap-2 mb-4 flex-wrap">
          {joints.map(j => (
            <button
              key={j.key}
              onClick={() => setActiveJoint(j.key)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition border ${
                activeJoint === j.key
                  ? 'bg-[#1e3a5f] text-white border-[#1e3a5f]'
                  : 'bg-white text-gray-500 border-gray-300 hover:border-[#1e3a5f] hover:text-[#1e3a5f]'
              }`}
            >
              {j.shortLabel}
            </button>
          ))}
        </div>
      )}

      {/* タイトル + 操作ヒント */}
      <div className="flex items-start justify-between mb-3 gap-2 flex-wrap">
        <div>
          <h3 className="text-sm font-bold text-gray-700">{jointMeta.label}</h3>
          <span className="text-[10px] text-gray-400 hidden sm:inline">（°） — {jointMeta.description}</span>
        </div>
        {onSeek && (
          <span className="text-[10px] text-[#3b82f6] flex items-center gap-1 flex-shrink-0">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5" />
            </svg>
            <span className="hidden sm:inline">グラフをクリックで動画シーク</span>
            <span className="sm:hidden">タップでシーク</span>
          </span>
        )}
      </div>

      {/* 統計カード（有効フレームのみ） */}
      <div className={`grid ${hasAfter ? 'grid-cols-3' : 'grid-cols-1 max-w-xs'} gap-2 mb-4`}>
        <StatCard color="#3b82f6" label="Before 平均" value={bStats.avg} sub={`最大 ${bStats.max} / 最小 ${bStats.min}`} />
        {aStats && (
          <StatCard color="#f97316" label="After 平均" value={aStats.avg} sub={`最大 ${aStats.max} / 最小 ${aStats.min}`} />
        )}
        {delta && (
          <StatCard
            color={delta.positive === true ? '#22c55e' : delta.positive === false ? '#ef4444' : '#6b7280'}
            label="変化量（After − Before）"
            value={delta.text}
            sub={delta.positive === true ? '増加' : delta.positive === false ? '減少' : '変化なし'}
            highlight
          />
        )}
      </div>

      {/* グラフ */}
      <ResponsiveContainer width="100%" height={260}>
        <LineChart
          data={chartData}
          margin={{ top: 4, right: 16, left: 0, bottom: 24 }}
          onClick={(e) => {
            const t = e?.activeLabel
            if (t !== undefined && onSeek) onSeek(Number(t))
          }}
          style={{ cursor: onSeek ? 'crosshair' : undefined }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
          <XAxis
            dataKey="time"
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            tickLine={false}
            axisLine={{ stroke: '#e5e7eb' }}
            label={{ value: '時間（秒）', position: 'insideBottom', offset: -12, fontSize: 11, fill: '#9ca3af' }}
          />
          <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false} unit="°" width={38} />
          <ReferenceLine y={0} stroke="#d1d5db" strokeWidth={1} />

          {/* 無効区間を灰色帯で表示 */}
          {allInvalidSegs.map((seg, i) => (
            <ReferenceArea
              key={i}
              x1={seg.x1}
              x2={seg.x2}
              fill="#f3f4f6"
              fillOpacity={0.85}
              stroke="#d1d5db"
              strokeWidth={0.5}
              label={{ value: '除外', position: 'insideTop', fontSize: 9, fill: '#9ca3af' }}
            />
          ))}

          <Tooltip content={
            <CustomTooltip
              beforeValidity={beforeValidity}
              afterValidity={afterValidity}
            />
          } />

          {/* 動画再生位置カーソル */}
          {currentTime !== undefined && (
            <ReferenceLine
              x={+currentTime.toFixed(2)}
              stroke="#1e3a5f"
              strokeWidth={0.5}
              strokeDasharray="3 3"
              label={{
                value: `▶ ${currentTime.toFixed(1)}s`,
                position: 'top',
                fontSize: 8,
                fill: '#1e3a5f',
                fontWeight: 'normal',
              }}
            />
          )}

          <Line type="monotone" dataKey="before" name="before" stroke="#3b82f6" strokeWidth={2.5} dot={false} connectNulls />
          {hasAfter && <Line type="monotone" dataKey="after" name="after" stroke="#f97316" strokeWidth={2.5} dot={false} connectNulls />}
        </LineChart>
      </ResponsiveContainer>

      {/* 凡例 */}
      <div className="flex justify-center gap-6 mt-1">
        <LegendItem color="#3b82f6" label="Before" />
        {hasAfter && <LegendItem color="#f97316" label="After" />}
        {hasExclusion && (
          <div className="flex items-center gap-2">
            <div className="w-6 h-3 rounded bg-gray-200 border border-gray-300" />
            <span className="text-xs text-gray-400">除外区間</span>
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ color, label, value, sub, highlight }: {
  color: string; label: string; value: string; sub: string; highlight?: boolean
}) {
  return (
    <div className={`rounded-xl px-3 py-2.5 text-center ${highlight ? 'bg-gray-50 border-2 border-gray-200' : 'bg-gray-50'}`}>
      <div className="text-[10px] text-gray-400 mb-0.5 leading-tight">{label}</div>
      <div className="text-xl font-bold leading-tight" style={{ color }}>{value}</div>
      <div className="text-[10px] text-gray-400 mt-0.5 leading-tight">{sub}</div>
    </div>
  )
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-6 h-[3px] rounded-full" style={{ background: color }} />
      <span className="text-xs text-gray-500">{label}</span>
    </div>
  )
}
