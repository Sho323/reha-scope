'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import type { FrameData } from '@/context/SessionContext'

interface AngleGraphProps {
  beforeData: FrameData[]
  afterData: FrameData[]
  selectedJoint?: 'hip' | 'knee' | 'ankle' | 'trunk'
}

const JOINT_LABELS: Record<string, string> = {
  hip: '股関節',
  knee: '膝関節',
  ankle: '足関節',
  trunk: '体幹',
}

export default function AngleGraph({
  beforeData,
  afterData,
  selectedJoint,
}: AngleGraphProps) {
  // グラフ用データ結合
  const maxLen = Math.max(beforeData.length, afterData.length)
  const chartData = Array.from({ length: maxLen }, (_, i) => ({
    frame: i,
    beforeHip: beforeData[i]?.hip ?? null,
    afterHip: afterData[i]?.hip ?? null,
    beforeKnee: beforeData[i]?.knee ?? null,
    afterKnee: afterData[i]?.knee ?? null,
    beforeAnkle: beforeData[i]?.ankle ?? null,
    afterAnkle: afterData[i]?.ankle ?? null,
    beforeTrunk: beforeData[i]?.trunk ?? null,
    afterTrunk: afterData[i]?.trunk ?? null,
  }))

  const joints = selectedJoint
    ? [selectedJoint]
    : (['hip', 'knee', 'ankle', 'trunk'] as const)

  return (
    <div data-testid="angle-graph" className="w-full">
      <h3 className="text-sm font-semibold text-gray-600 mb-3">関節角度グラフ（度）</h3>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="frame"
            tick={{ fontSize: 11 }}
            label={{ value: 'フレーム', position: 'insideBottom', offset: -2, fontSize: 11 }}
          />
          <YAxis tick={{ fontSize: 11 }} unit="°" />
          <Tooltip
            formatter={(value: unknown) => [`${value}°`]}
            contentStyle={{ fontSize: 12 }}
          />
          <Legend
            formatter={value => value}
            wrapperStyle={{ fontSize: 11 }}
          />
          {joints.map(joint => (
            <>
              <Line
                key={`before-${joint}`}
                type="monotone"
                dataKey={`before${joint.charAt(0).toUpperCase() + joint.slice(1)}`}
                name={`Before ${JOINT_LABELS[joint]}`}
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
                strokeDasharray={joint === 'hip' ? undefined : joint === 'knee' ? '5 3' : joint === 'ankle' ? '2 2' : '8 3'}
                connectNulls
              />
              <Line
                key={`after-${joint}`}
                type="monotone"
                dataKey={`after${joint.charAt(0).toUpperCase() + joint.slice(1)}`}
                name={`After ${JOINT_LABELS[joint]}`}
                stroke="#f97316"
                strokeWidth={2}
                dot={false}
                strokeDasharray={joint === 'hip' ? undefined : joint === 'knee' ? '5 3' : joint === 'ankle' ? '2 2' : '8 3'}
                connectNulls
              />
            </>
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
