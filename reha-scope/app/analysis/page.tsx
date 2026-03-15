'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthGuard } from '@/hooks/useAuthGuard'
import { useSession, FrameData } from '@/context/SessionContext'
import { analyzeVideo } from '@/lib/mediapipe'
import { calculateAllAngles } from '@/lib/angleCalc'
import { calculateCenterOfGravity } from '@/lib/gravityCalc'
import { generatePdf, generateFileName } from '@/lib/pdfExport'
import { generateCsv, downloadCsv } from '@/lib/csvExport'
import AngleGraph from '@/components/AngleGraph'
import GravityPlot from '@/components/GravityPlot'
import SnapshotModal from '@/components/SnapshotModal'
import type { PoseLandmarks } from '@/lib/mediapipe'

type ActiveTab = 'frontal' | 'sagittal'
type AnalysisStatus = 'idle' | 'analyzing' | 'done' | 'error'

interface PlaneAnalysis {
  beforeData: FrameData[]
  afterData: FrameData[]
  beforeLandmarks: PoseLandmarks[]
  afterLandmarks: PoseLandmarks[]
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

  const [activeTab, setActiveTab] = useState<ActiveTab>('frontal')
  const [status, setStatus] = useState<AnalysisStatus>('idle')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const [frontal, setFrontal] = useState<PlaneAnalysis | null>(null)
  const [sagittal, setSagittal] = useState<PlaneAnalysis | null>(null)
  const [showSnapshot, setShowSnapshot] = useState(false)
  const [playing, setPlaying] = useState(false)
  const beforeVideoRef = useRef<HTMLVideoElement>(null)
  const afterVideoRef = useRef<HTMLVideoElement>(null)
  const analysisRef = useRef<HTMLDivElement>(null)

  const analyzePlane = async (
    beforeUrl: string,
    afterUrl: string
  ): Promise<PlaneAnalysis> => {
    const [bLandmarksRaw, aLandmarksRaw] = await Promise.all([
      analyzeVideo(beforeUrl, p => setProgress(Math.floor(p / 2))),
      analyzeVideo(afterUrl, p => setProgress(50 + Math.floor(p / 2))),
    ])

    const toFrameData = (landmarks: PoseLandmarks, i: number): FrameData => {
      const angles = landmarks.length > 0 ? calculateAllAngles(landmarks) : { hip: 0, knee: 0, ankle: 0, trunk: 0 }
      const gravity = landmarks.length > 0 ? calculateCenterOfGravity(landmarks) : { x: 0.5, y: 0.5 }
      return { frame: i, ...angles, gravityX: gravity.x, gravityY: gravity.y }
    }

    return {
      beforeData: bLandmarksRaw.map((lm, i) => toFrameData(lm, i)),
      afterData: aLandmarksRaw.map((lm, i) => toFrameData(lm, i)),
      beforeLandmarks: bLandmarksRaw as PoseLandmarks[],
      afterLandmarks: aLandmarksRaw as PoseLandmarks[],
    }
  }

  useEffect(() => {
    if (!plane || !videos) return

    const run = async () => {
      setStatus('analyzing')
      setProgress(0)
      try {
        if ((plane === 'frontal' || plane === 'both') && videos.frontalBefore && videos.frontalAfter) {
          const result = await analyzePlane(videos.frontalBefore, videos.frontalAfter)
          setFrontal(result)
        }
        if ((plane === 'sagittal' || plane === 'both') && videos.sagittalBefore && videos.sagittalAfter) {
          const result = await analyzePlane(videos.sagittalBefore, videos.sagittalAfter)
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

  const currentPlaneData = activeTab === 'frontal' ? frontal : sagittal
  const currentBeforeUrl = activeTab === 'frontal' ? videos.frontalBefore : videos.sagittalBefore
  const currentAfterUrl = activeTab === 'frontal' ? videos.frontalAfter : videos.sagittalAfter

  const handlePlayPause = () => {
    if (!beforeVideoRef.current || !afterVideoRef.current) return
    if (playing) {
      beforeVideoRef.current.pause()
      afterVideoRef.current.pause()
    } else {
      beforeVideoRef.current.play()
      afterVideoRef.current.play()
    }
    setPlaying(!playing)
  }

  const handleReset = () => {
    if (beforeVideoRef.current) beforeVideoRef.current.currentTime = 0
    if (afterVideoRef.current) afterVideoRef.current.currentTime = 0
    beforeVideoRef.current?.pause()
    afterVideoRef.current?.pause()
    setPlaying(false)
  }

  const handleExportPdf = async () => {
    if (!analysisRef.current) return
    const fileName = generateFileName({
      date: new Date(),
      movementType: movementType ?? 'unknown',
      plane: plane ?? 'frontal',
      extension: 'pdf',
    })
    await generatePdf('analysis-content', fileName)
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
      <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center gap-6">
        <div className="text-[#1e3a5f] text-xl font-bold">動画を分析中...</div>
        <div className="w-72 bg-gray-200 rounded-full h-3">
          <div
            className="bg-[#3b82f6] h-3 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="text-gray-500 text-sm">{progress}%</div>
        <p className="text-gray-400 text-xs">しばらくお待ちください</p>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center gap-4">
        <div className="text-[#ef4444] text-lg font-bold">{error}</div>
        <button onClick={() => router.push('/input')} className="bg-[#1e3a5f] text-white px-6 py-3 rounded-lg">
          動画を選び直す
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col">
      {/* Header */}
      <header className="bg-[#1e3a5f] text-white px-6 py-3 flex items-center justify-between shadow">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/input')}
            className="text-white/70 hover:text-white transition text-sm flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            戻る
          </button>
          <span className="font-bold">RehaScope</span>
          <span className="text-white/60 text-sm">|</span>
          <span className="text-sm text-white/80">{MOVEMENT_LABELS[movementType ?? '']}</span>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleExportPdf}
            className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg text-sm transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            PDF出力
          </button>
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg text-sm transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            CSV
          </button>
        </div>
      </header>

      {/* Tabs */}
      {plane === 'both' && (
        <div className="bg-white border-b flex">
          {(['frontal', 'sagittal'] as ActiveTab[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              role="tab"
              className={`px-6 py-3 text-sm font-medium border-b-2 transition ${
                activeTab === tab
                  ? 'border-[#3b82f6] text-[#3b82f6]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab === 'frontal' ? '前額面' : '矢状面'}
            </button>
          ))}
        </div>
      )}

      <div id="analysis-content" ref={analysisRef} className="flex-1 p-4 space-y-4" data-testid="analysis-view">
        {/* Videos */}
        {currentBeforeUrl && currentAfterUrl && (
          <div className="bg-white rounded-2xl shadow-md p-4">
            <div className="grid grid-cols-2 gap-4 mb-3">
              <div>
                <div className="text-xs font-bold text-[#3b82f6] mb-1">Before</div>
                <div className="border-2 border-[#3b82f6] rounded-lg overflow-hidden aspect-video bg-black">
                  <video
                    ref={beforeVideoRef}
                    src={currentBeforeUrl}
                    className="w-full h-full object-contain"
                    data-testid="before-video"
                    onEnded={() => setPlaying(false)}
                  />
                </div>
              </div>
              <div>
                <div className="text-xs font-bold text-[#f97316] mb-1">After</div>
                <div className="border-2 border-[#f97316] rounded-lg overflow-hidden aspect-video bg-black">
                  <video
                    ref={afterVideoRef}
                    src={currentAfterUrl}
                    className="w-full h-full object-contain"
                    data-testid="after-video"
                    onEnded={() => setPlaying(false)}
                  />
                </div>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={handleReset}
                className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition"
              >
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
              <button
                onClick={handlePlayPause}
                className="flex items-center gap-2 bg-[#1e3a5f] text-white px-6 py-2 rounded-lg font-medium hover:bg-[#162d4a] transition"
              >
                {playing ? (
                  <><svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>一時停止</>
                ) : (
                  <><svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                  </svg>再生</>
                )}
              </button>
              <button
                onClick={() => setShowSnapshot(true)}
                className="flex items-center gap-1.5 border border-[#1e3a5f] text-[#1e3a5f] px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#1e3a5f] hover:text-white transition"
              >
                フレーム指定
              </button>
            </div>
          </div>
        )}

        {/* Graph + Gravity */}
        {currentPlaneData && status === 'done' && (
          <div className="bg-white rounded-2xl shadow-md p-4">
            <div className="flex gap-6 items-start">
              <div className="flex-1">
                <AngleGraph
                  beforeData={currentPlaneData.beforeData}
                  afterData={currentPlaneData.afterData}
                />
              </div>
              <div className="flex-shrink-0">
                <GravityPlot
                  beforeData={currentPlaneData.beforeData}
                  afterData={currentPlaneData.afterData}
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
      {showSnapshot && currentPlaneData && currentBeforeUrl && currentAfterUrl && (
        <SnapshotModal
          beforeUrl={currentBeforeUrl}
          afterUrl={currentAfterUrl}
          beforeData={currentPlaneData.beforeData}
          afterData={currentPlaneData.afterData}
          beforeLandmarks={currentPlaneData.beforeLandmarks}
          afterLandmarks={currentPlaneData.afterLandmarks}
          onClose={() => setShowSnapshot(false)}
        />
      )}
    </div>
  )
}
