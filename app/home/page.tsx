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
      <svg className="w-8 h-8 text-[#1e3a5f]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
      </svg>
    ),
  },
  {
    type: 'walking',
    label: '歩行',
    desc: '歩行動作の関節角度・重心偏位を分析します',
    icon: (
      <svg className="w-8 h-8 text-[#1e3a5f]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
      </svg>
    ),
  },
  {
    type: 'balance',
    label: 'バランス・静止立位',
    desc: '静止立位でのバランス能力・重心動揺を評価します',
    icon: (
      <svg className="w-8 h-8 text-[#1e3a5f]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
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
    <div className="min-h-screen bg-[#f5f7fa] flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-[#1e3a5f] rounded-full flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <span className="text-xl font-bold text-[#1e3a5f] tracking-tight">RehaScope</span>
        </div>
        <span className="text-xs font-semibold text-gray-400 tracking-widest uppercase">動作解析ツール</span>
      </header>

      {/* Main */}
      <main className="flex-1 flex flex-col items-center justify-center px-8 py-16">
        <div className="mb-12 text-center">
          <h1 className="text-3xl font-bold text-[#1e3a5f] mb-3">動作を選択してください</h1>
          <p className="text-gray-500 text-sm">分析したい動作の種類を選んでください</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 w-full max-w-4xl">
          {MOVEMENTS.map(m => (
            <button
              key={m.type}
              onClick={() => handleSelect(m.type)}
              className="bg-white rounded-2xl border border-gray-200 p-8 flex flex-col items-center gap-5 hover:shadow-lg hover:border-gray-300 transition-all duration-200 cursor-pointer"
            >
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                {m.icon}
              </div>
              <div className="text-center">
                <div className="text-base font-bold text-[#1e3a5f] mb-2">{m.label}</div>
                <div className="text-sm text-gray-500 leading-relaxed">{m.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="py-5 text-center">
        <span className="text-xs text-gray-400">© 2026 RehaScope • v1.0.0</span>
      </footer>
    </div>
  )
}
