import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../lib/api'
import { useAuth } from '../context/AuthContext'

interface Incident {
  id: string
  title: string
  description: string
  category: string
  severity: string
  source: string
  verified: boolean
  aiConfidence?: number
  createdAt: string
}

const categoryConfig: Record<string, { icon: string; color: string; bg: string }> = {
  CRIME:   { icon: '🚨', color: 'text-red-700',    bg: 'bg-red-50' },
  WEATHER: { icon: '🌧️', color: 'text-sky-700',    bg: 'bg-sky-50' },
  HEALTH:  { icon: '🏥', color: 'text-emerald-700', bg: 'bg-emerald-50' },
  SCAM:    { icon: '⚠️', color: 'text-amber-700',   bg: 'bg-amber-50' },
  CYBER:   { icon: '💻', color: 'text-violet-700',  bg: 'bg-violet-50' },
  OTHER:   { icon: '📋', color: 'text-gray-700',    bg: 'bg-gray-50' },
}

const severityConfig: Record<string, { label: string; dot: string; badge: string }> = {
  HIGH:   { label: 'High',   dot: 'bg-red-500',    badge: 'bg-red-50 text-red-700 ring-red-200' },
  MEDIUM: { label: 'Medium', dot: 'bg-amber-500',  badge: 'bg-amber-50 text-amber-700 ring-amber-200' },
  LOW:    { label: 'Low',    dot: 'bg-green-500',   badge: 'bg-green-50 text-green-700 ring-green-200' },
}

export default function Feed() {
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [locationBased, setLocationBased] = useState(false)
  const [category, setCategory] = useState('ALL')
  const [severity, setSeverity] = useState('ALL')
  const { user } = useAuth()

  useEffect(() => {
    fetchFeed()
  }, [locationBased, category, severity])

  const fetchFeed = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      params.set('locationBased', String(locationBased))
      if (category !== 'ALL') params.set('category', category)
      if (severity !== 'ALL') params.set('severity', severity)
      const res = await api.get(`/feed?${params.toString()}`)
      setIncidents(res.data)
    } catch (err) {
      setError('Failed to load feed')
    } finally {
      setLoading(false)
    }
  }

  const formatTime = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime()
    const hours = Math.floor(diff / 3600000)
    if (hours < 1) return 'Just now'
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    if (days < 7) return `${days}d ago`
    return new Date(dateStr).toLocaleDateString()
  }

  const hasFilters = category !== 'ALL' || severity !== 'ALL'

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="w-10 h-10 border-3 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
        <p className="text-sm text-gray-400">Loading alerts...</p>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Safety Feed</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {incidents.length} alert{incidents.length !== 1 ? 's' : ''}
            {hasFilters && ' (filtered)'}
          </p>
        </div>

        <label className="flex items-center gap-2.5 cursor-pointer select-none">
          <div className="relative">
            <input
              type="checkbox"
              checked={locationBased}
              onChange={e => setLocationBased(e.target.checked)}
              className="sr-only peer"
              disabled={!user?.location}
            />
            <div className="w-9 h-5 bg-gray-200 rounded-full peer-checked:bg-brand-600 peer-disabled:opacity-40 transition-colors" />
            <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow-sm peer-checked:translate-x-4 transition-transform" />
          </div>
          <span className="text-sm text-gray-600">
            Near me{!user?.location && <span className="text-gray-400 ml-1">(set in profile)</span>}
          </span>
        </label>
      </div>

      {/* Filters */}
      <div className="card p-3 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Filters</span>

          <select
            id="category-filter"
            value={category}
            onChange={e => setCategory(e.target.value)}
            className="select-field"
            aria-label="Filter by category"
          >
            <option value="ALL">All Categories</option>
            <option value="CRIME">🚨 Crime</option>
            <option value="WEATHER">🌧️ Weather</option>
            <option value="HEALTH">🏥 Health</option>
            <option value="SCAM">⚠️ Scam</option>
            <option value="CYBER">💻 Cyber</option>
            <option value="OTHER">📋 Other</option>
          </select>

          <select
            id="severity-filter"
            value={severity}
            onChange={e => setSeverity(e.target.value)}
            className="select-field"
            aria-label="Filter by severity"
          >
            <option value="ALL">All Severities</option>
            <option value="HIGH">🔴 High</option>
            <option value="MEDIUM">🟡 Medium</option>
            <option value="LOW">🟢 Low</option>
          </select>

          {hasFilters && (
            <button
              onClick={() => { setCategory('ALL'); setSeverity('ALL') }}
              className="text-xs font-medium text-brand-600 hover:text-brand-800 transition-colors"
            >
              ✕ Clear
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="card border-red-200 bg-red-50 px-4 py-3 mb-6 text-sm text-red-700" role="alert">
          {error}
        </div>
      )}

      {/* Feed */}
      <div className="space-y-3">
        {incidents.map(incident => {
          const cat = categoryConfig[incident.category] || categoryConfig.OTHER
          const sev = severityConfig[incident.severity] || severityConfig.MEDIUM
          return (
            <Link
              key={incident.id}
              to={`/feed/${incident.id}`}
              className="card-hover block group"
            >
              <div className="p-4 sm:p-5">
                <div className="flex items-start gap-3.5">
                  {/* Category icon */}
                  <div className={`w-10 h-10 ${cat.bg} rounded-xl flex items-center justify-center flex-shrink-0 text-lg`}>
                    {cat.icon}
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Badges */}
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className={`badge ring-1 ${sev.badge}`}>
                        <span className={`w-1.5 h-1.5 ${sev.dot} rounded-full mr-1.5`} />
                        {sev.label}
                      </span>
                      {incident.verified ? (
                        <span className="badge bg-brand-50 text-brand-700 ring-1 ring-brand-200">
                          ✓ Verified
                          {incident.aiConfidence != null && ` ${Math.round(incident.aiConfidence * 100)}%`}
                        </span>
                      ) : (
                        <span className="badge bg-gray-50 text-gray-500 ring-1 ring-gray-200">
                          Unverified
                        </span>
                      )}
                    </div>

                    <h3 className="font-semibold text-gray-900 group-hover:text-brand-700 transition-colors leading-snug">
                      {incident.title}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1 line-clamp-2 leading-relaxed">
                      {incident.description}
                    </p>

                    {/* Footer */}
                    <div className="flex items-center gap-3 mt-3 text-xs text-gray-400">
                      <span>{incident.source}</span>
                      <span>·</span>
                      <time dateTime={incident.createdAt}>{formatTime(incident.createdAt)}</time>
                    </div>
                  </div>

                  {/* Arrow */}
                  <svg className="w-5 h-5 text-gray-300 group-hover:text-brand-500 flex-shrink-0 mt-1 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </Link>
          )
        })}

        {incidents.length === 0 && (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">📭</span>
            </div>
            <p className="text-gray-500 font-medium">No alerts to display</p>
            <p className="text-sm text-gray-400 mt-1">
              {hasFilters ? 'Try adjusting your filters' : 'Check back later for updates'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
