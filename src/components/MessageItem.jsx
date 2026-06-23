import { useState } from 'react'

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

export default function MessageItem({ message, mine }) {
  const [zoom, setZoom] = useState(false)

  return (
    <div className={`msg ${mine ? 'mine' : ''}`}>
      {!mine && <div className="avatar">{initials(message.author)}</div>}
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

      {zoom && message.imageUrl && (
        <div className="lightbox" onClick={() => setZoom(false)}>
          <img src={message.imageUrl} alt="添付画像（拡大）" />
        </div>
      )}
    </div>
  )
}
