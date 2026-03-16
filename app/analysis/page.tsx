'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthGuard } from '@/hooks/useAuthGuard'
import { useSession, FrameData } from '@/context/SessionContext'
import { analyzeVideo } from '@/lib/mediapipe'
import { calculateAllAngles, calculateFrontalAngles, type Side } from '@/lib/angleCalc'
import { calculateCenterOfGravity } from '@/lib/gravityCalc'
import { detectValidity } from '@/lib/frameValidity'
import { generatePdf, generateFileName } from '@/lib/pdfExport'
import { generateCsv, downloadCsv } from '@/lib/csvExport'
import AngleGraph from '@/components/AngleGraph'
import GravityPlot from '@/components/GravityPlot'
import SnapshotModal from '@/components/SnapshotModal'
import PoseOverlay from '@/components/PoseOverlay'
import type { PoseLandmarks } from '@/lib/mediapipe'

const FPS = 15

type ActiveTab = 'frontal' | 'sagittal'
type AnalysisStatus = 'idle' | 'analyzing' | 'done' | 'error'

interface PlaneAnalysis {
  beforeData: FrameData[]
  afterData: FrameData[]
  beforeLandmarks: PoseLandmarks[]
  afterLandmarks: PoseLandmarks[]
  beforeValidity: boolean[]
  afterValidity: boolean[]
  plane: 'frontal' | 'sagittal'
}

const MOVEMENT_LABELS: Record<string, string> = {
  standing: '立ち上がり',
  walking: '歩行',
  balance: 'バランス・静止立位',
}

export default function AnalysisPage() {
  useAuthGuard()
  const { movementType, plane, videos } = useSession()
  const router = useRouter()

  const [activeTab, setActiveTab] = useState<ActiveTab>(plane === 'sagittal' ? 'sagittal' : 'frontal')
  const [status, setStatus] = useState<AnalysisStatus>('idle')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const [frontal, setFrontal] = useState<PlaneAnalysis | null>(null)
  const [sagittal, setSagittal] = useState<PlaneAnalysis | null>(null)
  const [showSnapshot, setShowSnapshot] = useState(false)
  const [showOverlay, setShowOverlay] = useState(false)
  const [sagittalSide, setSagittalSide] = useState<Side>('auto')
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [videoDims, setVideoDims] = useState({ w: 0, h: 0 })
  const [videoDuration, setVideoDuration] = useState(0)
  const [beforeNaturalDims, setBeforeNaturalDims] = useState({ w: 0, h: 0 })
  const [afterNaturalDims, setAfterNaturalDims] = useState({ w: 0, h: 0 })
  const beforeVideoRef = useRef<HTMLVideoElement>(null)
  const afterVideoRef = useRef<HTMLVideoElement>(null)
  const beforeContainerRef = useRef<HTMLDivElement>(null)
  const afterContainerRef = useRef<HTMLDivElement>(null)
  const analysisRef = useRef<HTMLDivElement>(null)

  const analyzePlane = async (
    beforeUrl: string,
    afterUrl: string | undefined,
    currentPlane: 'frontal' | 'sagittal'
  ): Promise<PlaneAnalysis> => {
    const toFrameData = (landmarks: PoseLandmarks, i: number): FrameData => {
      const angles = landmarks.length > 0
        ? currentPlane === 'frontal'
          ? calculateFrontalAngles(landmarks)
          : calculateAllAngles(landmarks)
        : { hip: 0, knee: 0, ankle: 0, trunk: 0 }
      const gravity = landmarks.length > 0 ? calculateCenterOfGravity(landmarks) : { x: 0.5, y: 0.5 }
      return { frame: i, ...angles, gravityX: gravity.x, gravityY: gravity.y }
    }

    // MediaPipe WASM は並列実行非対応のため直列で処理
    const bLandmarksRaw = await analyzeVideo(beforeUrl, p => setProgress(afterUrl ? Math.floor(p / 2) : p))
    const aLandmarksRaw = afterUrl
      ? await analyzeVideo(afterUrl, p => setProgress(50 + Math.floor(p / 2)))
      : []

    return {
      beforeData: bLandmarksRaw.map((lm, i) => toFrameData(lm, i)),
      afterData: aLandmarksRaw.map((lm, i) => toFrameData(lm, i)),
      beforeLandmarks: bLandmarksRaw as PoseLandmarks[],
      afterLandmarks: aLandmarksRaw as PoseLandmarks[],
      beforeValidity: detectValidity(bLandmarksRaw as PoseLandmarks[], currentPlane),
      afterValidity:  aLandmarksRaw.length > 0 ? detectValidity(aLandmarksRaw as PoseLandmarks[], currentPlane) : [],
      plane: currentPlane,
    }
  }

  // コンテナサイズを追跡（PoseOverlay の座標変換に必要）
  // status が 'done' になってからコンテナが DOM に現れるため、status を依存に含める
  useEffect(() => {
    const container = beforeContainerRef.current
    if (!container) return
    // 即時計測
    const measure = () => {
      const rect = container.getBoundingClientRect()
      if (rect.width > 0) setVideoDims({ w: rect.width, h: rect.height })
    }
    measure()
    const obs = new ResizeObserver(measure)
    obs.observe(container)
    return () => obs.disconnect()
  }, [status])

  useEffect(() => {
    if (!plane || !videos) return

    const run = async () => {
      setStatus('analyzing')
      setProgress(0)
      try {
        if ((plane === 'frontal' || plane === 'both') && videos.frontalBefore) {
          const result = await analyzePlane(videos.frontalBefore, videos.frontalAfter, 'frontal')
          setFrontal(result)
        }
        if ((plane === 'sagittal' || plane === 'both') && videos.sagittalBefore) {
          const result = await analyzePlane(videos.sagittalBefore, videos.sagittalAfter, 'sagittal')
          setSagittal(result)
        }
        setStatus('done')
        setProgress(100)
      } catch (e) {
        console.error(e)
        setError('分析中にエラーが発生しました')
        setStatus('error')
      }
    }

    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 側の選択に応じて矢状面データを再計算（ランドマークは保持済みなので高速）
  // 'auto' の場合はフレームごとに visibility を比較して動的に側を選択する
  const effectiveSagittal = useMemo(() => {
    if (!sagittal) return null
    const recompute = (lm: PoseLandmarks, i: number) => {
      const angles = lm.length > 0
        ? calculateAllAngles(lm, sagittalSide)
        : { hip: 0, knee: 0, ankle: 0, trunk: 0 }
      const gravity = lm.length > 0 ? calculateCenterOfGravity(lm) : { x: 0.5, y: 0.5 }
      return { frame: i, ...angles, gravityX: gravity.x, gravityY: gravity.y }
    }
    return {
      ...sagittal,
      beforeData: sagittal.beforeLandmarks.map(recompute),
      afterData:  sagittal.afterLandmarks.map(recompute),
    }
  }, [sagittal, sagittalSide])

  const currentPlaneData = activeTab === 'frontal' ? frontal : effectiveSagittal
  const currentBeforeUrl = activeTab === 'frontal' ? videos.frontalBefore : videos.sagittalBefore
  const currentAfterUrl  = activeTab === 'frontal' ? videos.frontalAfter  : videos.sagittalAfter

  const handlePlayPause = () => {
    if (!beforeVideoRef.current) return
    if (playing) {
      beforeVideoRef.current.pause()
      afterVideoRef.current?.pause()
    } else {
      beforeVideoRef.current.play()
      afterVideoRef.current?.play()
    }
    setPlaying(!playing)
  }

  const handleReset = () => {
    if (beforeVideoRef.current) beforeVideoRef.current.currentTime = 0
    if (afterVideoRef.current) afterVideoRef.current.currentTime = 0
    beforeVideoRef.current?.pause()
    afterVideoRef.current?.pause()
    setPlaying(false)
    setCurrentTime(0)
  }

  /** グラフクリック → 動画を指定時刻にシーク */
  const handleSeek = (time: number) => {
    if (beforeVideoRef.current) beforeVideoRef.current.currentTime = time
    if (afterVideoRef.current)  afterVideoRef.current.currentTime  = time
    beforeVideoRef.current?.pause()
    afterVideoRef.current?.pause()
    setPlaying(false)
    setCurrentTime(time)
  }

  const handleFullscreen = (ref: React.RefObject<HTMLDivElement | null>) => {
    const el = ref.current
    if (!el) return
    if (!document.fullscreenElement) {
      el.requestFullscreen()
    } else {
      document.exitFullscreen()
    }
  }

  const handleExportPdf = async () => {
    if (!currentPlaneData) return
    const fileName = generateFileName({
      date: new Date(),
      movementType: movementType ?? 'unknown',
      plane: activeTab,
      extension: 'pdf',
    })
    await generatePdf({
      beforeData:   currentPlaneData.beforeData,
      afterData:    currentPlaneData.afterData,
      plane:        activeTab,
      movementType: movementType ?? 'unknown',
      fileName,
    })
  }

  const handleExportCsv = () => {
    if (!currentPlaneData) return
    const csv = generateCsv({ before: currentPlaneData.beforeData, after: currentPlaneData.afterData })
    const fileName = generateFileName({
      date: new Date(),
      movementType: movementType ?? 'unknown',
      plane: activeTab,
      extension: 'csv',
    })
    downloadCsv(fileName, csv)
  }

  if (status === 'analyzing') {
    return (
      <div className="min-h-screen bg-[#f5f7fa] flex flex-col items-center justify-center gap-6">
        <div className="w-12 h-12 bg-[#1e3a5f] rounded-full flex items-center justify-center mb-2">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <div className="text-[#1e3a5f] text-xl font-bold">動画を分析中...</div>
        <div className="w-72 bg-gray-200 rounded-full h-2">
          <div
            className="bg-[#1e3a5f] h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="text-gray-400 text-sm">{progress}%</div>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-[#f5f7fa] flex flex-col items-center justify-center gap-4">
        <div className="text-[#ef4444] text-lg font-bold">{error}</div>
        <button onClick={() => router.push('/input')} className="bg-[#1e3a5f] text-white px-6 py-3 rounded-xl">
          動画を選び直す
        </button>
      </div>
    )
  }

  const TAB_LABELS: Record<ActiveTab, string> = {
    frontal:  '前額面（正面）',
    sagittal: '矢状面（側面）',
  }

  return (
    <div className="min-h-screen bg-[#f5f7fa] flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-0 flex items-center justify-between">
        {/* Logo + back */}
        <button
          onClick={() => router.push('/input')}
          className="flex items-center gap-2.5 py-4"
        >
          <div className="w-8 h-8 bg-[#1e3a5f] rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <span className="font-bold text-[#1e3a5f]">RehaScope</span>
        </button>

        {/* Tabs (always visible; single plane shows one tab) */}
        <div className="flex items-end h-full">
          {(plane === 'both' ? (['frontal', 'sagittal'] as ActiveTab[]) : ([activeTab] as ActiveTab[])).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              role="tab"
              className={`px-5 py-4 text-sm font-semibold border-b-2 transition ${
                activeTab === tab
                  ? 'border-[#3b82f6] text-[#3b82f6]'
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              {TAB_LABELS[tab]}
            </button>
          ))}
        </div>

        {/* Export buttons */}
        <div className="flex gap-2 py-4">
          <button
            onClick={handleExportPdf}
            className="flex items-center gap-1.5 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            PDF出力
          </button>
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            CSV出力
          </button>
        </div>
      </header>

      <div id="analysis-content" ref={analysisRef} className="flex-1 p-4 space-y-4" data-testid="analysis-view">
        {/* Videos */}
        {currentBeforeUrl && (() => {
          const rawFrame = Math.round(currentTime * FPS)
          const beforeFrame = Math.min(rawFrame, (currentPlaneData?.beforeLandmarks.length ?? 1) - 1)
          const afterFrame  = Math.min(rawFrame, (currentPlaneData?.afterLandmarks.length  ?? 1) - 1)
          return (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
              <div className={`grid ${currentAfterUrl ? 'grid-cols-2' : 'grid-cols-1 max-w-xl mx-auto'} gap-4 mb-3`}>
                {/* Before */}
                <div>
                  <div
                    ref={beforeContainerRef}
                    className="relative border-2 border-[#3b82f6] rounded-xl overflow-hidden aspect-video bg-black group"
                  >
                    <div className="absolute top-2 left-2 z-10 bg-[#3b82f6] text-white text-xs font-bold px-2.5 py-1 rounded-md">BEFORE</div>
                    <video
                      ref={beforeVideoRef}
                      src={currentBeforeUrl}
                      className="w-full h-full object-contain"
                      data-testid="before-video"
                      onEnded={() => setPlaying(false)}
                      onTimeUpdate={() => setCurrentTime(beforeVideoRef.current?.currentTime ?? 0)}
                      onLoadedMetadata={() => {
                        const v = beforeVideoRef.current
                        if (v) {
                          setBeforeNaturalDims({ w: v.videoWidth, h: v.videoHeight })
                          setVideoDuration(v.duration)
                        }
                      }}
                    />
                    {showOverlay && currentPlaneData && (
                      <PoseOverlay
                        landmarks={currentPlaneData.beforeLandmarks[beforeFrame] ?? null}
                        width={videoDims.w || beforeContainerRef.current?.getBoundingClientRect().width || 0}
                        height={videoDims.h || beforeContainerRef.current?.getBoundingClientRect().height || 0}
                        videoNaturalWidth={beforeNaturalDims.w}
                        videoNaturalHeight={beforeNaturalDims.h}
                        plane={currentPlaneData.plane}
                      />
                    )}
                    <button
                      onClick={() => handleFullscreen(beforeContainerRef)}
                      className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-black/75 text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                      title="全画面表示"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* After */}
                {currentAfterUrl && (
                  <div>
                    <div
                      ref={afterContainerRef}
                      className="relative border-2 border-[#f97316] rounded-xl overflow-hidden aspect-video bg-black group"
                    >
                      <div className="absolute top-2 left-2 z-10 bg-[#f97316] text-white text-xs font-bold px-2.5 py-1 rounded-md">AFTER</div>
                      <video
                        ref={afterVideoRef}
                        src={currentAfterUrl}
                        className="w-full h-full object-contain"
                        data-testid="after-video"
                        onEnded={() => setPlaying(false)}
                        onLoadedMetadata={() => {
                          const v = afterVideoRef.current
                          if (v) setAfterNaturalDims({ w: v.videoWidth, h: v.videoHeight })
                        }}
                      />
                      {showOverlay && currentPlaneData && (
                        <PoseOverlay
                          landmarks={currentPlaneData.afterLandmarks[afterFrame] ?? null}
                          width={videoDims.w || afterContainerRef.current?.getBoundingClientRect().width || 0}
                          height={videoDims.h || afterContainerRef.current?.getBoundingClientRect().height || 0}
                          videoNaturalWidth={afterNaturalDims.w}
                          videoNaturalHeight={afterNaturalDims.h}
                          plane={currentPlaneData.plane}
                        />
                      )}
                      <button
                        onClick={() => handleFullscreen(afterContainerRef)}
                        className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-black/75 text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                        title="全画面表示"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Controls: scrubber row */}
              <div className="flex items-center gap-3 mt-3">
                {/* Play/Pause */}
                <button
                  onClick={handlePlayPause}
                  className="w-10 h-10 flex-shrink-0 flex items-center justify-center bg-[#1e3a5f] text-white rounded-full hover:bg-[#162d4a] transition"
                >
                  {playing ? (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>

                {/* Scrubber */}
                <input
                  type="range"
                  min={0}
                  max={videoDuration || 1}
                  step={0.01}
                  value={currentTime}
                  onChange={e => handleSeek(Number(e.target.value))}
                  className="flex-1 h-1.5 accent-[#1e3a5f] cursor-pointer"
                />

                {/* Time */}
                <span className="text-xs text-gray-500 font-mono flex-shrink-0 w-28 text-right">
                  {currentTime.toFixed(1)} / {videoDuration.toFixed(1)}秒
                </span>
              </div>

              {/* Sub-controls row */}
              <div className="flex items-center justify-end gap-2 mt-2">
                {/* フレーム表示トグル */}
                {status === 'done' && currentPlaneData && (
                  <button
                    onClick={() => setShowOverlay(v => !v)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                      showOverlay
                        ? 'bg-[#1e3a5f] text-white border-[#1e3a5f]'
                        : 'border-gray-300 text-gray-500 hover:border-[#1e3a5f] hover:text-[#1e3a5f]'
                    }`}
                  >
                    フレーム{showOverlay ? ' ON' : ' OFF'}
                  </button>
                )}
                {currentAfterUrl && (
                  <button
                    onClick={() => setShowSnapshot(true)}
                    className="flex items-center gap-1.5 border border-gray-300 text-gray-500 px-3 py-1.5 rounded-lg text-xs font-medium hover:border-[#1e3a5f] hover:text-[#1e3a5f] transition"
                  >
                    フレーム指定
                  </button>
                )}
              </div>
            </div>
          )
        })()}

        {/* Graph + Gravity */}
        {currentPlaneData && status === 'done' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4">

            {/* 矢状面：撮影側セレクター */}
            {activeTab === 'sagittal' && (
              <div className="flex items-center gap-3 mb-4 pb-3 border-b">
                <span className="text-xs text-gray-500 font-medium">撮影側：</span>
                <div className="flex gap-1.5">
                  {([
                    { value: 'auto',  label: '自動（フレームごと）' },
                    { value: 'left',  label: '左側固定' },
                    { value: 'right', label: '右側固定' },
                    { value: 'both',  label: '両側平均' },
                  ] as const).map(({ value, label }) => (
                    <button
                      key={value}
                      onClick={() => setSagittalSide(value)}
                      className={`px-3 py-1 rounded-full text-xs font-semibold border transition ${
                        sagittalSide === value
                          ? 'bg-[#1e3a5f] text-white border-[#1e3a5f]'
                          : 'bg-white text-gray-500 border-gray-300 hover:border-[#1e3a5f] hover:text-[#1e3a5f]'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-6 items-start">
              <div className="flex-1">
                <AngleGraph
                  beforeData={currentPlaneData.beforeData}
                  afterData={currentPlaneData.afterData}
                  beforeValidity={currentPlaneData.beforeValidity}
                  afterValidity={currentPlaneData.afterValidity}
                  plane={currentPlaneData.plane}
                  currentTime={currentTime}
                  onSeek={handleSeek}
                />
              </div>
              <div className="w-72 flex-shrink-0">
                <GravityPlot
                  beforeData={currentPlaneData.beforeData}
                  afterData={currentPlaneData.afterData}
                  plane={currentPlaneData.plane}
                  currentTime={currentTime}
                  onSeek={handleSeek}
                />
              </div>
            </div>
          </div>
        )}

        {status === 'idle' && (
          <div className="text-center text-gray-400 py-12">分析結果を待っています...</div>
        )}
      </div>

      {/* Snapshot Modal */}
      {showSnapshot && currentPlaneData && currentBeforeUrl && currentAfterUrl && currentPlaneData.afterData.length > 0 && (
        <SnapshotModal
          beforeUrl={currentBeforeUrl}
          afterUrl={currentAfterUrl}
          beforeData={currentPlaneData.beforeData}
          afterData={currentPlaneData.afterData}
          beforeLandmarks={currentPlaneData.beforeLandmarks}
          afterLandmarks={currentPlaneData.afterLandmarks}
          plane={currentPlaneData.plane}
          onClose={() => setShowSnapshot(false)}
        />
      )}
    </div>
  )
}
