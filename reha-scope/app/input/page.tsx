'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthGuard } from '@/hooks/useAuthGuard'
import { useSession, PlaneType, VideoSet } from '@/context/SessionContext'
import VideoInputArea from '@/components/VideoInputArea'

const MOVEMENT_LABELS: Record<string, string> = {
  standing: '立ち上がり',
  walking: '歩行',
  balance: 'バランス・静止立位',
}

const PLANES: { value: PlaneType; label: string }[] = [
  { value: 'frontal', label: '前額面（正面）' },
  { value: 'sagittal', label: '矢状面（側面）' },
  { value: 'both', label: '両方' },
]

export default function InputPage() {
  useAuthGuard()
  const { movementType, plane, setPlane, setVideos, videos } = useSession()
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
    if (plane === 'frontal') return !!videos.frontalBefore && !!videos.frontalAfter
    if (plane === 'sagittal') return !!videos.sagittalBefore && !!videos.sagittalAfter
    return !!videos.frontalBefore && !!videos.frontalAfter && !!videos.sagittalBefore && !!videos.sagittalAfter
  }

  const handleStart = () => {
    if (!isReady()) {
      setError('Before・Afterの動画を選択してください')
      return
    }
    router.push('/analysis')
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col">
      {/* Header */}
      <header className="bg-[#1e3a5f] text-white px-8 py-4 flex items-center justify-between shadow">
        <button
          onClick={() => router.push('/home')}
          className="flex items-center gap-2 text-white/80 hover:text-white transition"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          戻る
        </button>
        <div className="text-center">
          <div className="text-xs text-white/60">動作種類</div>
          <div className="font-bold">{MOVEMENT_LABELS[movementType ?? ''] ?? '—'}</div>
        </div>
        <div className="w-16" />
      </header>

      <main className="flex-1 p-6 max-w-5xl mx-auto w-full">
        {/* Plane Selection */}
        <div className="bg-white rounded-2xl shadow-md p-6 mb-6">
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">
            STEP 1：撮影面を選択
          </h2>
          <div className="flex gap-3 flex-wrap">
            {PLANES.map(p => (
              <button
                key={p.value}
                onClick={() => handlePlaneSelect(p.value)}
                className={`px-5 py-2.5 rounded-lg font-medium text-sm transition border-2 ${
                  plane === p.value
                    ? 'bg-[#1e3a5f] text-white border-[#1e3a5f]'
                    : 'border-gray-300 text-gray-600 hover:border-[#3b82f6] hover:text-[#3b82f6]'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Video Input */}
        {plane && (
          <div className="bg-white rounded-2xl shadow-md p-6 mb-6">
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">
              STEP 2：動画を選択
            </h2>

            {(plane === 'frontal' || plane === 'both') && (
              <div className="mb-6">
                {plane === 'both' && (
                  <div className="text-sm font-semibold text-gray-700 mb-3 pb-2 border-b">
                    前額面（正面）
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <VideoInputArea
                    label="Before"
                    borderColor="blue"
                    videoUrl={videos.frontalBefore}
                    onVideoReady={url => updateVideo('frontalBefore', url)}
                  />
                  <VideoInputArea
                    label="After"
                    borderColor="orange"
                    videoUrl={videos.frontalAfter}
                    onVideoReady={url => updateVideo('frontalAfter', url)}
                  />
                </div>
              </div>
            )}

            {(plane === 'sagittal' || plane === 'both') && (
              <div>
                {plane === 'both' && (
                  <div className="text-sm font-semibold text-gray-700 mb-3 pb-2 border-b">
                    矢状面（側面）
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <VideoInputArea
                    label="Before"
                    borderColor="blue"
                    videoUrl={videos.sagittalBefore}
                    onVideoReady={url => updateVideo('sagittalBefore', url)}
                  />
                  <VideoInputArea
                    label="After"
                    borderColor="orange"
                    videoUrl={videos.sagittalAfter}
                    onVideoReady={url => updateVideo('sagittalAfter', url)}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {error && (
          <p className="text-[#ef4444] text-sm text-center mb-4 flex items-center justify-center gap-1.5">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            {error}
          </p>
        )}

        <button
          onClick={handleStart}
          disabled={!isReady()}
          className="w-full bg-[#1e3a5f] text-white py-4 rounded-xl font-bold text-lg hover:bg-[#162d4a] transition disabled:opacity-40 disabled:cursor-not-allowed shadow"
        >
          分析開始 →
        </button>
      </main>
    </div>
  )
}
