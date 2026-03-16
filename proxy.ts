import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PROTECTED_PATHS = ['/home', '/input', '/analysis']

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isProtected = PROTECTED_PATHS.some(path => pathname.startsWith(path))

  if (isProtected) {
    const authCookie = request.cookies.get('reha_auth')
    if (!authCookie || authCookie.value !== 'true') {
      return NextResponse.redirect(new URL('/', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/home/:path*', '/input/:path*', '/analysis/:path*'],
}
