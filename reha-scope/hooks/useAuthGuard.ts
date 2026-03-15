'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export function useAuthGuard() {
  const router = useRouter()

  useEffect(() => {
    const isAuthed = sessionStorage.getItem('reha_auth')
    if (!isAuthed) {
      router.push('/')
    }
  }, [router])
}
