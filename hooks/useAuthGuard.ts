'use client'

import { useEffect } from 'react'

export function useAuthGuard() {
  useEffect(() => {
    const isAuthed = localStorage.getItem('reha_auth')
    if (!isAuthed) {
      window.location.href = '/'
    }
  }, [])
}
