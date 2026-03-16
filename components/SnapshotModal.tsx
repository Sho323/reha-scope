'use client'

import { useState, useRef, useEffect } from 'react'
import type { FrameData } from '@/context/SessionContext'
import type { PoseLandmarks } from '@/lib/mediapipe'
import PoseOverlay from './PoseOverlay'
import AngleTable from './AngleTable'

interface SnapshotModalProps {
  beforeUrl: string
  afterUrl: string
  beforeData: FrameData[]
  afterData: FrameData[]
  beforeLandmarks: PoseLandmarks[]
  afterLandmarks: PoseLandmarks[]
  plane?: 'frontal' | 'sagittal'
  onClose: () => void
}

export default function SnapshotModal({
  beforeUrl,
  afterUrl,
  beforeData,
  afterData,
  beforeLandmarks,
  afterLandmarks,
  plane = 'sagittal',
  onClose,
}: SnapshotModalProps) {
  const [beforeFrame, setBeforeFrame] = useState(0)
  const [afterFrame, setAfterFrame] = useState(0)
  const beforeVideoRef = useRef<HTMLVideoElement>(null)
  const afterVideoRef = useRef<HTMLVideoElement>(null)
  const [videoDims, setVideoDims] = useState({ w: 320, h: 180 })
  const [videoNaturalDims, setVideoNaturalDims] = useState({ w: 0, h: 0 })

  useEffect(() => {
    const v = beforeVideoRef.current
    if (!v) return
    const measure = () => {
      // レイアウト確定後にコンテナサイズを取得
      requestAnimationFrame(() => {
        const rect = v.getBoundingClientRect()
        if (rect.width > 0) setVideoDims({ w: rect.width, h: rect.height })
      })
      // 動画の実ピクセルサイズ（レターボックス補正用）
      setVideoNaturalDims({ w: v.videoWidth, h: v.videoHeight })
    }
    v.addEventListener('loadedmetadata', measure)
    // すでにメタデータが読み込まれている場合
    if (v.readyState >= 1) measure()
    return () => v.removeEventListener('loadedmetadata', measure)
  }, [])

  const seekTo = (video: HTMLVideoElement | null, frame: number, fps = 15) => {
    if (!video) return
    video.currentTime = frame / fps
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-bold text-[#1e3a5f]">フレーム指定スナップショット</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Videos side by side */}
          <div className="grid grid-cols-2 gap-4">
            {/* Before */}
            <div>
              <div className="text-sm font-bold text-[#3b82f6] mb-2">Before（フレーム {beforeFrame}）</div>
              <div className="relative border-2 border-[#3b82f6] rounded-lg overflow-hidden aspect-video bg-black">
                <video
                  ref={beforeVideoRef}
                  src={beforeUrl}
                  className="w-full h-full object-contain"
                  data-testid="before-video"
                />
                <PoseOverlay
                  landmarks={beforeLandmarks[beforeFrame] ?? null}
                  width={videoDims.w}
                  height={videoDims.h}
                  videoNaturalWidth={videoNaturalDims.w}
                  videoNaturalHeight={videoNaturalDims.h}
                  plane={plane}
                />
              </div>
              <input
                type="range"
                min={0}
                max={Math.max(beforeData.length - 1, 0)}
                value={beforeFrame}
                onChange={e => {
                  const f = Number(e.target.value)
                  setBeforeFrame(f)
                  seekTo(beforeVideoRef.current, f)
                }}
                className="w-full mt-2 accent-[#3b82f6]"
              />
            </div>

            {/* After */}
            <div>
              <div className="text-sm font-bold text-[#f97316] mb-2">After（フレーム {afterFrame}）</div>
              <div className="relative border-2 border-[#f97316] rounded-lg overflow-hidden aspect-video bg-black">
                <video
                  ref={afterVideoRef}
                  src={afterUrl}
                  className="w-full h-full object-contain"
                  data-testid="after-video"
                />
                <PoseOverlay
                  landmarks={afterLandmarks[afterFrame] ?? null}
                  width={videoDims.w}
                  height={videoDims.h}
                  videoNaturalWidth={videoNaturalDims.w}
                  videoNaturalHeight={videoNaturalDims.h}
                  plane={plane}
                />
              </div>
              <input
                type="range"
                min={0}
                max={Math.max(afterData.length - 1, 0)}
                value={afterFrame}
                onChange={e => {
                  const f = Number(e.target.value)
                  setAfterFrame(f)
                  seekTo(afterVideoRef.current, f)
                }}
                className="w-full mt-2 accent-[#f97316]"
              />
            </div>
          </div>

          {/* Angle Table */}
          <div>
            <h3 className="text-sm font-bold text-gray-600 mb-3">関節角度比較</h3>
            <AngleTable
              before={beforeData[beforeFrame] ?? null}
              after={afterData[afterFrame] ?? null}
              plane={plane}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
