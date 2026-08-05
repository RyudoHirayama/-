import { useState } from 'react'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '../firebase'

const REACTION_EMOJIS = ['👍', '✅', '🎉', '💪']

function formatTime(ts) {
  if (!ts?.toDate) return ''
  const d = ts.toDate()
  return d.toLocaleString('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function initials(name) {
  return (name || '?').trim().charAt(0).toUpperCase()
}

export default function MessageItem({ message, mine, channelId, currentUid }) {
  const [zoom, setZoom] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const reactions = message.reactions || {}

  const toggleReaction = async (emoji) => {
    const current = reactions[emoji] || []
    const has = current.includes(currentUid)
    const next = has
      ? current.filter((u) => u !== currentUid)
      : [...current, currentUid]
    const updated = { ...reactions }
    if (next.length === 0) delete updated[emoji]
    else updated[emoji] = next
    setPickerOpen(false)
    try {
      await updateDoc(doc(db, 'channels', channelId, 'messages', message.id), {
        reactions: updated,
      })
    } catch (err) {
      console.error('リアクションの更新に失敗しました', err)
    }
  }

  const activeReactions = Object.entries(reactions).filter(([, uids]) => uids?.length)

  return (
    <div className={`msg ${mine ? 'mine' : ''}`}>
      {!mine && <div className="avatar">{initials(message.author)}</div>}
      <div className="msg-body">
        <div className="bubble">
          {!mine && <div className="author">{message.author}</div>}
          {message.imageUrl && (
            <img
              className="msg-image"
              src={message.imageUrl}
              alt="添付画像"
              loading="lazy"
              onClick={() => setZoom(true)}
            />
          )}
          {message.text && <div className="msg-text">{message.text}</div>}
          <div className="time">{formatTime(message.createdAt)}</div>
        </div>

        <div className="reaction-row">
          {activeReactions.map(([emoji, uids]) => (
            <button
              key={emoji}
              className={`reaction-pill ${uids.includes(currentUid) ? 'reacted' : ''}`}
              onClick={() => toggleReaction(emoji)}
            >
              {emoji} {uids.length}
            </button>
          ))}
          <div className="reaction-add-wrap">
            <button
              className="reaction-add"
              title="リアクション"
              onClick={() => setPickerOpen((v) => !v)}
            >
              ＋
            </button>
            {pickerOpen && (
              <div className="reaction-picker">
                {REACTION_EMOJIS.map((emoji) => (
                  <button key={emoji} onClick={() => toggleReaction(emoji)}>
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {zoom && message.imageUrl && (
        <div className="lightbox" onClick={() => setZoom(false)}>
          <img src={message.imageUrl} alt="添付画像（拡大）" />
        </div>
      )}
    </div>
  )
}
