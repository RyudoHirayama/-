import { useEffect, useMemo, useRef, useState } from 'react'
import {
  addDoc,
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore'
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { useAuth } from '../contexts/AuthContext.jsx'
import { db, storage } from '../firebase'
import { REPORT_TEMPLATES } from '../templates'
import MessageItem from './MessageItem.jsx'
import ChannelBar from './ChannelBar.jsx'

const MAX_IMAGE_BYTES = 10 * 1024 * 1024 // 10MB
const DEFAULT_CHANNEL_ID = 'general'

export default function Chat() {
  const { user, logout } = useAuth()
  const [channels, setChannels] = useState([])
  const [activeChannel, setActiveChannel] = useState(DEFAULT_CHANNEL_ID)
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [showTemplates, setShowTemplates] = useState(false)
  const bottomRef = useRef(null)
  const fileInputRef = useRef(null)
  const textRef = useRef(null)

  // チャンネル一覧を購読。無ければデフォルト「全体」を作成。
  useEffect(() => {
    const q = query(collection(db, 'channels'), orderBy('createdAt', 'asc'))
    const unsub = onSnapshot(q, async (snap) => {
      if (snap.empty) {
        await setDoc(doc(db, 'channels', DEFAULT_CHANNEL_ID), {
          name: '全体',
          createdBy: user.uid,
          createdAt: serverTimestamp(),
        })
        return
      }
      setChannels(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    })
    return unsub
  }, [user.uid])

  // アクティブチャンネルが一覧から消えたら先頭にフォールバック
  useEffect(() => {
    if (channels.length && !channels.some((c) => c.id === activeChannel)) {
      setActiveChannel(channels[0].id)
    }
  }, [channels, activeChannel])

  // アクティブチャンネルのメッセージを購読
  useEffect(() => {
    setMessages([])
    const q = query(
      collection(db, 'channels', activeChannel, 'messages'),
      orderBy('createdAt', 'asc'),
      limit(200),
    )
    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    })
    return unsub
  }, [activeChannel])

  // 新着で最下部へスクロール
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const activeChannelName = useMemo(
    () => channels.find((c) => c.id === activeChannel)?.name || '',
    [channels, activeChannel],
  )

  const createChannel = async (name) => {
    const docRef = await addDoc(collection(db, 'channels'), {
      name,
      createdBy: user.uid,
      createdAt: serverTimestamp(),
    })
    setActiveChannel(docRef.id)
  }

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

  const insertTemplate = (tpl) => {
    setText((prev) => (prev.trim() ? prev + '\n\n' + tpl.body : tpl.body))
    setShowTemplates(false)
    // 挿入後にフォーカス
    requestAnimationFrame(() => textRef.current?.focus())
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

      await addDoc(collection(db, 'channels', activeChannel, 'messages'), {
        text: text.trim(),
        imageUrl,
        imagePath,
        uid: user.uid,
        author: user.displayName || user.email || '名無し',
        reactions: {},
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

      <ChannelBar
        channels={channels}
        activeId={activeChannel}
        onSelect={setActiveChannel}
        onCreate={createChannel}
      />

      <main className="chat-feed">
        {messages.length === 0 && (
          <div className="empty">
            {activeChannelName
              ? `「${activeChannelName}」にはまだ報告がありません。最初の報告を投稿しましょう。`
              : 'まだ報告がありません。'}
          </div>
        )}
        {messages.map((m) => (
          <MessageItem
            key={m.id}
            message={m}
            mine={m.uid === user.uid}
            channelId={activeChannel}
            currentUid={user.uid}
          />
        ))}
        <div ref={bottomRef} />
      </main>

      <form className="composer" onSubmit={handleSend}>
        {error && <div className="error composer-error">{error}</div>}

        {showTemplates && (
          <div className="template-tray">
            {REPORT_TEMPLATES.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                className="template-chip"
                onClick={() => insertTemplate(tpl)}
              >
                <span>{tpl.emoji}</span> {tpl.label}
              </button>
            ))}
          </div>
        )}

        {preview && (
          <div className="attachment-preview">
            <img src={preview} alt="添付プレビュー" />
            <button type="button" className="remove-attach" onClick={clearAttachment}>
              ×
            </button>
          </div>
        )}

        <div className="composer-row">
          <button
            type="button"
            className={`icon-btn ${showTemplates ? 'active' : ''}`}
            title="報告テンプレート"
            onClick={() => setShowTemplates((v) => !v)}
          >
            📋
          </button>
          <label className="icon-btn" title="写真を添付">
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
            ref={textRef}
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
