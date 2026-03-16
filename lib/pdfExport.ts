import type { FrameData } from '@/context/SessionContext'

interface FileNameOptions {
  date: Date
  movementType: string
  plane: string
  extension: 'pdf' | 'csv'
}

const MOVEMENT_EN: Record<string, string> = {
  standing: 'standing',
  walking:  'walking',
  balance:  'balance',
}

export function generateFileName({ date, movementType, plane, extension }: FileNameOptions): string {
  const y  = date.getFullYear()
  const m  = String(date.getMonth() + 1).padStart(2, '0')
  const d  = String(date.getDate()).padStart(2, '0')
  const mt = MOVEMENT_EN[movementType] ?? movementType
  return `${y}${m}${d}_${mt}_${plane}.${extension}`
}

const MOVEMENT_JA: Record<string, string> = {
  standing: '立ち上がり',
  walking:  '歩行',
  balance:  'バランス・静止立位',
}

const PLANE_JA: Record<string, string> = {
  frontal:  '前額面（正面）',
  sagittal: '矢状面（側面）',
  both:     '両方',
}

const SAGITTAL_JOINTS = [
  { key: 'hip',   label: '股関節屈曲角' },
  { key: 'knee',  label: '膝関節屈曲角' },
  { key: 'ankle', label: '足関節背屈角' },
  { key: 'trunk', label: '体幹傾斜角' },
] as const

const FRONTAL_JOINTS = [
  { key: 'hip',   label: '骨盤側方傾斜角' },
  { key: 'knee',  label: '膝外反/内反角' },
  { key: 'ankle', label: '肩傾斜角' },
  { key: 'trunk', label: '体幹側屈角' },
] as const

function calcAvg(data: FrameData[], key: keyof FrameData): number {
  if (data.length === 0) return 0
  return data.reduce((s, d) => s + (d[key] as number), 0) / data.length
}

function calcPeak(data: FrameData[], key: keyof FrameData): number {
  if (data.length === 0) return 0
  return Math.max(...data.map(d => d[key] as number))
}

export interface PdfReportOptions {
  beforeData:      FrameData[]
  afterData:       FrameData[]
  beforeValidity?: boolean[]
  afterValidity?:  boolean[]
  plane:           'frontal' | 'sagittal'
  movementType:    string
  fileName:        string
}

export async function generatePdf(options: PdfReportOptions): Promise<void> {
  const { beforeData, afterData, beforeValidity, afterValidity, plane, movementType, fileName } = options

  // 有効フレームのみ使用
  const validBefore = beforeData.filter((_, i) => !beforeValidity || beforeValidity[i] !== false)
  const validAfter  = afterData.filter((_, i)  => !afterValidity  || afterValidity[i]  !== false)

  const hasAfter = validAfter.length > 0
  const joints   = plane === 'sagittal' ? SAGITTAL_JOINTS : FRONTAL_JOINTS

  const now     = new Date()
  const dateStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`

  // 重心偏位（有効フレームのみ）
  const bGrav   = validBefore.map(d => plane === 'sagittal' ? 1 - d.gravityY : d.gravityX - 0.5)
  const aGrav   = hasAfter ? validAfter.map(d => plane === 'sagittal' ? 1 - d.gravityY : d.gravityX - 0.5) : []
  const bRange  = bGrav.length > 0 ? Math.max(...bGrav) - Math.min(...bGrav) : 0
  const aRange  = aGrav.length > 0 ? Math.max(...aGrav) - Math.min(...aGrav) : 0
  const cogLabel = plane === 'sagittal' ? '重心上下変位量' : '重心左右変位量'

  // テーブル行 HTML（有効フレームのみ）
  const tableRows = joints.map(j => {
    const bA    = calcAvg(validBefore,  j.key as keyof FrameData)
    const aA    = hasAfter ? calcAvg(validAfter, j.key as keyof FrameData) : null
    const bPeak = calcPeak(validBefore, j.key as keyof FrameData)
    const delta = aA !== null ? aA - bA : null

    const deltaColor = delta === null ? '' : delta < 0 ? '#16a34a' : delta > 0 ? '#dc2626' : '#6b7280'
    const deltaCell  = delta !== null
      ? `<td style="color:${deltaColor};font-weight:700">${delta > 0 ? '+' : ''}${delta.toFixed(1)}°</td>`
      : ''

    return `
      <tr>
        <td>${j.label}</td>
        <td style="color:#3b82f6;font-weight:600">${bA.toFixed(1)}°</td>
        ${aA !== null ? `<td style="color:#f97316;font-weight:600">${aA.toFixed(1)}°</td>` : ''}
        <td>${bPeak.toFixed(1)}°</td>
        ${deltaCell}
      </tr>`
  }).join('')

  const tableHeader = `
    <tr style="background:#1e3a5f;color:#fff">
      <th style="text-align:left">指標</th>
      <th>Before 平均</th>
      ${hasAfter ? '<th>After 平均</th>' : ''}
      <th>最大値</th>
      ${hasAfter ? '<th>変化量</th>' : ''}
    </tr>`

  // 重心カード HTML
  const gravCards = [
    { label: 'Before 変位量', value: bRange.toFixed(3), color: '#3b82f6' },
    ...(hasAfter ? [{ label: 'After 変位量', value: aRange.toFixed(3), color: '#f97316' }] : []),
    ...(hasAfter ? [{
      label:  '変化量（After − Before）',
      value:  `${(aRange - bRange) >= 0 ? '+' : ''}${(aRange - bRange).toFixed(3)}`,
      color:  (aRange - bRange) < 0 ? '#16a34a' : '#dc2626',
    }] : []),
  ].map(c => `
    <div class="cog-card">
      <div class="cog-label">${c.label}</div>
      <div class="cog-value" style="color:${c.color}">${c.value}</div>
    </div>`).join('')

  const html = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <title>${fileName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Noto Sans JP', 'Hiragino Sans', 'Yu Gothic', 'Meiryo', sans-serif;
      font-size: 11px;
      color: #1e3a5f;
      background: #fff;
      padding: 0;
    }

    /* ── ヘッダー ── */
    .header {
      background: #1e3a5f;
      color: #fff;
      padding: 14px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .header-logo { font-size: 18px; font-weight: 700; letter-spacing: -0.5px; }
    .header-sub  { font-size: 10px; color: #93c5fd; margin-top: 2px; }
    .header-right { text-align: right; font-size: 10px; color: #bfdbfe; line-height: 1.6; }

    /* ── 本文 ── */
    .body { padding: 20px 24px; }

    /* ── セクションタイトル ── */
    .section-title {
      font-size: 12px;
      font-weight: 700;
      color: #1e3a5f;
      margin: 18px 0 8px;
      padding-bottom: 4px;
      border-bottom: 2px solid #1e3a5f;
    }

    /* ── サマリーカード ── */
    .summary-cards {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      margin-bottom: 4px;
    }
    .summary-card {
      background: #f1f5f9;
      border-radius: 8px;
      padding: 10px 8px;
      text-align: center;
    }
    .summary-card-label { font-size: 9px; color: #64748b; margin-bottom: 4px; }
    .summary-card-before { font-size: 20px; font-weight: 700; color: #3b82f6; line-height: 1; }
    .summary-card-after  { font-size: 11px; color: #f97316; margin-top: 2px; }

    /* ── テーブル ── */
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10.5px;
    }
    th, td {
      padding: 6px 10px;
      text-align: center;
      border-bottom: 1px solid #e2e8f0;
    }
    th { font-size: 10px; padding: 7px 10px; }
    td:first-child, th:first-child { text-align: left; }
    tr:nth-child(even) td { background: #f8fafc; }

    /* ── 重心カード ── */
    .cog-cards {
      display: flex;
      gap: 10px;
    }
    .cog-card {
      flex: 1;
      background: #f1f5f9;
      border-radius: 8px;
      padding: 10px;
      text-align: center;
    }
    .cog-label { font-size: 9px; color: #64748b; margin-bottom: 4px; }
    .cog-value { font-size: 18px; font-weight: 700; }

    /* ── フッター ── */
    .footer {
      margin-top: 24px;
      padding: 10px 24px;
      background: #1e3a5f;
      color: #93c5fd;
      font-size: 9px;
      display: flex;
      justify-content: space-between;
    }

    @media print {
      @page { size: A4 portrait; margin: 0; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="header-logo">RehaScope</div>
      <div class="header-sub">動作解析レポート</div>
    </div>
    <div class="header-right">
      <div>${dateStr}</div>
      <div>${MOVEMENT_JA[movementType] ?? movementType}　/　${PLANE_JA[plane] ?? plane}</div>
    </div>
  </div>

  <div class="body">

    <!-- サマリーカード -->
    <div class="section-title">関節角度　サマリー（Before 平均）</div>
    <div class="summary-cards">
      ${joints.map(j => {
        const bA = calcAvg(validBefore, j.key as keyof FrameData)
        const aA = hasAfter ? calcAvg(validAfter, j.key as keyof FrameData) : null
        return `
          <div class="summary-card">
            <div class="summary-card-label">${j.label}</div>
            <div class="summary-card-before">${Math.round(bA)}°</div>
            ${aA !== null ? `<div class="summary-card-after">→ After ${Math.round(aA)}°</div>` : ''}
          </div>`
      }).join('')}
    </div>

    <!-- 関節角度テーブル -->
    <div class="section-title">関節角度　詳細（平均値・最大値・変化量）</div>
    <table>
      <thead>${tableHeader}</thead>
      <tbody>${tableRows}</tbody>
    </table>

    <!-- 重心偏位 -->
    <div class="section-title">${cogLabel}</div>
    <div class="cog-cards">${gravCards}</div>

  </div>

  <div class="footer">
    <span>© 2024 RehaScope</span>
    <span>${fileName}</span>
  </div>

  <script>
    window.onload = function() {
      window.print();
      window.onafterprint = function() { window.close(); };
    };
  </script>
</body>
</html>`

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url  = URL.createObjectURL(blob)
  const win  = window.open(url, '_blank')
  if (!win) {
    // ポップアップブロックされた場合はリンクダウンロード
    const a = document.createElement('a')
    a.href = url
    a.download = fileName.replace('.pdf', '.html')
    a.click()
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
