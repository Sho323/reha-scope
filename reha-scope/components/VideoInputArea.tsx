'use client'

import { useRef, useState } from 'react'

interface VideoInputAreaProps {
  label: string
  borderColor: 'blue' | 'orange'
  onVideoReady: (url: string) => void
  videoUrl?: string
}

export default function VideoInputArea({
  label,
  borderColor,
  onVideoReady,
  videoUrl,
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

  const startRecording = async () => {
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
      }
      const chunks: BlobPart[] = []
      const mr = new MediaRecorder(stream)
      mr.ondataavailable = e => chunks.push(e.data)
      mr.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' })
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
    mediaRecorder?.stop()
    streamRef.current?.getTracks().forEach(t => t.stop())
    setRecording(false)
    setMediaRecorder(null)
  }

  return (
    <div className={`border-2 ${borderClass} rounded-xl p-4 flex flex-col gap-3 bg-white`}>
      <div className={`text-sm font-bold ${labelClass} text-center`}>{label}</div>

      {/* Preview */}
      <div className="relative aspect-video bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center">
        {recording && (
          <video ref={videoRef} className="w-full h-full object-cover" muted data-testid={`${label}-live`} />
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
