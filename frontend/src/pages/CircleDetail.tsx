import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import { io, Socket } from 'socket.io-client'
import L from 'leaflet'
import api from '../lib/api'
import { useAuth } from '../context/AuthContext'

delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

interface Circle { id: string; name: string; inviteCode: string; ownerId: string; members: { userId: string; displayName: string; joinedAt: string }[] }
interface Message { id: string; userId: string; userName: string; content: string; createdAt: string }
interface LocationShare { id: string; userId: string; userName: string; lat: number; lng: number; expiresAt: string }

export default function CircleDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const [circle, setCircle] = useState<Circle | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [locations, setLocations] = useState<LocationShare[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sharing, setSharing] = useState(false)
  const [myShare, setMyShare] = useState<LocationShare | null>(null)
  const [shareDuration, setShareDuration] = useState(30)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    fetchCircle(); fetchMessages(); fetchLocations()
    socketRef.current = io('http://localhost:3001')
    socketRef.current.emit('join-circle', id)
    socketRef.current.on('new-message', (msg: Message) => setMessages(prev => [...prev, msg]))
    socketRef.current.on('location-shared', (loc: LocationShare) => {
      setLocations(prev => [...prev.filter(l => l.userId !== loc.userId), loc])
    })
    socketRef.current.on('location-stopped', ({ userId }: { userId: string }) => {
      setLocations(prev => prev.filter(l => l.userId !== userId))
    })
    return () => { socketRef.current?.emit('leave-circle', id); socketRef.current?.disconnect() }
  }, [id])

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])
  useEffect(() => { setMyShare(locations.find(l => l.userId === user?.id) || null) }, [locations, user])

  const fetchCircle = async () => {
    try { const res = await api.get(`/circles/${id}`); setCircle(res.data) }
    catch { setError('Failed to load circle') }
    finally { setLoading(false) }
  }
  const fetchMessages = async () => { try { const res = await api.get(`/circles/${id}/messages`); setMessages(res.data) } catch {} }
  const fetchLocations = async () => { try { const res = await api.get(`/circles/${id}/locations`); setLocations(res.data) } catch {} }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim()) return
    try { await api.post(`/circles/${id}/messages`, { content: newMessage }); setNewMessage('') } catch {}
  }

  const handleShareLocation = async () => {
    if (!navigator.geolocation) { alert('Geolocation not supported'); return }
    setSharing(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try { await api.post(`/circles/${id}/location`, { lat: pos.coords.latitude, lng: pos.coords.longitude, duration: shareDuration }) } catch {}
        finally { setSharing(false) }
      },
      (err) => { alert('Could not get location: ' + err.message); setSharing(false) }
    )
  }

  const handleStopSharing = async () => {
    try { await api.delete(`/circles/${id}/location`); setMyShare(null) } catch {}
  }

  const formatTime = (d: string) => new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const getTimeRemaining = (exp: string) => {
    const mins = Math.ceil((new Date(exp).getTime() - Date.now()) / 60000)
    return mins <= 0 ? 'Expired' : `${mins}m left`
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="w-10 h-10 border-3 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
      </div>
    )
  }

  if (error || !circle) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4"><span className="text-2xl">❌</span></div>
        <p className="text-gray-700 font-medium mb-2">{error || 'Circle not found'}</p>
        <Link to="/circles" className="text-brand-600 text-sm font-medium hover:text-brand-800">← Back to circles</Link>
      </div>
    )
  }

  return (
    <div>
      <Link to="/circles" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-brand-600 transition-colors mb-6 group">
        <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back to circles
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{circle.name}</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Invite code: <span className="font-mono text-brand-600 tracking-wider">{circle.inviteCode}</span>
            <span className="mx-2">·</span>
            {circle.members.length} member{circle.members.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Messages */}
        <div className="card flex flex-col h-[500px] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2">
            <span className="text-sm">💬</span>
            <h2 className="font-semibold text-gray-900 text-sm">Messages</h2>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map(msg => (
              <div key={msg.id} className={msg.userId === user?.id ? 'text-right' : ''}>
                <div className={`inline-block max-w-[80%] px-3.5 py-2.5 rounded-2xl text-sm ${
                  msg.userId === user?.id
                    ? 'bg-brand-600 text-white rounded-br-md'
                    : 'bg-gray-100 text-gray-800 rounded-bl-md'
                }`}>
                  {msg.userId !== user?.id && (
                    <p className="text-xs font-semibold mb-0.5 opacity-70">{msg.userName}</p>
                  )}
                  <p>{msg.content}</p>
                </div>
                <p className="text-[10px] text-gray-400 mt-1 px-1">{formatTime(msg.createdAt)}</p>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSendMessage} className="p-3 border-t border-gray-100 flex gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              className="input-field flex-1"
            />
            <button type="submit" className="btn-primary px-5">Send</button>
          </form>
        </div>

        {/* Location Sharing */}
        <div className="card flex flex-col h-[500px] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm">📍</span>
              <h2 className="font-semibold text-gray-900 text-sm">Live Locations</h2>
            </div>

            {myShare ? (
              <button onClick={handleStopSharing} className="btn-danger text-xs px-3 py-1.5">
                Stop ({getTimeRemaining(myShare.expiresAt)})
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <select value={shareDuration} onChange={e => setShareDuration(Number(e.target.value))} className="select-field text-xs py-1.5">
                  <option value={15}>15 min</option>
                  <option value={30}>30 min</option>
                  <option value={60}>60 min</option>
                </select>
                <button onClick={handleShareLocation} disabled={sharing} className="btn-primary text-xs px-3 py-1.5">
                  {sharing ? 'Detecting...' : 'Share'}
                </button>
              </div>
            )}
          </div>

          <div className="flex-1 relative">
            {locations.length > 0 ? (
              <MapContainer center={[locations[0].lat, locations[0].lng]} zoom={13} className="h-full w-full">
                <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                {locations.map(loc => (
                  <Marker key={loc.id} position={[loc.lat, loc.lng]}>
                    <Popup><strong>{loc.userName}</strong><br />{getTimeRemaining(loc.expiresAt)}</Popup>
                  </Marker>
                ))}
              </MapContainer>
            ) : (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <span className="text-2xl">📍</span>
                  </div>
                  <p className="text-gray-500 font-medium text-sm">No active locations</p>
                  <p className="text-xs text-gray-400 mt-1">Share yours to let others know you're safe</p>
                </div>
              </div>
            )}
          </div>

          {locations.length > 0 && (
            <div className="px-5 py-2.5 border-t border-gray-100 text-xs text-gray-500">
              {locations.length} member{locations.length !== 1 ? 's' : ''} sharing
            </div>
          )}
        </div>
      </div>

      {/* Members */}
      <div className="card p-5 mt-5">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Members</h2>
        <div className="flex flex-wrap gap-2">
          {circle.members.map(m => (
            <span key={m.userId} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 rounded-full text-sm text-gray-700 border border-gray-100">
              <span className="w-5 h-5 bg-brand-100 text-brand-700 rounded-full flex items-center justify-center text-[10px] font-bold">
                {m.displayName.charAt(0).toUpperCase()}
              </span>
              {m.displayName}
              {m.userId === circle.ownerId && <span className="text-amber-500">👑</span>}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
