import { useAuth } from './contexts/AuthContext.jsx'
import Login from './components/Login.jsx'
import Chat from './components/Chat.jsx'
import { isFirebaseConfigured } from './firebase'

export default function App() {
  const { user, loading } = useAuth()

  if (!isFirebaseConfigured) {
    return (
      <div className="centered">
        <div className="card notice">
          <h2>Firebase の設定が必要です</h2>
          <p>
            <code>.env.example</code> を <code>.env.local</code> にコピーし、
            Firebase コンソールから取得した値を入力してから再起動してください。
          </p>
          <p>詳しくは <code>README.md</code> のセットアップ手順を参照してください。</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="centered">
        <div className="spinner" aria-label="読み込み中" />
      </div>
    )
  }

  return user ? <Chat /> : <Login />
}
