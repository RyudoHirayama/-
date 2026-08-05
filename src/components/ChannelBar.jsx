import { useState } from 'react'

export default function ChannelBar({ channels, activeId, onSelect, onCreate }) {
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed || busy) return
    setBusy(true)
    try {
      await onCreate(trimmed)
      setName('')
      setCreating(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="channel-bar">
      <div className="channel-list">
        {channels.map((c) => (
          <button
            key={c.id}
            className={`channel-chip ${c.id === activeId ? 'active' : ''}`}
            onClick={() => onSelect(c.id)}
          >
            # {c.name}
          </button>
        ))}
      </div>

      {creating ? (
        <form className="channel-create" onSubmit={submit}>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="チャンネル名（例：関東エリア）"
            maxLength={30}
            autoFocus
          />
          <button type="submit" className="btn-primary channel-create-btn" disabled={busy}>
            作成
          </button>
          <button
            type="button"
            className="btn-link"
            onClick={() => {
              setCreating(false)
              setName('')
            }}
          >
            取消
          </button>
        </form>
      ) : (
        <button className="channel-add" title="チャンネルを追加" onClick={() => setCreating(true)}>
          ＋
        </button>
      )}
    </div>
  )
}
