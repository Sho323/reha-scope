# RehaScope - テスト仕様書（TDD）

**バージョン：** 1.0
**作成日：** 2026-03-15
**テストフレームワーク：** Jest + React Testing Library

---

## 1. テスト対象機能一覧

| ID | 機能 | テスト種別 |
|----|------|----------|
| T-01〜02 | パスワード認証 | 正常系・異常系・権限 |
| T-03〜04 | 動作種類選択 | 正常系 |
| T-05〜07 | 動画入力 | 正常系・異常系 |
| T-08〜09 | Before/After表示 | 正常系 |
| T-10 | タブ切替 | 正常系 |
| T-11 | 関節角度グラフ | 正常系・異常系 |
| T-12〜13 | PDF/CSVエクスポート | 正常系 |
| T-14 | オフライン動作 | 正常系 |
| T-15 | 権限制御 | 権限テスト |

---

## 2. テストコード

### セットアップ

```typescript
// jest.config.ts
import type { Config } from 'jest'

const config: Config = {
  testEnvironment: 'jsdom',
  setupFilesAfterFramework: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
  },
}

export default config
```

```typescript
// jest.setup.ts
import '@testing-library/jest-dom'

// MediaPipeのモック
jest.mock('@mediapipe/pose', () => ({
  Pose: jest.fn().mockImplementation(() => ({
    setOptions: jest.fn(),
    onResults: jest.fn(),
    send: jest.fn(),
    initialize: jest.fn().mockResolvedValue(undefined),
  })),
  POSE_CONNECTIONS: [],
}))

// html2canvasのモック
jest.mock('html2canvas', () =>
  jest.fn().mockResolvedValue({
    toDataURL: jest.fn().mockReturnValue('data:image/png;base64,mock'),
  })
)
```

---

### T-01：正常系 - 正しいパスワードで認証成功

```typescript
// __tests__/components/PasswordGate.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import PasswordGate from '@/components/PasswordGate'

describe('PasswordGate - 正常系', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_APP_PASSWORD = 'testpass123'
    sessionStorage.clear()
  })

  test('正しいパスワードを入力するとアプリに入れる', async () => {
    const mockOnSuccess = jest.fn()
    render(<PasswordGate onSuccess={mockOnSuccess} />)

    const input = screen.getByPlaceholderText(/パスワード/i)
    const button = screen.getByRole('button', { name: /入室する/i })

    fireEvent.change(input, { target: { value: 'testpass123' } })
    fireEvent.click(button)

    await waitFor(() => {
      expect(mockOnSuccess).toHaveBeenCalledTimes(1)
    })
  })

  test('認証成功後はsessionStorageにフラグが保存される', async () => {
    const mockOnSuccess = jest.fn()
    render(<PasswordGate onSuccess={mockOnSuccess} />)

    fireEvent.change(screen.getByPlaceholderText(/パスワード/i), {
      target: { value: 'testpass123' },
    })
    fireEvent.click(screen.getByRole('button', { name: /入室する/i }))

    await waitFor(() => {
      expect(sessionStorage.getItem('reha_auth')).toBe('true')
    })
  })
})
```

---

### T-02：異常系 - 間違ったパスワードではじかれる

```typescript
// __tests__/components/PasswordGate.test.tsx（続き）
describe('PasswordGate - 異常系', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_APP_PASSWORD = 'testpass123'
    sessionStorage.clear()
  })

  test('間違ったパスワードを入力するとエラーメッセージが表示される', async () => {
    const mockOnSuccess = jest.fn()
    render(<PasswordGate onSuccess={mockOnSuccess} />)

    fireEvent.change(screen.getByPlaceholderText(/パスワード/i), {
      target: { value: 'wrongpassword' },
    })
    fireEvent.click(screen.getByRole('button', { name: /入室する/i }))

    await waitFor(() => {
      expect(screen.getByText(/パスワードが違います/i)).toBeInTheDocument()
      expect(mockOnSuccess).not.toHaveBeenCalled()
    })
  })

  test('空のパスワードで送信するとエラーが表示される', async () => {
    const mockOnSuccess = jest.fn()
    render(<PasswordGate onSuccess={mockOnSuccess} />)

    fireEvent.click(screen.getByRole('button', { name: /入室する/i }))

    await waitFor(() => {
      expect(screen.getByText(/パスワードを入力してください/i)).toBeInTheDocument()
    })
  })
})
```

---

### T-03：正常系 - 動作種類を選択できる

```typescript
// __tests__/components/MovementSelector.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import MovementSelector from '@/components/MovementSelector'

describe('MovementSelector - 正常系', () => {
  test('3種類の動作カードが表示される', () => {
    const mockOnSelect = jest.fn()
    render(<MovementSelector onSelect={mockOnSelect} />)

    expect(screen.getByText(/立ち上がり/i)).toBeInTheDocument()
    expect(screen.getByText(/歩行/i)).toBeInTheDocument()
    expect(screen.getByText(/バランス/i)).toBeInTheDocument()
  })

  test('動作カードをクリックするとonSelectが呼ばれる', () => {
    const mockOnSelect = jest.fn()
    render(<MovementSelector onSelect={mockOnSelect} />)

    fireEvent.click(screen.getByText(/立ち上がり/i))
    expect(mockOnSelect).toHaveBeenCalledWith('standing')

    fireEvent.click(screen.getByText(/歩行/i))
    expect(mockOnSelect).toHaveBeenCalledWith('walking')

    fireEvent.click(screen.getByText(/バランス/i))
    expect(mockOnSelect).toHaveBeenCalledWith('balance')
  })
})
```

---

### T-04：正常系 - 撮影面を選択できる

```typescript
// __tests__/components/VideoInput.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import VideoInput from '@/components/VideoInput'

describe('VideoInput - 撮影面選択', () => {
  test('撮影面の3択ボタンが表示される', () => {
    render(<VideoInput movementType="standing" onComplete={jest.fn()} />)

    expect(screen.getByRole('button', { name: /前額面/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /矢状面/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /両方/i })).toBeInTheDocument()
  })

  test('「両方」を選択すると4つの動画入力エリアが表示される', () => {
    render(<VideoInput movementType="standing" onComplete={jest.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: /両方/i }))

    expect(screen.getByText(/前額面 Before/i)).toBeInTheDocument()
    expect(screen.getByText(/前額面 After/i)).toBeInTheDocument()
    expect(screen.getByText(/矢状面 Before/i)).toBeInTheDocument()
    expect(screen.getByText(/矢状面 After/i)).toBeInTheDocument()
  })
})
```

---

### T-05：正常系 - 動画ファイルをアップロードできる

```typescript
// __tests__/components/VideoInput.test.tsx（続き）
describe('VideoInput - ファイルアップロード', () => {
  test('MP4ファイルをアップロードすると動画プレビューが表示される', async () => {
    render(<VideoInput movementType="standing" onComplete={jest.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /前額面/i }))

    const file = new File(['video content'], 'test.mp4', { type: 'video/mp4' })
    const input = screen.getAllByLabelText(/動画を選択/i)[0]

    fireEvent.change(input, { target: { files: [file] } })

    const { waitFor } = await import('@testing-library/react')
    await waitFor(() => {
      expect(screen.getByTestId('before-video-preview')).toBeInTheDocument()
    })
  })
})
```

---

### T-06：異常系 - 動画以外のファイルをアップロードするとエラー表示

```typescript
describe('VideoInput - 異常系', () => {
  test('画像ファイルをアップロードするとエラーメッセージが表示される', async () => {
    render(<VideoInput movementType="standing" onComplete={jest.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /前額面/i }))

    const file = new File(['image content'], 'photo.jpg', { type: 'image/jpeg' })
    const input = screen.getAllByLabelText(/動画を選択/i)[0]

    fireEvent.change(input, { target: { files: [file] } })

    const { waitFor, screen: s } = await import('@testing-library/react')
    await waitFor(() => {
      expect(screen.getByText(/動画ファイルを選択してください/i)).toBeInTheDocument()
    })
  })

  test('動画未選択のまま分析ボタンを押すとエラーが表示される', () => {
    render(<VideoInput movementType="standing" onComplete={jest.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /前額面/i }))

    fireEvent.click(screen.getByRole('button', { name: /分析開始/i }))

    expect(screen.getByText(/Before・Afterの動画を選択してください/i)).toBeInTheDocument()
  })
})
```

---

### T-07：異常系 - MediaPipeが骨格を検出できない場合に警告表示

```typescript
// __tests__/lib/mediapipe.test.ts
import { analyzePose } from '@/lib/mediapipe'

describe('MediaPipe - 異常系', () => {
  test('骨格が検出できない場合はnullを返す', async () => {
    const mockResults = { poseLandmarks: null }
    const result = analyzePose(mockResults)
    expect(result).toBeNull()
  })

  test('骨格未検出時にUI上に警告が表示される', async () => {
    const { render, screen, waitFor } = await import('@testing-library/react')
    const PoseOverlay = (await import('@/components/PoseOverlay')).default

    render(<PoseOverlay landmarks={null} />)

    expect(screen.getByText(/骨格を検出できませんでした/i)).toBeInTheDocument()
  })
})
```

---

### T-08：正常系 - Before/After動画が左右に並んで表示される

```typescript
// __tests__/components/VideoPlayer.test.tsx
import { render, screen } from '@testing-library/react'
import VideoPlayer from '@/components/VideoPlayer'

describe('VideoPlayer - 正常系', () => {
  const mockBeforeUrl = 'blob:http://localhost/before'
  const mockAfterUrl = 'blob:http://localhost/after'

  test('BeforeとAfterの動画が左右に表示される', () => {
    render(
      <VideoPlayer
        beforeUrl={mockBeforeUrl}
        afterUrl={mockAfterUrl}
        plane="frontal"
      />
    )

    expect(screen.getByTestId('before-video')).toBeInTheDocument()
    expect(screen.getByTestId('after-video')).toBeInTheDocument()
    expect(screen.getByText(/Before/i)).toBeInTheDocument()
    expect(screen.getByText(/After/i)).toBeInTheDocument()
  })

  test('再生ボタンを押すと両動画が同時再生される', () => {
    render(
      <VideoPlayer
        beforeUrl={mockBeforeUrl}
        afterUrl={mockAfterUrl}
        plane="frontal"
      />
    )

    const beforeVideo = screen.getByTestId('before-video') as HTMLVideoElement
    const afterVideo = screen.getByTestId('after-video') as HTMLVideoElement

    const beforePlaySpy = jest.spyOn(beforeVideo, 'play').mockResolvedValue(undefined)
    const afterPlaySpy = jest.spyOn(afterVideo, 'play').mockResolvedValue(undefined)

    fireEvent.click(screen.getByRole('button', { name: /再生/i }))

    expect(beforePlaySpy).toHaveBeenCalled()
    expect(afterPlaySpy).toHaveBeenCalled()
  })
})
```

---

### T-09：正常系 - 関節角度グラフが表示される

```typescript
// __tests__/components/AngleGraph.test.tsx
import { render, screen } from '@testing-library/react'
import AngleGraph from '@/components/AngleGraph'

const mockFrameData = Array.from({ length: 30 }, (_, i) => ({
  frame: i,
  hip: 30 + i,
  knee: 90 - i,
  ankle: 15 + i * 0.5,
  trunk: 5 + i * 0.3,
}))

describe('AngleGraph - 正常系', () => {
  test('グラフコンポーネントが描画される', () => {
    render(
      <AngleGraph
        beforeData={mockFrameData}
        afterData={mockFrameData.map(d => ({ ...d, hip: d.hip + 10 }))}
      />
    )

    expect(screen.getByTestId('angle-graph')).toBeInTheDocument()
  })

  test('凡例にBefore/Afterが表示される', () => {
    render(
      <AngleGraph
        beforeData={mockFrameData}
        afterData={mockFrameData}
      />
    )

    expect(screen.getByText(/Before/i)).toBeInTheDocument()
    expect(screen.getByText(/After/i)).toBeInTheDocument()
  })
})
```

---

### T-10：正常系 - タブ切替で前額面⇔矢状面が切り替わる

```typescript
// __tests__/components/AnalysisView.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import AnalysisView from '@/components/AnalysisView'

describe('AnalysisView - タブ切替', () => {
  const mockProps = {
    movementType: 'standing',
    frontalBefore: 'blob:frontal-before',
    frontalAfter: 'blob:frontal-after',
    sagittalBefore: 'blob:sagittal-before',
    sagittalAfter: 'blob:sagittal-after',
  }

  test('両面選択時に前額面・矢状面タブが表示される', () => {
    render(<AnalysisView {...mockProps} />)

    expect(screen.getByRole('tab', { name: /前額面/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /矢状面/i })).toBeInTheDocument()
  })

  test('矢状面タブをクリックすると矢状面の動画が表示される', () => {
    render(<AnalysisView {...mockProps} />)

    fireEvent.click(screen.getByRole('tab', { name: /矢状面/i }))

    expect(screen.getByTestId('sagittal-player')).toBeInTheDocument()
  })
})
```

---

### T-11：正常系 - PDFが正しいファイル名でダウンロードされる

```typescript
// __tests__/lib/pdfExport.test.ts
import { generateFileName } from '@/lib/pdfExport'

describe('PDF出力 - ファイル名生成', () => {
  test('日付_動作種類_撮影面の形式でファイル名が生成される', () => {
    const mockDate = new Date('2026-03-15')
    const fileName = generateFileName({
      date: mockDate,
      movementType: 'standing',
      plane: 'sagittal',
      extension: 'pdf',
    })

    expect(fileName).toBe('20260315_standing_sagittal.pdf')
  })

  test('両面の場合はbothがファイル名に含まれる', () => {
    const mockDate = new Date('2026-03-15')
    const fileName = generateFileName({
      date: mockDate,
      movementType: 'walking',
      plane: 'both',
      extension: 'pdf',
    })

    expect(fileName).toBe('20260315_walking_both.pdf')
  })
})
```

---

### T-12：正常系 - CSVに全フレームの角度データが含まれる

```typescript
// __tests__/lib/csvExport.test.ts
import { generateCsv } from '@/lib/csvExport'

describe('CSV出力 - 正常系', () => {
  const mockData = [
    { frame: 0, hip: 30, knee: 90, ankle: 15, trunk: 5 },
    { frame: 1, hip: 35, knee: 85, ankle: 16, trunk: 6 },
  ]

  test('CSVヘッダーに関節名が含まれる', () => {
    const csv = generateCsv({ before: mockData, after: mockData })
    expect(csv).toContain('frame')
    expect(csv).toContain('hip')
    expect(csv).toContain('knee')
    expect(csv).toContain('ankle')
    expect(csv).toContain('trunk')
  })

  test('全フレームのデータがCSVに含まれる', () => {
    const csv = generateCsv({ before: mockData, after: mockData })
    const lines = csv.trim().split('\n')
    // ヘッダー行 + データ行数
    expect(lines.length).toBe(mockData.length + 1)
  })
})
```

---

### T-13：正常系 - オフライン状態でもキャッシュ済みなら動作する

```typescript
// __tests__/pwa.test.ts
describe('PWA - オフライン対応', () => {
  test('Service Workerが登録されている', async () => {
    const registration = await navigator.serviceWorker.ready
    expect(registration).toBeDefined()
    expect(registration.active).not.toBeNull()
  })

  test('manifest.jsonが存在する', async () => {
    const response = await fetch('/manifest.json')
    expect(response.ok).toBe(true)
    const manifest = await response.json()
    expect(manifest.name).toBe('RehaScope')
  })
})
```

---

### T-14・15：権限テスト - パスワード未認証では分析画面にアクセスできない

```typescript
// __tests__/auth/routeGuard.test.tsx
import { render, screen } from '@testing-library/react'
import { useRouter } from 'next/navigation'
import AnalysisPage from '@/app/analysis/page'

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}))

describe('権限テスト', () => {
  beforeEach(() => {
    sessionStorage.clear()
    ;(useRouter as jest.Mock).mockReturnValue({ push: jest.fn() })
  })

  test('未認証状態では分析ページにアクセスできずリダイレクトされる', () => {
    const mockPush = jest.fn()
    ;(useRouter as jest.Mock).mockReturnValue({ push: mockPush })

    render(<AnalysisPage />)

    expect(mockPush).toHaveBeenCalledWith('/')
  })

  test('認証済みセッションでは分析画面が表示される', () => {
    sessionStorage.setItem('reha_auth', 'true')

    render(<AnalysisPage />)

    expect(screen.getByTestId('analysis-view')).toBeInTheDocument()
  })
})
```

---

## 3. テスト実行コマンド

```bash
# 全テスト実行
npm run test

# ウォッチモード
npm run test:watch

# カバレッジレポート
npm run test:coverage
```

## 4. package.json テスト設定

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  },
  "devDependencies": {
    "jest": "^29.0.0",
    "@testing-library/react": "^14.0.0",
    "@testing-library/jest-dom": "^6.0.0",
    "@testing-library/user-event": "^14.0.0",
    "ts-jest": "^29.0.0",
    "jest-environment-jsdom": "^29.0.0"
  }
}
```
