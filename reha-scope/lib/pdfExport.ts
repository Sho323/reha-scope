import type { FrameData } from '@/context/SessionContext'

interface FileNameOptions {
  date: Date
  movementType: string
  plane: string
  extension: 'pdf' | 'csv'
}

const MOVEMENT_EN: Record<string, string> = {
  standing: 'standing',
  walking: 'walking',
  balance: 'balance',
  both: 'both',
  frontal: 'frontal',
  sagittal: 'sagittal',
}

export function generateFileName({ date, movementType, plane, extension }: FileNameOptions): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const dateStr = `${y}${m}${d}`
  const mt = MOVEMENT_EN[movementType] ?? movementType
  const pl = MOVEMENT_EN[plane] ?? plane
  return `${dateStr}_${mt}_${pl}.${extension}`
}

export async function generatePdf(elementId: string, fileName: string): Promise<void> {
  const element = document.getElementById(elementId)
  if (!element) return

  try {
    const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
      import('html2canvas'),
      import('jspdf'),
    ])

    const canvas = await html2canvas(element, {
      scale: 1.5,
      useCORS: true,
      backgroundColor: '#f8fafc',
    })

    const imgData = canvas.toDataURL('image/png')
    const pdf = new jsPDF({
      orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
      unit: 'px',
      format: [canvas.width, canvas.height],
    })

    pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height)
    pdf.save(fileName)
  } catch (e) {
    console.error('PDF generation failed:', e)
  }
}

export function generateSummaryPdf(
  beforeData: FrameData[],
  afterData: FrameData[],
  movementType: string,
  plane: string
): void {
  const calcAvg = (data: FrameData[], key: keyof FrameData) => {
    if (data.length === 0) return 0
    const sum = data.reduce((acc, d) => acc + (d[key] as number), 0)
    return Math.round(sum / data.length)
  }

  const summary = {
    hip: { before: calcAvg(beforeData, 'hip'), after: calcAvg(afterData, 'hip') },
    knee: { before: calcAvg(beforeData, 'knee'), after: calcAvg(afterData, 'knee') },
    ankle: { before: calcAvg(beforeData, 'ankle'), after: calcAvg(afterData, 'ankle') },
    trunk: { before: calcAvg(beforeData, 'trunk'), after: calcAvg(afterData, 'trunk') },
  }

  console.table(summary)
}
