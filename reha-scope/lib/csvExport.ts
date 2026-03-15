import type { FrameData } from '@/context/SessionContext'

interface CsvOptions {
  before: FrameData[]
  after: FrameData[]
}

export function generateCsv({ before, after }: CsvOptions): string {
  const headers = [
    'frame',
    'before_hip', 'before_knee', 'before_ankle', 'before_trunk',
    'before_gravity_x', 'before_gravity_y',
    'after_hip', 'after_knee', 'after_ankle', 'after_trunk',
    'after_gravity_x', 'after_gravity_y',
    'delta_hip', 'delta_knee', 'delta_ankle', 'delta_trunk',
  ]

  const maxLen = Math.max(before.length, after.length)
  const rows: string[][] = []

  for (let i = 0; i < maxLen; i++) {
    const b = before[i]
    const a = after[i]
    rows.push([
      String(i),
      b ? String(b.hip) : '',
      b ? String(b.knee) : '',
      b ? String(b.ankle) : '',
      b ? String(b.trunk) : '',
      b ? String(b.gravityX) : '',
      b ? String(b.gravityY) : '',
      a ? String(a.hip) : '',
      a ? String(a.knee) : '',
      a ? String(a.ankle) : '',
      a ? String(a.trunk) : '',
      a ? String(a.gravityX) : '',
      a ? String(a.gravityY) : '',
      b && a ? String(a.hip - b.hip) : '',
      b && a ? String(a.knee - b.knee) : '',
      b && a ? String(a.ankle - b.ankle) : '',
      b && a ? String(a.trunk - b.trunk) : '',
    ])
  }

  const csvLines = [headers.join(','), ...rows.map(r => r.join(','))]
  return csvLines.join('\n')
}

export function downloadCsv(fileName: string, data: string): void {
  const bom = '\uFEFF' // BOM for Excel compatibility
  const blob = new Blob([bom + data], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
