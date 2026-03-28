'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { clearAllVideoBlobs } from '@/lib/videoDB'

export type MovementType = 'standing' | 'walking' | 'balance'
export type PlaneType = 'frontal' | 'sagittal' | 'both'
export type BalanceType = 'bilateral' | 'single_left' | 'single_right'

export interface VideoSet {
  frontalBefore?: string  // blob URL
  frontalAfter?: string
  sagittalBefore?: string
  sagittalAfter?: string
}

export interface FrameData {
  frame: number
  hip: number
  knee: number
  ankle: number
  trunk: number
  gravityX: number
  gravityY: number
}

export interface AnalysisData {
  before: FrameData[]
  after: FrameData[]
}

interface SessionState {
  movementType: MovementType | null
  plane: PlaneType | null
  balanceType: BalanceType | null
  walkingDistance: number | null  // m（歩行速度・歩幅計算用）
  videos: VideoSet
  analysisData: {
    frontal?: AnalysisData
    sagittal?: AnalysisData
  }
  clinicalNote: string
}

interface SessionContextValue extends SessionState {
  setMovementType: (t: MovementType) => void
  setPlane: (p: PlaneType) => void
  setBalanceType: (t: BalanceType) => void
  setWalkingDistance: (d: number | null) => void
  setVideos: (v: VideoSet) => void
  setAnalysisData: (plane: 'frontal' | 'sagittal', data: AnalysisData) => void
  setClinicalNote: (note: string) => void
  reset: () => void
}

const SessionContext = createContext<SessionContextValue | null>(null)

const SESSION_KEY = 'reha_session'
// アプリが生きているセッションかどうかを sessionStorage で管理
// sessionStorage はアプリ終了（kill）で消えるがバックグラウンドでは残る
// → アプリ再起動時に IndexedDB の動画をクリアするためのフラグ
const SESSION_ALIVE_KEY = 'reha_session_alive'

const initialState: SessionState = {
  movementType: null,
  plane: null,
  balanceType: null,
  walkingDistance: null,
  videos: {},
  analysisData: {},
  clinicalNote: '',
}

function loadState(): SessionState {
  try {
    const saved = sessionStorage.getItem(SESSION_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      // 古いセッションにvideos(Blob URL)が残っている場合は無視して初期化
      return { ...initialState, ...parsed, analysisData: {}, videos: {} }
    }
  } catch {}
  return initialState
}

function saveState(state: SessionState) {
  try {
    // analysisData は大容量のため保存対象外
    // videos(Blob URL) はリロード後に無効になるため保存対象外
    const { analysisData: _, videos: __, ...rest } = state
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(rest))
  } catch {}
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>(initialState)

  // クライアントサイドでのみ、マウント時にsessionStorageから状態を復元（Hydration Mismatch防止）
  // アプリが再起動（kill後の再開）された場合はIndexedDBの動画をクリアする
  useEffect(() => {
    const isAlive = sessionStorage.getItem(SESSION_ALIVE_KEY)
    if (!isAlive) {
      // 新規セッション（アプリがkillされていた）→ IndexedDB の動画を削除
      clearAllVideoBlobs().catch(() => {})
      sessionStorage.setItem(SESSION_ALIVE_KEY, '1')
    }
    setState(loadState())
  }, [])

  // 状態変更のたびに sessionStorage へ保存（ページ遷移後も復元できるよう）
  const update = (updater: (s: SessionState) => SessionState) =>
    setState(s => { const next = updater(s); saveState(next); return next })

  const setMovementType = (t: MovementType) =>
    update(s => ({ ...s, movementType: t, balanceType: null }))

  const setPlane = (p: PlaneType) =>
    update(s => ({ ...s, plane: p }))

  const setBalanceType = (t: BalanceType) =>
    update(s => ({ ...s, balanceType: t }))

  const setWalkingDistance = (d: number | null) =>
    update(s => ({ ...s, walkingDistance: d }))

  const setVideos = (v: VideoSet) =>
    update(s => ({ ...s, videos: v }))

  const setAnalysisData = (plane: 'frontal' | 'sagittal', data: AnalysisData) =>
    setState(s => ({
      ...s,
      analysisData: { ...s.analysisData, [plane]: data },
    }))

  const setClinicalNote = (note: string) =>
    update(s => ({ ...s, clinicalNote: note }))

  const reset = () => {
    sessionStorage.removeItem(SESSION_KEY)
    setState(initialState)
  }

  return (
    <SessionContext.Provider
      value={{ ...state, setMovementType, setPlane, setBalanceType, setWalkingDistance, setVideos, setAnalysisData, setClinicalNote, reset }}
    >
      {children}
    </SessionContext.Provider>
  )
}

export function useSession() {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession must be used within SessionProvider')
  return ctx
}
