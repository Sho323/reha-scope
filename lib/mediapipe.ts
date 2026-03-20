/**
 * MediaPipe Tasks Vision wrapper（ブラウザ専用）
 *
 * @mediapipe/pose@0.5 は emscripten の Module.arguments チェックが
 * Next.js / React 19 / turbopack 環境と非互換のため WASM abort する。
 * 後継の @mediapipe/tasks-vision PoseLandmarker を CDN から直接ロードして回避。
 */

export type Landmark = { x: number; y: number; z: number; visibility?: number }
export type PoseLandmarks = Landmark[]

// ─── 定数 ────────────────────────────────────────────────
const TASKS_CDN = '/mediapipe'
const MODEL_URL = '/mediapipe/pose_landmarker_lite.task'

/** window に保持してHMRリロードをまたいで再利用 */
const SINGLETON_KEY = '__rehaScope_poseLandmarker'

// ─── CDN ロード ───────────────────────────────────────────

/**
 * バンドラーの静的解析をバイパスして CDN から ES モジュールを import する。
 * turbopack / webpack はテンプレートリテラルの import() を解析しようとするため
 * new Function を使って実行時に評価する。
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const importFromUrl = new Function('url', 'return import(url)') as (url: string) => Promise<any>

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getPoseLandmarker(): Promise<any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((window as any)[SINGLETON_KEY]) return (window as any)[SINGLETON_KEY]

  const vision = await importFromUrl(`${TASKS_CDN}/vision_bundle.mjs`)
  const { PoseLandmarker, FilesetResolver } = vision

  const filesetResolver = await FilesetResolver.forVisionTasks(`${TASKS_CDN}/wasm`)

  const poseLandmarker = await PoseLandmarker.createFromOptions(filesetResolver, {
    baseOptions: {
      modelAssetPath: MODEL_URL,
      delegate: 'CPU',
    },
    runningMode: 'IMAGE',
    numPoses: 1,
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(window as any)[SINGLETON_KEY] = poseLandmarker
  return poseLandmarker
}

// ─── 公開 API ─────────────────────────────────────────────

/**
 * 動画の全フレームを PoseLandmarker で解析してランドマーク配列を返す。
 * フレームごとに canvas に描画してから同期検出（IMAGE mode）。
 */
export async function analyzeVideo(
  videoUrl: string,
  onProgress?: (progress: number) => void
): Promise<PoseLandmarks[]> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.src = videoUrl
    video.preload = 'auto'

    const frameResults: PoseLandmarks[] = []
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!

    video.onloadedmetadata = async () => {
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let poseLandmarker: any
      try {
        poseLandmarker = await getPoseLandmarker()
      } catch (e) {
        reject(e)
        return
      }

      const fps = 15
      const duration = video.duration
      const totalFrames = Math.floor(duration * fps)
      let frame = 0

      const processFrame = async () => {
        if (frame >= totalFrames) {
          resolve(frameResults)
          return
        }

        video.currentTime = frame / fps

        // seeked が発火しないケース（frame=0 など）に備えてタイムアウト
        await new Promise<void>(r => {
          let done = false
          const finish = () => { if (!done) { done = true; r() } }
          video.addEventListener('seeked', finish, { once: true })
          setTimeout(finish, 500)
        })

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

        // canvas から同期で骨格検出（IMAGE mode は同期 API）
        const result = poseLandmarker.detect(canvas)

        if (result.landmarks && result.landmarks.length > 0) {
          frameResults.push(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            result.landmarks[0].map((lm: any) => ({
              x: lm.x,
              y: lm.y,
              z: lm.z,
              visibility: lm.visibility ?? lm.presence ?? 1,
            }))
          )
        } else {
          frameResults.push([])
        }

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
