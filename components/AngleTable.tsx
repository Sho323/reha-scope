'use client'

import type { FrameData } from '@/context/SessionContext'

interface AngleTableProps {
  before: FrameData | null
  after: FrameData | null
  plane?: 'frontal' | 'sagittal'
}

const SAGITTAL_ROWS = [
  { key: 'hip'   as const, label: '股関節屈曲角', unit: '°' },
  { key: 'knee'  as const, label: '膝関節屈曲角', unit: '°' },
  { key: 'ankle' as const, label: '足関節背屈角', unit: '°' },
  { key: 'trunk' as const, label: '体幹前傾角',   unit: '°' },
]

const FRONTAL_ROWS = [
  { key: 'hip'   as const, label: '骨盤傾斜角',    unit: '°' },
  { key: 'knee'  as const, label: '膝外反/内反角', unit: '°' },
  { key: 'ankle' as const, label: '肩傾斜角',      unit: '°' },
  { key: 'trunk' as const, label: '体幹側屈角',    unit: '°' },
]

export default function AngleTable({ before, after, plane = 'sagittal' }: AngleTableProps) {
  const rows = plane === 'frontal' ? FRONTAL_ROWS : SAGITTAL_ROWS

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-[#1e3a5f] text-white">
            <th className="px-4 py-2 text-left font-semibold">
              計測項目
              <span className={`ml-2 text-[10px] font-normal px-1.5 py-0.5 rounded-full ${
                plane === 'frontal' ? 'bg-purple-400' : 'bg-blue-400'
              }`}>
                {plane === 'frontal' ? '前額面' : '矢状面'}
              </span>
            </th>
            <th className="px-4 py-2 text-center font-semibold text-[#93c5fd]">Before</th>
            <th className="px-4 py-2 text-center font-semibold text-[#fed7aa]">After</th>
            <th className="px-4 py-2 text-center font-semibold">Δ（変化量）</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const bVal = before?.[row.key] ?? null
            const aVal = after?.[row.key] ?? null
            const delta = bVal !== null && aVal !== null ? aVal - bVal : null

            return (
              <tr key={row.key} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="px-4 py-2 font-medium text-gray-700">{row.label}</td>
                <td className="px-4 py-2 text-center text-[#3b82f6] font-mono">
                  {bVal !== null ? `${bVal}${row.unit}` : '—'}
                </td>
                <td className="px-4 py-2 text-center text-[#f97316] font-mono">
                  {aVal !== null ? `${aVal}${row.unit}` : '—'}
                </td>
                <td className={`px-4 py-2 text-center font-mono font-bold ${
                  delta === null ? 'text-gray-400'
                  : delta > 0 ? 'text-green-600'
                  : delta < 0 ? 'text-red-500'
                  : 'text-gray-500'
                }`}>
                  {delta !== null ? `${delta > 0 ? '+' : ''}${delta}${row.unit}` : '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
