// MediaPipe wrapper のモック（CDN ロードを使用するためブラウザ外では動かない）
jest.mock('@/lib/mediapipe', () => ({
  analyzeVideo: jest.fn().mockResolvedValue([]),
}))

// html2canvasのモック
jest.mock('html2canvas', () =>
  jest.fn().mockResolvedValue({
    toDataURL: jest.fn().mockReturnValue('data:image/png;base64,mock'),
    width: 800,
    height: 600,
  })
)

// jspdfのモック
jest.mock('jspdf', () => ({
  default: jest.fn().mockImplementation(() => ({
    addImage: jest.fn(),
    save: jest.fn(),
  })),
}))

// next/navigationのモック
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({ push: jest.fn() })),
  usePathname: jest.fn(() => '/'),
}))
