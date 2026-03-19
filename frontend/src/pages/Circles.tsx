import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../lib/api'

interface Circle {
  id: string
  name: string
  inviteCode: string
  memberCount: number
  createdAt: string
}

export default function Circles() {
  const [circles, setCircles] = useState<Circle[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [showJoin, setShowJoin] = useState(false)
  const [newName, setNewName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => { fetchCircles() }, [])

  const fetchCircles = async () => {
    try {
      const res = await api.get('/circles')
      setCircles(res.data)
    } catch (err) { setError('Failed to load circles') }
    finally { setLoading(false) }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setCreating(true)
    try {
      await api.post('/circles', { name: newName })
      setNewName(''); setShowCreate(false); fetchCircles()
    } catch (err: any) { setError(err.response?.data?.error || 'Failed to create circle') }
    finally { setCreating(false) }
  }

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setCreating(true)
    try {
      await api.post('/circles/join', { inviteCode })
      setInviteCode(''); setShowJoin(false); fetchCircles()
    } catch (err: any) { setError(err.response?.data?.error || 'Failed to join circle') }
    finally { setCreating(false) }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="w-10 h-10 border-3 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
        <p className="text-sm text-gray-400">Loading circles...</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Safe Circles</h1>
          <p className="text-sm text-gray-500 mt-0.5">{circles.length} circle{circles.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setShowJoin(true); setShowCreate(false); setError('') }} className="btn-secondary">Join</button>
          <button onClick={() => { setShowCreate(true); setShowJoin(false); setError('') }} className="btn-primary">+ Create</button>
        </div>
      </div>

      {error && (
        <div className="card border-red-200 bg-red-50 px-4 py-3 mb-5 text-sm text-red-700" role="alert">{error}</div>
      )}

      {showCreate && (
        <div className="card p-5 mb-5">
          <h3 className="font-semibold text-gray-900 mb-3">Create New Circle</h3>
          <form onSubmit={handleCreate} className="flex gap-3">
            <input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Circle name" className="input-field flex-1" required />
            <button type="submit" disabled={creating} className="btn-primary">{creating ? 'Creating...' : 'Create'}</button>
            <button type="button" onClick={() => setShowCreate(false)} className="btn-ghost">Cancel</button>
          </form>
        </div>
      )}

      {showJoin && (
        <div className="card p-5 mb-5">
          <h3 className="font-semibold text-gray-900 mb-3">Join a Circle</h3>
          <form onSubmit={handleJoin} className="flex gap-3">
            <input type="text" value={inviteCode} onChange={e => setInviteCode(e.target.value.toUpperCase())} placeholder="Enter invite code" className="input-field flex-1 uppercase font-mono tracking-widest" maxLength={6} required />
            <button type="submit" disabled={creating} className="btn-primary">{creating ? 'Joining...' : 'Join'}</button>
            <button type="button" onClick={() => setShowJoin(false)} className="btn-ghost">Cancel</button>
          </form>
        </div>
      )}

      <div className="space-y-3">
        {circles.map(circle => (
          <Link key={circle.id} to={`/circles/${circle.id}`} className="card-hover block group">
            <div className="p-4 sm:p-5 flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 bg-brand-50 text-brand-600 rounded-xl flex items-center justify-center font-bold text-sm">
                  {circle.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 group-hover:text-brand-700 transition-colors">{circle.name}</h3>
                  <p className="text-sm text-gray-500">{circle.memberCount} member{circle.memberCount !== 1 ? 's' : ''}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">Invite</p>
                  <p className="font-mono text-sm text-brand-600 tracking-wider">{circle.inviteCode}</p>
                </div>
                <svg className="w-5 h-5 text-gray-300 group-hover:text-brand-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          </Link>
        ))}

        {circles.length === 0 && (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">👥</span>
            </div>
            <p className="text-gray-500 font-medium">No circles yet</p>
            <p className="text-sm text-gray-400 mt-1">Create one or join with an invite code</p>
          </div>
        )}
      </div>
    </div>
  )
}
