'use client'

import { useRef, useState } from 'react'

interface VideoInputAreaProps {
  label: string
  borderColor: 'blue' | 'orange'
  onVideoReady: (url: string) => void
  videoUrl?: string
  /** ボタンのみ表示（プレビュー・ラベル非表示） */
  compact?: boolean
}

export default function VideoInputArea({
  label,
  borderColor,
  onVideoReady,
  videoUrl,
  compact = false,
}: VideoInputAreaProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [recording, setRecording] = useState(false)
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null)
  const [error, setError] = useState('')
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const borderClass = borderColor === 'blue' ? 'border-[#3b82f6]' : 'border-[#f97316]'
  const labelClass = borderColor === 'blue' ? 'text-[#3b82f6]' : 'text-[#f97316]'

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError('')
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('video/')) {
      setError('動画ファイルを選択してください')
      return
    }
    const url = URL.createObjectURL(file)
    onVideoReady(url)
  }

  const getSupportedMimeType = () => {
    const types = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4']
    return types.find(t => MediaRecorder.isTypeSupported(t)) ?? ''
  }

  const startRecording = async () => {
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play().catch(() => {})
      }
      const mimeType = getSupportedMimeType()
      const chunks: BlobPart[] = []
      const mr = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
      mr.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data) }
      mr.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType || 'video/mp4' })
        const url = URL.createObjectURL(blob)
        onVideoReady(url)
        if (videoRef.current) videoRef.current.srcObject = null
      }
      mr.start()
      setMediaRecorder(mr)
      setRecording(true)
    } catch {
      setError('カメラへのアクセスを許可してください')
    }
  }

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.requestData()
      mediaRecorder.stop()
    }
    streamRef.current?.getTracks().forEach(t => t.stop())
    setRecording(false)
    setMediaRecorder(null)
  }

  if (compact) {
    return (
      <div className="flex flex-col gap-2 w-full">
        {recording ? (
          <button
            onClick={stopRecording}
            className="w-full flex items-center justify-center gap-2 bg-red-500 text-white rounded-xl py-3 text-sm font-semibold hover:bg-red-600 transition"
          >
            <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
            停止
          </button>
        ) : (
          <>
            <button
              onClick={startRecording}
              className="w-full flex items-center justify-center gap-2 bg-[#1e3a5f] text-white rounded-xl py-3 text-sm font-semibold hover:bg-[#162d4a] transition"
            >
              <div className="w-2 h-2 bg-red-400 rounded-full" />
              録画する
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 border border-gray-300 text-gray-700 rounded-xl py-3 text-sm font-semibold hover:border-gray-400 hover:bg-gray-50 transition"
            >
              ファイルを選択
            </button>
          </>
        )}
        {error && <p className="text-[#ef4444] text-xs text-center">{error}</p>}
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={handleFileChange}
          aria-label={`${label}の動画を選択`}
        />
      </div>
    )
  }

  return (
    <div className={`border-2 ${borderClass} rounded-xl p-4 flex flex-col gap-3 bg-white`}>
      <div className={`text-sm font-bold ${labelClass} text-center`}>{label}</div>

      {/* Preview */}
      <div className="relative aspect-video bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center">
        {recording && (
          <video ref={videoRef} className="w-full h-full object-cover" muted playsInline autoPlay data-testid={`${label}-live`} />
        )}
        {!recording && videoUrl && (
          <video
            src={videoUrl}
            className="w-full h-full object-cover"
            controls
            data-testid={`${label.toLowerCase().replace(/\s/g, '-')}-video-preview`}
          />
        )}
        {!recording && !videoUrl && (
          <div className="flex flex-col items-center gap-2 text-gray-400">
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M15 10l4.553-2.069A1 1 0 0121 8.845v6.31a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <span className="text-xs">動画未選択</span>
          </div>
        )}
        {recording && (
          <div className="absolute top-2 right-2 flex items-center gap-1 bg-red-500 text-white text-xs px-2 py-1 rounded-full">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
            録画中
          </div>
        )}
      </div>

      {/* Buttons */}
      <div className="flex gap-2">
        {!recording ? (
          <>
            <button
              onClick={startRecording}
              className="flex-1 flex items-center justify-center gap-1.5 border border-[#1e3a5f] text-[#1e3a5f] rounded-lg py-2 text-sm font-medium hover:bg-[#1e3a5f] hover:text-white transition"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <circle cx="10" cy="10" r="6" />
              </svg>
              録画する
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 flex items-center justify-center gap-1.5 bg-[#3b82f6] text-white rounded-lg py-2 text-sm font-medium hover:bg-[#2563eb] transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              ファイルを選択
            </button>
          </>
        ) : (
          <button
            onClick={stopRecording}
            className="flex-1 flex items-center justify-center gap-1.5 bg-red-500 text-white rounded-lg py-2 text-sm font-medium hover:bg-red-600 transition"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <rect x="4" y="4" width="12" height="12" rx="1" />
            </svg>
            録画を停止
          </button>
        )}
      </div>

      {error && <p className="text-[#ef4444] text-xs text-center">{error}</p>}

      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={handleFileChange}
        aria-label={`${label}の動画を選択`}
      />
    </div>
  )
}
