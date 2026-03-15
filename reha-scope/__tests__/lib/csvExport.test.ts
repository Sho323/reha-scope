import { generateCsv, downloadCsv } from '@/lib/csvExport'
import type { FrameData } from '@/context/SessionContext'

const mockData: FrameData[] = [
  { frame: 0, hip: 30, knee: 90, ankle: 15, trunk: 5, gravityX: 0.5, gravityY: 0.5 },
  { frame: 1, hip: 35, knee: 85, ankle: 16, trunk: 6, gravityX: 0.51, gravityY: 0.49 },
]

describe('generateCsv', () => {
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
    // ヘッダー行 + データ行
    expect(lines.length).toBe(mockData.length + 1)
  })

  test('delta列が正しく計算される', () => {
    const before: FrameData[] = [
      { frame: 0, hip: 30, knee: 90, ankle: 15, trunk: 5, gravityX: 0.5, gravityY: 0.5 },
    ]
    const after: FrameData[] = [
      { frame: 0, hip: 40, knee: 80, ankle: 20, trunk: 10, gravityX: 0.5, gravityY: 0.5 },
    ]
    const csv = generateCsv({ before, after })
    expect(csv).toContain('10') // delta_hip = 40 - 30 = 10
  })
})

describe('downloadCsv', () => {
  test('aタグのクリックが呼ばれる', () => {
    const mockClick = jest.fn()
    const mockAppend = jest.fn()
    const mockRemove = jest.fn()
    const mockCreateObjectURL = jest.fn().mockReturnValue('blob:mock')
    const mockRevokeObjectURL = jest.fn()

    const originalCreateElement = document.createElement.bind(document)
    jest.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') {
        return { href: '', download: '', click: mockClick, style: {} } as unknown as HTMLAnchorElement
      }
      return originalCreateElement(tag)
    })
    jest.spyOn(document.body, 'appendChild').mockImplementation(mockAppend)
    jest.spyOn(document.body, 'removeChild').mockImplementation(mockRemove)
    global.URL.createObjectURL = mockCreateObjectURL
    global.URL.revokeObjectURL = mockRevokeObjectURL

    downloadCsv('test.csv', 'a,b\n1,2')

    expect(mockClick).toHaveBeenCalled()

    jest.restoreAllMocks()
  })
})
