import { useState, useEffect } from 'react'
import api from '../lib/api'
import { useAuth } from '../context/AuthContext'
import AlertCard, { Alert } from './AlertCard'
import FallbackBanner from './FallbackBanner'

export default function DigestFeed() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [locationBased, setLocationBased] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [category, setCategory] = useState('ALL')
  const [severity, setSeverity] = useState('ALL')
  const { user } = useAuth()

  const hasUnverifiedAlerts = alerts.some(a => !a.verified)
  const hasFilters = category !== 'ALL' || severity !== 'ALL'

  useEffect(() => { fetchAlerts() }, [locationBased, category, severity])

  const fetchAlerts = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      params.set('locationBased', String(locationBased))
      if (category !== 'ALL') params.set('category', category)
      if (severity !== 'ALL') params.set('severity', severity)
      const res = await api.get(`/feed?${params.toString()}`)
      setAlerts(res.data)
    } catch { setError('Failed to load alerts') }
    finally { setLoading(false) }
  }

  const handleRefresh = async () => {
    try { setRefreshing(true); await api.post('/feed/refresh'); await fetchAlerts() }
    catch { setError('Failed to refresh alerts') }
    finally { setRefreshing(false) }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="w-10 h-10 border-3 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
        <p className="text-sm text-gray-400">Loading digest...</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Safety Digest</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {alerts.length} alert{alerts.length !== 1 ? 's' : ''}{hasFilters && ' (filtered)'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleRefresh} disabled={refreshing} className="btn-secondary text-xs">
            {refreshing ? 'Refreshing...' : '🔄 Refresh'}
          </button>
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <div className="relative">
              <input type="checkbox" checked={locationBased} onChange={e => setLocationBased(e.target.checked)} className="sr-only peer" disabled={!user?.location} />
              <div className="w-9 h-5 bg-gray-200 rounded-full peer-checked:bg-brand-600 peer-disabled:opacity-40 transition-colors" />
              <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow-sm peer-checked:translate-x-4 transition-transform" />
            </div>
            <span className="text-sm text-gray-600">Near me</span>
          </label>
        </div>
      </div>

      <FallbackBanner visible={hasUnverifiedAlerts} />

      <div className="card p-3 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Filters</span>
          <select value={category} onChange={e => setCategory(e.target.value)} className="select-field" aria-label="Filter by category">
            <option value="ALL">All Categories</option>
            <option value="CRIME">🚨 Crime</option>
            <option value="WEATHER">🌧️ Weather</option>
            <option value="HEALTH">🏥 Health</option>
            <option value="SCAM">⚠️ Scam</option>
            <option value="CYBER">💻 Cyber</option>
            <option value="OTHER">📋 Other</option>
          </select>
          <select value={severity} onChange={e => setSeverity(e.target.value)} className="select-field" aria-label="Filter by severity">
            <option value="ALL">All Severities</option>
            <option value="HIGH">🔴 High</option>
            <option value="MEDIUM">🟡 Medium</option>
            <option value="LOW">🟢 Low</option>
          </select>
          {hasFilters && (
            <button onClick={() => { setCategory('ALL'); setSeverity('ALL') }} className="text-xs font-medium text-brand-600 hover:text-brand-800 transition-colors">
              ✕ Clear
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="card border-red-200 bg-red-50 px-4 py-3 mb-6 text-sm text-red-700" role="alert">{error}</div>
      )}

      <div className="space-y-3">
        {alerts.map(alert => <AlertCard key={alert.id} alert={alert} />)}
        {alerts.length === 0 && (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4"><span className="text-2xl">📭</span></div>
            <p className="text-gray-500 font-medium">No alerts to display</p>
            <p className="text-sm text-gray-400 mt-1">{hasFilters ? 'Try adjusting your filters' : 'Check back later for updates'}</p>
          </div>
        )}
      </div>
    </div>
  )
}
