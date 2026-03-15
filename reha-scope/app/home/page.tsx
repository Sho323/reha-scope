'use client'

import { useAuthGuard } from '@/hooks/useAuthGuard'
import { useSession, MovementType } from '@/context/SessionContext'
import { useRouter } from 'next/navigation'

const MOVEMENTS: { type: MovementType; label: string; desc: string; icon: React.ReactNode }[] = [
  {
    type: 'standing',
    label: '立ち上がり',
    desc: '椅子座位から立位への動作を分析します',
    icon: (
      <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  },
  {
    type: 'walking',
    label: '歩行',
    desc: '歩行動作の関節角度・重心偏位を分析します',
    icon: (
      <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M13 5l7 7-7 7M5 5l7 7-7 7" />
      </svg>
    ),
  },
  {
    type: 'balance',
    label: 'バランス・静止立位',
    desc: '静止立位でのバランス能力・重心動揺を評価します',
    icon: (
      <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
      </svg>
    ),
  },
]

export default function HomePage() {
  useAuthGuard()
  const { setMovementType } = useSession()
  const router = useRouter()

  const handleSelect = (type: MovementType) => {
    setMovementType(type)
    router.push('/input')
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col">
      {/* Header */}
      <header className="bg-[#1e3a5f] text-white px-8 py-4 flex items-center justify-between shadow">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <span className="text-xl font-bold tracking-tight">RehaScope</span>
        </div>
        <span className="text-sm text-white/70 font-medium">Motion Analysis Tool</span>
      </header>

      {/* Main */}
      <main className="flex-1 flex flex-col items-center justify-center px-8 py-12">
        <div className="mb-10 text-center">
          <h2 className="text-2xl font-bold text-[#1e3a5f] mb-2">動作を選択してください</h2>
          <p className="text-gray-500 text-sm">分析したい動作の種類を選んでください</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl">
          {MOVEMENTS.map(m => (
            <button
              key={m.type}
              onClick={() => handleSelect(m.type)}
              className="bg-white rounded-2xl shadow-md p-8 flex flex-col items-center gap-4 hover:shadow-lg hover:border-2 hover:border-[#3b82f6] border-2 border-transparent transition-all duration-200 group cursor-pointer"
            >
              <div className="text-[#1e3a5f] group-hover:text-[#3b82f6] transition-colors">
                {m.icon}
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-[#1e3a5f] group-hover:text-[#3b82f6] transition-colors mb-1">
                  {m.label}
                </div>
                <div className="text-sm text-gray-500 leading-relaxed">{m.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </main>
    </div>
  )
}
