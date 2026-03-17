'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthGuard } from '@/hooks/useAuthGuard'
import { useSession, PlaneType, VideoSet } from '@/context/SessionContext'
import VideoInputArea from '@/components/VideoInputArea'

const PLANES: { value: PlaneType; label: string }[] = [
  { value: 'frontal',  label: '前額面（正面）' },
  { value: 'sagittal', label: '矢状面（側面）' },
  { value: 'both',     label: '両方' },
]

export default function InputPage() {
  useAuthGuard()
  const { plane, setPlane, setVideos, videos } = useSession()
  const router = useRouter()
  const [error, setError] = useState('')

  const handlePlaneSelect = (p: PlaneType) => {
    setPlane(p)
    setVideos({})
    setError('')
  }

  const updateVideo = (key: keyof VideoSet, url: string) => {
    setVideos({ ...videos, [key]: url })
    setError('')
  }

  const isReady = () => {
    if (!plane) return false
    if (plane === 'frontal')  return !!videos.frontalBefore
    if (plane === 'sagittal') return !!videos.sagittalBefore
    return !!videos.frontalBefore && !!videos.sagittalBefore
  }

  const handleStart = () => {
    if (!isReady()) { setError('Before の動画を選択してください'); return }
    router.push('/analysis')
  }

  return (
    <div className="min-h-screen bg-[#f5f7fa] flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between">
        {/* Logo */}
        <button onClick={() => router.push('/home')} className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-[#1e3a5f] rounded-full flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <span className="text-xl font-bold text-[#1e3a5f] tracking-tight">RehaScope</span>
        </button>

        {/* Progress steps */}
        <div className="flex flex-col items-center gap-1">
          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">進行状況</span>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-6 rounded-full bg-[#1e3a5f] text-white text-xs font-bold flex items-center justify-center">1</div>
              <span className="text-sm font-semibold text-[#1e3a5f]">動画入力</span>
            </div>
            <div className="w-10 h-px bg-gray-300" />
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-6 rounded-full bg-gray-200 text-gray-400 text-xs font-bold flex items-center justify-center">2</div>
              <span className="text-sm font-semibold text-gray-400">分析</span>
            </div>
          </div>
          <span className="text-[10px] text-gray-400">ステップ 1 / 2</span>
        </div>

        <div className="w-36" />
      </header>

      <main className="flex-1 flex flex-col max-w-5xl mx-auto w-full px-8 py-10">
        {/* Plane toggle */}
        <div className="flex justify-center mb-8">
          <div className="bg-gray-200 rounded-xl p-1 flex gap-1">
            {PLANES.map(p => (
              <button
                key={p.value}
                onClick={() => handlePlaneSelect(p.value)}
                className={`px-6 py-2 rounded-lg text-sm font-semibold transition ${
                  plane === p.value
                    ? 'bg-white text-[#1e3a5f] shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* 撮影ガイド */}
        {plane && (
          <details className="mb-6 bg-blue-50 border border-blue-200 rounded-2xl overflow-hidden">
            <summary className="flex items-center gap-2 px-5 py-3.5 cursor-pointer text-sm font-semibold text-[#1e3a5f] select-none">
              <svg className="w-4 h-4 text-[#3b82f6] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              撮影ガイド（タップで展開）
            </summary>
            <div className="px-5 pb-4 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs text-gray-600">
              {[
                { icon: '📏', title: '撮影距離', desc: '全身が映る距離\n（目安 2〜3 m）' },
                { icon: '📐', title: 'カメラ高さ', desc: '腰の高さ付近\n（床から約 1 m）' },
                { icon: plane === 'sagittal' ? '↔️' : '⬆️', title: '撮影方向', desc: plane === 'sagittal' ? '側面 90° から\n真横に' : '正面から\nまっすぐ' },
                { icon: '💡', title: '明るさ', desc: '逆光を避け\n均一な明るさ' },
                { icon: '🧍', title: '被写体', desc: '関節が見える\n服装が望ましい' },
                { icon: '🎯', title: '画角', desc: '頭〜足先まで\nフレームに収める' },
              ].map(g => (
                <div key={g.title} className="bg-white rounded-xl p-3 border border-blue-100">
                  <div className="text-lg mb-1">{g.icon}</div>
                  <div className="font-semibold text-[#1e3a5f] mb-0.5">{g.title}</div>
                  <div className="whitespace-pre-line leading-relaxed">{g.desc}</div>
                </div>
              ))}
            </div>
          </details>
        )}

        {/* Video cards */}
        {plane && (
          <>
            {(plane === 'frontal' || plane === 'both') && (
              <div className="mb-6">
                {plane === 'both' && (
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">前額面（正面）</p>
                )}
                <div className="grid grid-cols-2 gap-5">
                  <VideoCard
                    title="Before"
                    desc="基準となる動作を録画するか、既存の動画ファイルをアップロードしてください。"
                    videoUrl={videos.frontalBefore}
                    onVideoReady={url => updateVideo('frontalBefore', url)}
                  />
                  <VideoCard
                    title="After"
                    desc="治療・介入後の動作を録画して比較分析に使用します。"
                    videoUrl={videos.frontalAfter}
                    onVideoReady={url => updateVideo('frontalAfter', url)}
                  />
                </div>
              </div>
            )}
            {(plane === 'sagittal' || plane === 'both') && (
              <div className="mb-6">
                {plane === 'both' && (
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">矢状面（側面）</p>
                )}
                <div className="grid grid-cols-2 gap-5">
                  <VideoCard
                    title="Before"
                    desc="基準となる動作を録画するか、既存の動画ファイルをアップロードしてください。"
                    videoUrl={videos.sagittalBefore}
                    onVideoReady={url => updateVideo('sagittalBefore', url)}
                  />
                  <VideoCard
                    title="After"
                    desc="治療・介入後の動作を録画して比較分析に使用します。"
                    videoUrl={videos.sagittalAfter}
                    onVideoReady={url => updateVideo('sagittalAfter', url)}
                  />
                </div>
              </div>
            )}
          </>
        )}

        {error && (
          <p className="text-red-500 text-sm text-center mb-4">{error}</p>
        )}

        {/* Next button */}
        <div className="flex justify-end mt-auto pt-4">
          <button
            onClick={handleStart}
            disabled={!isReady()}
            className="flex items-center gap-2 bg-[#1e3a5f] text-white px-8 py-3.5 rounded-xl font-bold text-sm hover:bg-[#162d4a] transition disabled:opacity-40 disabled:cursor-not-allowed shadow"
          >
            次へ
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </button>
        </div>
      </main>
    </div>
  )
}

function VideoCard({
  title,
  desc,
  videoUrl,
  onVideoReady,
}: {
  title: string
  desc: string
  videoUrl?: string
  onVideoReady: (url: string) => void
}) {
  return (
    <div className="bg-white border-2 border-dashed border-gray-300 rounded-2xl p-8 flex flex-col items-center text-center gap-4">
      {videoUrl ? (
        <video src={videoUrl} className="w-full rounded-lg aspect-video object-contain bg-black" controls />
      ) : (
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </div>
      )}
      <div>
        <div className="text-base font-bold text-[#1e3a5f] mb-1">{title}</div>
        <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
      </div>
      <div className="flex flex-col gap-2 w-full">
        <VideoInputArea
          label={title}
          borderColor={title === 'Before' ? 'blue' : 'orange'}
          videoUrl={videoUrl}
          onVideoReady={onVideoReady}
          compact
        />
      </div>
    </div>
  )
}
