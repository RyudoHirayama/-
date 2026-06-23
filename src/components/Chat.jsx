import { useEffect, useRef, useState } from 'react'
import {
  addDoc,
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from 'firebase/firestore'
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { useAuth } from '../contexts/AuthContext.jsx'
import { db, storage } from '../firebase'
import MessageItem from './MessageItem.jsx'

const MAX_IMAGE_BYTES = 10 * 1024 * 1024 // 10MB

export default function Chat() {
  const { user, logout } = useAuth()
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef(null)
  const fileInputRef = useRef(null)

  // リアルタイム購読
  useEffect(() => {
    const q = query(
      collection(db, 'messages'),
      orderBy('createdAt', 'asc'),
      limit(200),
    )
    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    })
    return unsub
  }, [])

  // 新着で最下部へスクロール
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleFileChange = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (!f.type.startsWith('image/')) {
      setError('画像ファイルを選択してください')
      return
    }
    if (f.size > MAX_IMAGE_BYTES) {
      setError('画像サイズは10MBまでです')
      return
    }
    setError('')
    setFile(f)
    setPreview(URL.createObjectURL(f))
  }

  const clearAttachment = () => {
    setFile(null)
    if (preview) URL.revokeObjectURL(preview)
    setPreview('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSend = async (e) => {
    e.preventDefault()
    if ((!text.trim() && !file) || sending) return
    setSending(true)
    setError('')
    try {
      let imageUrl = ''
      let imagePath = ''
      if (file) {
        const safeName = file.name.replace(/[^\w.\-]/g, '_')
        imagePath = `messages/${user.uid}/${Date.now()}_${safeName}`
        const storageRef = ref(storage, imagePath)
        await uploadBytes(storageRef, file)
        imageUrl = await getDownloadURL(storageRef)
      }

      await addDoc(collection(db, 'messages'), {
        text: text.trim(),
        imageUrl,
        imagePath,
        uid: user.uid,
        author: user.displayName || user.email || '名無し',
        createdAt: serverTimestamp(),
      })

      setText('')
      clearAttachment()
    } catch (err) {
      console.error(err)
      setError('送信に失敗しました: ' + (err?.message || ''))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="chat-layout">
      <header className="chat-header">
        <div className="chat-title">
          <img src="/icons/icon.svg" alt="" width="28" height="28" />
          <span>営業報告チャット</span>
        </div>
        <div className="chat-user">
          <span className="who">{user.displayName || user.email}</span>
          <button className="btn-link" onClick={logout}>
            ログアウト
          </button>
        </div>
      </header>

      <main className="chat-feed">
        {messages.length === 0 && (
          <div className="empty">まだ報告がありません。最初の報告を投稿しましょう。</div>
        )}
        {messages.map((m) => (
          <MessageItem key={m.id} message={m} mine={m.uid === user.uid} />
        ))}
        <div ref={bottomRef} />
      </main>

      <form className="composer" onSubmit={handleSend}>
        {error && <div className="error composer-error">{error}</div>}
        {preview && (
          <div className="attachment-preview">
            <img src={preview} alt="添付プレビュー" />
            <button type="button" className="remove-attach" onClick={clearAttachment}>
              ×
            </button>
          </div>
        )}
        <div className="composer-row">
          <label className="attach-btn" title="写真を添付">
            📷
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              hidden
            />
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="報告内容を入力…"
            rows={1}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSend(e)
            }}
          />
          <button type="submit" className="btn-primary send-btn" disabled={sending}>
            {sending ? '送信中…' : '送信'}
          </button>
        </div>
      </form>
    </div>
  )
}
