import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext.jsx'

export default function Login() {
  const { login, signup } = useAuth()
  const [mode, setMode] = useState('login') // 'login' | 'signup'
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      if (mode === 'signup') {
        if (!displayName.trim()) throw new Error('名前を入力してください')
        await signup(email.trim(), password, displayName.trim())
      } else {
        await login(email.trim(), password)
      }
    } catch (err) {
      setError(translateError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="centered">
      <form className="card login" onSubmit={handleSubmit}>
        <div className="login-brand">
          <img src="/icons/icon.svg" alt="" width="48" height="48" />
          <h1>営業報告チャット</h1>
        </div>
        <p className="login-sub">
          {mode === 'login' ? 'ログインして報告を共有しましょう' : 'アカウントを作成します'}
        </p>

        {mode === 'signup' && (
          <label>
            名前（表示名）
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="山田 太郎"
              autoComplete="name"
            />
          </label>
        )}

        <label>
          メールアドレス
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            required
          />
        </label>

        <label>
          パスワード
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="6文字以上"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            required
          />
        </label>

        {error && <div className="error">{error}</div>}

        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? '処理中…' : mode === 'login' ? 'ログイン' : 'アカウント作成'}
        </button>

        <button
          type="button"
          className="btn-link"
          onClick={() => {
            setMode(mode === 'login' ? 'signup' : 'login')
            setError('')
          }}
        >
          {mode === 'login'
            ? 'アカウントをお持ちでない方はこちら'
            : 'すでにアカウントをお持ちの方はこちら'}
        </button>
      </form>
    </div>
  )
}

function translateError(err) {
  const code = err?.code || ''
  const map = {
    'auth/invalid-email': 'メールアドレスの形式が正しくありません',
    'auth/user-not-found': 'ユーザーが見つかりません',
    'auth/wrong-password': 'パスワードが間違っています',
    'auth/invalid-credential': 'メールアドレスまたはパスワードが正しくありません',
    'auth/email-already-in-use': 'このメールアドレスは既に使われています',
    'auth/weak-password': 'パスワードは6文字以上にしてください',
    'auth/too-many-requests': '試行回数が多すぎます。しばらくしてからお試しください',
  }
  return map[code] || err?.message || 'エラーが発生しました'
}
