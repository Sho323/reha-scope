'use client'

import { createContext, useContext, useState, ReactNode } from 'react'

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

const initialState: SessionState = {
  movementType: null,
  plane: null,
  balanceType: null,
  walkingDistance: null,
  videos: {},
  analysisData: {},
  clinicalNote: '',
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>(initialState)

  const setMovementType = (t: MovementType) =>
    setState(s => ({ ...s, movementType: t, balanceType: null }))

  const setPlane = (p: PlaneType) =>
    setState(s => ({ ...s, plane: p }))

  const setBalanceType = (t: BalanceType) =>
    setState(s => ({ ...s, balanceType: t }))

  const setWalkingDistance = (d: number | null) =>
    setState(s => ({ ...s, walkingDistance: d }))

  const setVideos = (v: VideoSet) =>
    setState(s => ({ ...s, videos: v }))

  const setAnalysisData = (plane: 'frontal' | 'sagittal', data: AnalysisData) =>
    setState(s => ({
      ...s,
      analysisData: { ...s.analysisData, [plane]: data },
    }))

  const setClinicalNote = (note: string) =>
    setState(s => ({ ...s, clinicalNote: note }))

  const reset = () => setState(initialState)

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
