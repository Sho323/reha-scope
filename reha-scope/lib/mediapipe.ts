// MediaPipe Pose wrapper（ブラウザ専用・dynamic importで使用）
export type Landmark = { x: number; y: number; z: number; visibility?: number }
export type PoseLandmarks = Landmark[]

export interface PoseResults {
  poseLandmarks: PoseLandmarks | null
}

let poseInstance: unknown = null

export async function initPose(onResults: (results: PoseResults) => void): Promise<unknown> {
  // Dynamic import for client-side only
  const { Pose } = await import('@mediapipe/pose')

  const pose = new Pose({
    locateFile: (file: string) =>
      `https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404/${file}`,
  })

  pose.setOptions({
    modelComplexity: 1,
    smoothLandmarks: true,
    enableSegmentation: false,
    smoothSegmentation: false,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
  })

  pose.onResults(onResults)
  poseInstance = pose
  return pose
}

export function analyzePose(results: PoseResults): PoseLandmarks | null {
  if (!results.poseLandmarks) return null
  return results.poseLandmarks
}

export async function sendVideoFrame(
  videoElement: HTMLVideoElement,
  pose: unknown
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (pose as any).send({ image: videoElement })
}

/**
 * 動画全フレームをMediaPipeで解析してフレームデータ配列を返す
 */
export async function analyzeVideo(
  videoUrl: string,
  onProgress?: (progress: number) => void
): Promise<PoseLandmarks[]> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.src = videoUrl
    video.crossOrigin = 'anonymous'
    video.preload = 'auto'

    const results: PoseLandmarks[] = []
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!

    video.onloadedmetadata = async () => {
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight

      let pose: unknown
      try {
        pose = await initPose((r: PoseResults) => {
          if (r.poseLandmarks) {
            results.push([...r.poseLandmarks])
          } else {
            // フレームにランドマークがない場合は空配列を追加
            results.push([])
          }
        })
      } catch (e) {
        reject(e)
        return
      }

      const fps = 15 // 解析FPS（処理負荷軽減）
      const duration = video.duration
      const totalFrames = Math.floor(duration * fps)
      let frame = 0

      const processFrame = async () => {
        if (frame >= totalFrames) {
          resolve(results)
          return
        }

        video.currentTime = frame / fps
        await new Promise<void>(r => { video.onseeked = () => r() })

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        await sendVideoFrame(video, pose)

        onProgress?.(Math.round((frame / totalFrames) * 100))
        frame++
        requestAnimationFrame(processFrame)
      }

      processFrame()
    }

    video.onerror = () => reject(new Error('動画の読み込みに失敗しました'))
    video.load()
  })
}
