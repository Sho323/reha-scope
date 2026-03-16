import '@testing-library/jest-dom'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import PasswordGate from '@/components/PasswordGate'

// next/navigation は jest.setup.ts でモック済み

describe('PasswordGate - 正常系', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_APP_PASSWORD = 'testpass123'
    sessionStorage.clear()
    document.cookie = 'reha_auth=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
  })

  test('正しいパスワードを入力するとrouterのpushが呼ばれる', async () => {
    const { useRouter } = await import('next/navigation')
    const mockPush = jest.fn()
    ;(useRouter as jest.Mock).mockReturnValue({ push: mockPush })

    render(<PasswordGate />)

    fireEvent.change(screen.getByPlaceholderText(/パスワードを入力/i), {
      target: { value: 'testpass123' },
    })
    fireEvent.click(screen.getByRole('button', { name: /入室する/i }))

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/home')
    })
  })

  test('認証成功後はsessionStorageにフラグが保存される', async () => {
    render(<PasswordGate />)

    fireEvent.change(screen.getByPlaceholderText(/パスワードを入力/i), {
      target: { value: 'testpass123' },
    })
    fireEvent.click(screen.getByRole('button', { name: /入室する/i }))

    await waitFor(() => {
      expect(sessionStorage.getItem('reha_auth')).toBe('true')
    })
  })
})

describe('PasswordGate - 異常系', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_APP_PASSWORD = 'testpass123'
    sessionStorage.clear()
  })

  test('間違ったパスワードではエラーメッセージが表示される', async () => {
    render(<PasswordGate />)

    fireEvent.change(screen.getByPlaceholderText(/パスワードを入力/i), {
      target: { value: 'wrongpassword' },
    })
    fireEvent.click(screen.getByRole('button', { name: /入室する/i }))

    await waitFor(() => {
      expect(screen.getByText(/パスワードが違います/i)).toBeInTheDocument()
    })
  })

  test('空のパスワードで送信するとバリデーションエラーが表示される', async () => {
    render(<PasswordGate />)

    fireEvent.click(screen.getByRole('button', { name: /入室する/i }))

    await waitFor(() => {
      expect(screen.getByText(/パスワードを入力してください/i)).toBeInTheDocument()
    })
  })
})

describe('PasswordGate - 権限テスト', () => {
  test('認証前はパスワード画面が表示される', () => {
    render(<PasswordGate />)
    expect(screen.getByText('RehaScope')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /入室する/i })).toBeInTheDocument()
  })
})
