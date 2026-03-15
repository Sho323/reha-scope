'use client'

import type { FrameData } from '@/context/SessionContext'

interface AngleTableProps {
  before: FrameData | null
  after: FrameData | null
}

const ROWS = [
  { key: 'hip' as const, label: '股関節', unit: '°' },
  { key: 'knee' as const, label: '膝関節', unit: '°' },
  { key: 'ankle' as const, label: '足関節', unit: '°' },
  { key: 'trunk' as const, label: '体幹傾斜', unit: '°' },
]

export default function AngleTable({ before, after }: AngleTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-[#1e3a5f] text-white">
            <th className="px-4 py-2 text-left font-semibold">関節</th>
            <th className="px-4 py-2 text-center font-semibold text-[#93c5fd]">Before</th>
            <th className="px-4 py-2 text-center font-semibold text-[#fed7aa]">After</th>
            <th className="px-4 py-2 text-center font-semibold">Δ（変化量）</th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row, i) => {
            const bVal = before?.[row.key] ?? null
            const aVal = after?.[row.key] ?? null
            const delta = bVal !== null && aVal !== null ? aVal - bVal : null

            return (
              <tr
                key={row.key}
                className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
              >
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
