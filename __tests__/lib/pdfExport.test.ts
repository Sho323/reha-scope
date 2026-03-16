import { generateFileName } from '@/lib/pdfExport'

describe('generateFileName', () => {
  test('日付_動作種類_撮影面の形式でファイル名が生成される', () => {
    const date = new Date('2026-03-15')
    const fileName = generateFileName({
      date,
      movementType: 'standing',
      plane: 'sagittal',
      extension: 'pdf',
    })
    expect(fileName).toBe('20260315_standing_sagittal.pdf')
  })

  test('bothの場合はbothがファイル名に含まれる', () => {
    const date = new Date('2026-03-15')
    const fileName = generateFileName({
      date,
      movementType: 'walking',
      plane: 'both',
      extension: 'pdf',
    })
    expect(fileName).toBe('20260315_walking_both.pdf')
  })

  test('CSV拡張子でも正しく生成される', () => {
    const date = new Date('2026-03-15')
    const fileName = generateFileName({
      date,
      movementType: 'balance',
      plane: 'frontal',
      extension: 'csv',
    })
    expect(fileName).toBe('20260315_balance_frontal.csv')
  })
})
