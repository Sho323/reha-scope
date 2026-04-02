'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function PasswordGate() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  // 認証済みの場合は /home へ自動リダイレクト
  // navigateFallback で '/' が返された場合にも正しくホームへ進む
  useEffect(() => {
    if (localStorage.getItem('reha_auth')) {
      router.replace('/home')
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!password) {
      setError('パスワードを入力してください')
      return
    }

    setLoading(true)

    const encoded = new TextEncoder().encode(password)
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoded)
    const hashHex = Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')

    if (hashHex === process.env.NEXT_PUBLIC_PASSWORD_HASH) {
      localStorage.setItem('reha_auth', 'true')
      document.cookie = 'reha_auth=true; path=/; SameSite=Strict'
      window.location.href = '/home'
    } else {
      setError('パスワードが違います')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
      <div className="bg-white rounded-2xl shadow-lg p-10 w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-[#1e3a5f] rounded-2xl mb-4">
            <svg className="w-9 h-9 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-[#1e3a5f] tracking-tight">RehaScope</h1>
          <p className="text-sm text-gray-500 mt-1">Motion Analysis Tool</p>
        </div>

        {/* Demo notice */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 mb-4 text-sm text-blue-700">
          デモ用パスワード：<span className="font-mono font-semibold">demo2026</span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              パスワード
            </label>
            <input
              type="password"
              placeholder="パスワードを入力"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-[#3b82f6] focus:border-transparent transition"
              autoComplete="current-password"
            />
          </div>

          {error && (
            <p className="text-[#ef4444] text-sm flex items-center gap-1.5">
              <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#1e3a5f] text-white py-3 rounded-lg font-medium hover:bg-[#162d4a] transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? '確認中...' : '入室する'}
          </button>
        </form>
      </div>
    </div>
  )
}
