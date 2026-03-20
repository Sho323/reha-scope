'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthGuard } from '@/hooks/useAuthGuard'
import { useSession, FrameData } from '@/context/SessionContext'
import { analyzeVideo } from '@/lib/mediapipe'
import { calculateAllAngles, calculateFrontalAngles, type Side } from '@/lib/angleCalc'
import { calculateCenterOfGravity, calculateCogStability } from '@/lib/gravityCalc'
import { detectValidity } from '@/lib/frameValidity'
import { calcStandingMetrics, calcWalkingMetrics } from '@/lib/temporalMetrics'
import type { StandingMetrics, WalkingMetrics } from '@/lib/temporalMetrics'
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
  const { movementType, plane, balanceType, walkingDistance, videos, clinicalNote, setClinicalNote } = useSession()
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
  // 片脚立位の支持脚（分析後も変更可能）
  const [frontalSupportSide, setFrontalSupportSide] = useState<'left' | 'right' | undefined>(
    balanceType === 'single_left' ? 'left' : balanceType === 'single_right' ? 'right' : undefined
  )
  const [fullscreenVideo, setFullscreenVideo] = useState<'before' | 'after' | null>(null)
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

  // 支持脚変更時に前額面データを再計算（ランドマークを保持しているため高速）
  const effectiveFrontal = useMemo(() => {
    if (!frontal) return null
    const recompute = (lm: PoseLandmarks, i: number) => {
      const angles = lm.length > 0
        ? calculateFrontalAngles(lm, frontalSupportSide)
        : { hip: 0, knee: 0, ankle: 0, trunk: 0 }
      const gravity = lm.length > 0 ? calculateCenterOfGravity(lm) : { x: 0.5, y: 0.5 }
      return { frame: i, ...angles, gravityX: gravity.x, gravityY: gravity.y }
    }
    return {
      ...frontal,
      beforeData: frontal.beforeLandmarks.map(recompute),
      afterData:  frontal.afterLandmarks.map(recompute),
    }
  }, [frontal, frontalSupportSide])

  const currentPlaneData = activeTab === 'frontal' ? effectiveFrontal : effectiveSagittal

  // 時間・効率指標（立ち上がり / 歩行のみ）
  const temporalMetrics = useMemo(() => {
    if (!currentPlaneData || status !== 'done') return null
    const p = currentPlaneData.plane
    const hasAfter = currentPlaneData.afterData.length > 0

    if (movementType === 'standing') {
      return {
        type: 'standing' as const,
        before: calcStandingMetrics(currentPlaneData.beforeData, currentPlaneData.beforeValidity, p),
        after:  hasAfter ? calcStandingMetrics(currentPlaneData.afterData, currentPlaneData.afterValidity, p) : null,
      }
    }
    if (movementType === 'walking') {
      const dist = walkingDistance ?? undefined
      return {
        type: 'walking' as const,
        before: calcWalkingMetrics(currentPlaneData.beforeData, currentPlaneData.beforeValidity, p, dist),
        after:  hasAfter ? calcWalkingMetrics(currentPlaneData.afterData, currentPlaneData.afterValidity, p, dist) : null,
      }
    }
    return null
  }, [currentPlaneData, status, movementType, walkingDistance])
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

  // Escape キーで全画面を閉じる
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setFullscreenVideo(null) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const handleExportPdf = async () => {
    if (!currentPlaneData) return
    const fileName = generateFileName({
      date: new Date(),
      movementType: movementType ?? 'unknown',
      plane: activeTab,
      extension: 'pdf',
    })
    await generatePdf({
      beforeData:      currentPlaneData.beforeData,
      afterData:       currentPlaneData.afterData,
      beforeValidity:  currentPlaneData.beforeValidity,
      afterValidity:   currentPlaneData.afterValidity,
      plane:           activeTab,
      movementType:    movementType ?? 'unknown',
      fileName,
      clinicalNote,
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
      <header className="bg-white border-b border-gray-200 px-3 py-0 flex items-center justify-between gap-2">
        {/* Logo + back */}
        <button
          onClick={() => router.push('/input')}
          className="flex items-center gap-2 py-3 flex-shrink-0"
        >
          <div className="w-7 h-7 bg-[#1e3a5f] rounded-full flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <span className="font-bold text-[#1e3a5f] text-sm hidden sm:block">RehaScope</span>
        </button>

        {/* Tabs (always visible; single plane shows one tab) */}
        <div className="flex items-end h-full flex-1 justify-center">
          {(plane === 'both' ? (['frontal', 'sagittal'] as ActiveTab[]) : ([activeTab] as ActiveTab[])).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              role="tab"
              className={`px-3 sm:px-5 py-3 text-xs sm:text-sm font-semibold border-b-2 transition ${
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
        <div className="flex gap-1.5 py-3 flex-shrink-0">
          <button
            onClick={handleExportPdf}
            className="flex items-center gap-1 border border-gray-300 text-gray-700 px-2 sm:px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-gray-50 transition"
          >
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="hidden sm:inline">PDF出力</span>
            <span className="sm:hidden">PDF</span>
          </button>
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1 border border-gray-300 text-gray-700 px-2 sm:px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-gray-50 transition"
          >
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="hidden sm:inline">CSV出力</span>
            <span className="sm:hidden">CSV</span>
          </button>
        </div>
      </header>

      <div id="analysis-content" ref={analysisRef} className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0" data-testid="analysis-view">

        {/* ── 左パネル: 動画 ── */}
        <div className="flex-shrink-0 md:w-[45%] overflow-y-auto p-3 flex flex-col gap-3">
        {/* Videos */}
        {currentBeforeUrl && (() => {
          const rawFrame = Math.round(currentTime * FPS)
          const beforeFrame = Math.min(rawFrame, (currentPlaneData?.beforeLandmarks.length ?? 1) - 1)
          const afterFrame  = Math.min(rawFrame, (currentPlaneData?.afterLandmarks.length  ?? 1) - 1)
          return (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
              <div className={`grid ${currentAfterUrl ? 'grid-cols-2 md:grid-cols-1' : 'grid-cols-1'} gap-3 mb-3`}>
                {/* Before */}
                <div>
                  <div
                    ref={beforeContainerRef}
                    className={`relative border-2 overflow-hidden bg-black group ${
                      fullscreenVideo === 'before'
                        ? 'fixed inset-0 z-50 border-0 rounded-none'
                        : 'border-[#3b82f6] rounded-xl aspect-video'
                    }`}
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
                        width={fullscreenVideo === 'before' ? window.innerWidth : (videoDims.w || beforeContainerRef.current?.getBoundingClientRect().width || 0)}
                        height={fullscreenVideo === 'before' ? window.innerHeight : (videoDims.h || beforeContainerRef.current?.getBoundingClientRect().height || 0)}
                        videoNaturalWidth={beforeNaturalDims.w}
                        videoNaturalHeight={beforeNaturalDims.h}
                        plane={currentPlaneData.plane}
                      />
                    )}
                    {/* フレーム表示トグル（全画面中もコンテナ内から操作可能） */}
                    {status === 'done' && currentPlaneData && (
                      <button
                        onClick={() => setShowOverlay(v => !v)}
                        className={`absolute bottom-2 left-2 z-10 px-2.5 py-1 rounded-lg text-xs font-medium transition-opacity ${
                          showOverlay ? 'bg-[#1e3a5f] text-white' : 'bg-black/60 text-white'
                        } ${fullscreenVideo === 'before' ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                      >
                        フレーム {showOverlay ? 'ON' : 'OFF'}
                      </button>
                    )}
                    <button
                      onClick={() => setFullscreenVideo(v => v === 'before' ? null : 'before')}
                      className="absolute top-2 right-2 z-10 p-1.5 bg-black/50 hover:bg-black/75 text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                      title={fullscreenVideo === 'before' ? '全画面を終了' : '全画面表示'}
                    >
                      {fullscreenVideo === 'before' ? (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M9 9L4 4m0 0v4m0-4h4M15 9l5-5m0 0v4m0-4h-4M9 15l-5 5m0 0v-4m0 4h4M15 15l5 5m0 0v-4m0 4h-4" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                {/* After */}
                {currentAfterUrl && (
                  <div>
                    <div
                      ref={afterContainerRef}
                      className={`relative border-2 overflow-hidden bg-black group ${
                        fullscreenVideo === 'after'
                          ? 'fixed inset-0 z-50 border-0 rounded-none'
                          : 'border-[#f97316] rounded-xl aspect-video'
                      }`}
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
                          width={fullscreenVideo === 'after' ? window.innerWidth : (videoDims.w || afterContainerRef.current?.getBoundingClientRect().width || 0)}
                          height={fullscreenVideo === 'after' ? window.innerHeight : (videoDims.h || afterContainerRef.current?.getBoundingClientRect().height || 0)}
                          videoNaturalWidth={afterNaturalDims.w}
                          videoNaturalHeight={afterNaturalDims.h}
                          plane={currentPlaneData.plane}
                        />
                      )}
                      {status === 'done' && currentPlaneData && (
                        <button
                          onClick={() => setShowOverlay(v => !v)}
                          className={`absolute bottom-2 left-2 z-10 px-2.5 py-1 rounded-lg text-xs font-medium transition-opacity ${
                            showOverlay ? 'bg-[#1e3a5f] text-white' : 'bg-black/60 text-white'
                          } ${fullscreenVideo === 'after' ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                        >
                          フレーム {showOverlay ? 'ON' : 'OFF'}
                        </button>
                      )}
                      <button
                        onClick={() => setFullscreenVideo(v => v === 'after' ? null : 'after')}
                        className="absolute top-2 right-2 z-10 p-1.5 bg-black/50 hover:bg-black/75 text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                        title={fullscreenVideo === 'after' ? '全画面を終了' : '全画面表示'}
                      >
                        {fullscreenVideo === 'after' ? (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M9 9L4 4m0 0v4m0-4h4M15 9l5-5m0 0v4m0-4h-4M9 15l-5 5m0 0v-4m0 4h4M15 15l5 5m0 0v-4m0 4h-4" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                          </svg>
                        )}
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
                <span className="text-xs text-gray-500 font-mono flex-shrink-0 text-right">
                  {currentTime.toFixed(1)}/<span className="hidden sm:inline">{videoDuration.toFixed(1)}秒</span><span className="sm:hidden">{videoDuration.toFixed(1)}s</span>
                </span>
              </div>

              {/* Sub-controls row */}
              <div className="flex items-center justify-end gap-2 mt-2">
                {/* フレーム表示トグル（全画面中はコンテナ内ボタンで操作するため非表示） */}
                {status === 'done' && currentPlaneData && !fullscreenVideo && (
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
        </div>{/* end 左パネル */}

        {/* ── 右パネル: 評価結果 ── */}
        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3 border-t md:border-t-0 md:border-l border-gray-200">

        {/* Graph + Gravity */}
        {currentPlaneData && status === 'done' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4">

            {/* 矢状面：撮影側セレクター */}
            {activeTab === 'sagittal' && (
              <div className="flex flex-wrap items-center gap-2 mb-4 pb-3 border-b">
                <span className="text-xs text-gray-500 font-medium flex-shrink-0">撮影側：</span>
                <div className="flex flex-wrap gap-1.5">
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

            {/* 前額面・バランス：支持脚セレクター */}
            {activeTab === 'frontal' && movementType === 'balance' && (
              <div className="flex flex-wrap items-center gap-2 mb-4 pb-3 border-b">
                <span className="text-xs text-gray-500 font-medium flex-shrink-0">立位の種類：</span>
                <div className="flex flex-wrap gap-1.5">
                  {([
                    { value: undefined, label: '両脚立位' },
                    { value: 'left',    label: '片脚（左支持）' },
                    { value: 'right',   label: '片脚（右支持）' },
                  ] as const).map(({ value, label }) => (
                    <button
                      key={value ?? 'bilateral'}
                      onClick={() => setFrontalSupportSide(value)}
                      className={`px-3 py-1 rounded-full text-xs font-semibold border transition ${
                        frontalSupportSide === value
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

            <div className="flex flex-col gap-4">
              <div className="min-w-0">
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
              <div className="w-full">
                <GravityPlot
                  beforeData={currentPlaneData.beforeData}
                  afterData={currentPlaneData.afterData}
                  beforeValidity={currentPlaneData.beforeValidity}
                  afterValidity={currentPlaneData.afterValidity}
                  plane={currentPlaneData.plane}
                  currentTime={currentTime}
                  onSeek={handleSeek}
                />
              </div>
            </div>

            {/* バランス安定性指標 */}
            {movementType === 'balance' && activeTab === 'frontal' && (() => {
              const bStab = calculateCogStability(currentPlaneData.beforeData, currentPlaneData.beforeValidity)
              const aStab = currentPlaneData.afterData.length > 0
                ? calculateCogStability(currentPlaneData.afterData, currentPlaneData.afterValidity)
                : null
              const metrics = [
                { label: '重心左右変動 (σ)', before: bStab.stdX, after: aStab?.stdX },
                { label: '重心上下変動 (σ)', before: bStab.stdY, after: aStab?.stdY },
                { label: '左右移動幅',        before: bStab.rangeX, after: aStab?.rangeX },
              ]
              return (
                <div className="mt-4 pt-4 border-t">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">バランス安定性指標</p>
                  <div className="grid grid-cols-3 gap-2">
                    {metrics.map(m => (
                      <div key={m.label} className="bg-gray-50 rounded-xl p-3 text-center border border-gray-100">
                        <div className="text-[10px] text-gray-400 mb-1 leading-tight">{m.label}</div>
                        <div className="text-sm font-bold text-[#3b82f6]">{m.before.toFixed(3)}</div>
                        {m.after !== undefined && m.after !== null && (
                          <div className="text-xs text-[#f97316] font-semibold mt-0.5">{m.after.toFixed(3)}</div>
                        )}
                        <div className="text-[9px] text-gray-300 mt-0.5">before{m.after != null ? ' / after' : ''}</div>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-gray-300 mt-1.5">単位: 正規化座標（小さいほど安定）</p>
                </div>
              )
            })()}
          </div>
        )}

        {/* 時間・効率指標カード */}
        {temporalMetrics && (() => {
          const { type, before, after } = temporalMetrics
          const hasAfter = after !== null

          type Row = { label: string; before: string; after?: string; delta?: string; good?: 'lower' | 'higher' }

          const fmt = (v: number | undefined, unit: string) =>
            v !== undefined ? `${v}${unit}` : '–'

          const deltaStr = (b: number | undefined, a: number | undefined, unit: string, good: 'lower' | 'higher') => {
            if (b === undefined || a === undefined) return { str: '–', color: 'text-gray-300' }
            const d = Math.round((a - b) * 100) / 100
            const improved = good === 'lower' ? d < 0 : d > 0
            const worsened = good === 'lower' ? d > 0 : d < 0
            const sign = d > 0 ? '+' : ''
            return {
              str: `${sign}${d}${unit}`,
              color: improved ? 'text-green-600' : worsened ? 'text-red-500' : 'text-gray-400',
            }
          }

          let rows: Row[] = []

          if (type === 'standing') {
            const b = before as StandingMetrics
            const a = after as StandingMetrics | null
            const { str: dStr, color: dColor } = deltaStr(b.duration, a?.duration, '秒', 'lower')
            rows = [
              { label: '所要時間', before: fmt(b.duration, '秒'), after: a ? fmt(a.duration, '秒') : undefined, delta: dStr, good: 'lower' },
            ]
            if (b.phases) {
              const { str: d1, color: c1 } = deltaStr(b.phases.leanForward, a?.phases?.leanForward, '秒', 'lower')
              const { str: d2, color: c2 } = deltaStr(b.phases.rise, a?.phases?.rise, '秒', 'lower')
              rows.push(
                { label: '  前傾フェーズ', before: fmt(b.phases.leanForward, '秒'), after: a?.phases ? fmt(a.phases.leanForward, '秒') : undefined, delta: d1, good: 'lower' },
                { label: '  離殿・伸展',   before: fmt(b.phases.rise, '秒'),        after: a?.phases ? fmt(a.phases.rise, '秒')        : undefined, delta: d2, good: 'lower' },
              )
              void c1; void c2
            }
            void dColor
          } else {
            const b = before as WalkingMetrics
            const a = after as WalkingMetrics | null
            rows = [
              { label: '歩行時間',    before: fmt(b.duration, '秒'),    after: a ? fmt(a.duration, '秒')    : undefined, delta: deltaStr(b.duration,      a?.duration,      '秒',    'lower').str,  good: 'lower'  },
              { label: '総歩数',      before: fmt(b.stepCount, '歩'),   after: a ? fmt(a.stepCount, '歩')   : undefined, delta: deltaStr(b.stepCount,     a?.stepCount,     '歩',    'higher').str, good: 'higher' },
              { label: 'ケイデンス',  before: fmt(b.cadence, '歩/分'),  after: a ? fmt(a.cadence, '歩/分')  : undefined, delta: deltaStr(b.cadence,       a?.cadence,       '歩/分', 'higher').str, good: 'higher' },
              { label: '左右対称性',  before: fmt(b.symmetryIndex, '%'), after: a ? fmt(a.symmetryIndex, '%') : undefined, delta: deltaStr(b.symmetryIndex, a?.symmetryIndex, '%',     'higher').str, good: 'higher' },
            ]
            if (b.speed !== undefined) {
              rows.splice(1, 0, { label: '歩行速度', before: fmt(b.speed, 'm/s'), after: a?.speed !== undefined ? fmt(a.speed, 'm/s') : undefined, delta: deltaStr(b.speed, a?.speed, 'm/s', 'higher').str, good: 'higher' })
            }
            if (b.stepLength !== undefined) {
              rows.push({ label: '歩幅', before: fmt(b.stepLength, 'cm'), after: a?.stepLength !== undefined ? fmt(a.stepLength, 'cm') : undefined, delta: deltaStr(b.stepLength, a?.stepLength, 'cm', 'higher').str, good: 'higher' })
            }
          }

          return (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
                {type === 'standing' ? '立ち上がり指標' : '歩行指標'}
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-400 border-b border-gray-100">
                      <th className="text-left pb-2 font-medium">指標</th>
                      <th className="text-right pb-2 font-medium text-[#3b82f6]">Before</th>
                      {hasAfter && <th className="text-right pb-2 font-medium text-[#f97316]">After</th>}
                      {hasAfter && <th className="text-right pb-2 font-medium">変化</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => {
                      const { str: dStr, color: dColor } = row.good && row.delta
                        ? deltaStr(
                            parseFloat(row.before),
                            row.after !== undefined ? parseFloat(row.after) : undefined,
                            '',
                            row.good
                          )
                        : { str: row.delta ?? '–', color: 'text-gray-400' }
                      return (
                        <tr key={i} className="border-b border-gray-50 last:border-0">
                          <td className="py-2 text-gray-600 text-xs">{row.label}</td>
                          <td className="py-2 text-right font-bold text-[#3b82f6]">{row.before}</td>
                          {hasAfter && <td className="py-2 text-right font-bold text-[#f97316]">{row.after ?? '–'}</td>}
                          {hasAfter && <td className={`py-2 text-right text-xs font-semibold ${dColor}`}>{row.delta ?? '–'}</td>}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )
        })()}

        {/* 所見入力欄 */}
        {status === 'done' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
            <label className="block text-sm font-bold text-[#1e3a5f] mb-2">臨床所見・メモ</label>
            <textarea
              value={clinicalNote}
              onChange={e => setClinicalNote(e.target.value)}
              placeholder="介入内容、所見、特記事項などを入力してください（PDF出力に含まれます）"
              rows={4}
              className="w-full text-sm text-gray-700 border border-gray-300 rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:border-[#3b82f6] focus:ring-1 focus:ring-[#3b82f6] placeholder-gray-300"
            />
          </div>
        )}

        {status === 'idle' && (
          <div className="text-center text-gray-400 py-12">分析結果を待っています...</div>
        )}
        </div>{/* end 右パネル */}
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
