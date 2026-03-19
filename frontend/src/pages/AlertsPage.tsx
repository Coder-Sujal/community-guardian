import { Link } from 'react-router-dom'
import { useLocationAlerts, Alert } from '../hooks/useLocationAlerts'

const severityConfig: Record<string, { label: string; dot: string; badge: string; bg: string; color: string; border: string }> = {
  high:   { label: 'High',   dot: 'bg-red-500',    badge: 'bg-red-50 text-red-700 ring-red-200', bg: '#FEE2E2', color: '#B91C1C', border: '#FECACA' },
  medium: { label: 'Medium', dot: 'bg-amber-500',  badge: 'bg-amber-50 text-amber-700 ring-amber-200', bg: '#FEF3C7', color: '#B45309', border: '#FDE68A' },
  low:    { label: 'Low',    dot: 'bg-green-500',  badge: 'bg-green-50 text-green-700 ring-green-200', bg: '#D1FAE5', color: '#047857', border: '#A7F3D0' },
}

const categoryConfig: Record<string, { icon: string; color: string; bg: string }> = {
  weather: { icon: '⛈️', color: 'text-sky-700',    bg: 'bg-sky-50' },
  cyber:   { icon: '🔒', color: 'text-violet-700', bg: 'bg-violet-50' },
  news:    { icon: '📰', color: 'text-blue-700',   bg: 'bg-blue-50' },
  crime:   { icon: '🚨', color: 'text-red-700',    bg: 'bg-red-50' },
  scam:    { icon: '⚠️', color: 'text-amber-700',  bg: 'bg-amber-50' },
  health:  { icon: '🏥', color: 'text-emerald-700', bg: 'bg-emerald-50' },
}

function timeAgo(iso: string): string {
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3600000)
  if (h < 1) return 'just now'
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function AlertsPage() {
  const { alerts, city, loading, error, refresh } = useLocationAlerts()

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="w-10 h-10 border-3 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
        <p className="text-sm text-gray-400">Loading alerts for your area...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <p className="text-red-600 mb-4">{error}</p>
        <button
          onClick={refresh}
          className="btn-primary"
        >
          Try again
        </button>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Alerts</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {city ? `Near you · ${city}` : 'Near you'} · updated just now
        </p>
      </div>

      {/* Location hint when no city detected */}
      {!city && alerts.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-3 mb-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
          <span>📍</span>
          <p>
            Enable location access for alerts near you, or set it in{' '}
            <Link to="/profile" className="underline font-medium">Profile</Link>.
          </p>
        </div>
      )}

      {/* Empty state */}
      {alerts.length === 0 && (
        <div className="text-center py-16">
          <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">✅</span>
          </div>
          <p className="text-gray-900 font-semibold">No active alerts in your area</p>
          <p className="text-sm text-gray-500 mt-1">We will notify you when something comes up.</p>
        </div>
      )}

      {/* Alert card list */}
      <div className="space-y-3">
        {alerts.map((alert: Alert) => {
          const sev = severityConfig[alert.severity] || severityConfig.medium
          const cat = categoryConfig[alert.category] || { icon: '⚠️', color: 'text-gray-700', bg: 'bg-gray-50' }
          const isNews = alert.category === 'news' && alert.articleUrl

          // News card layout
          if (isNews) {
            return (
              <Link
                key={alert.id}
                to={`/alerts/${alert.id}`}
                className="block hover:bg-gray-50 transition-colors"
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                  padding: '14px 16px',
                  borderBottom: '1px solid #f0f0f0',
                  cursor: 'pointer',
                }}
              >
                {/* Thumbnail image if available */}
                {alert.imageUrl && (
                  <img
                    src={alert.imageUrl}
                    alt=""
                    style={{
                      width: 64,
                      height: 64,
                      objectFit: 'cover',
                      borderRadius: 8,
                      flexShrink: 0,
                    }}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                  />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Severity badge + source */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '2px 7px',
                      borderRadius: 4,
                      background: sev.bg,
                      color: sev.color,
                      border: `1px solid ${sev.border}`,
                      textTransform: 'uppercase',
                    }}>
                      {alert.severity}
                    </span>
                    <span style={{ fontSize: 11, color: '#aaa' }}>📰 {alert.source}</span>
                  </div>
                  {/* Title */}
                  <p style={{
                    margin: '0 0 3px',
                    fontSize: 14,
                    fontWeight: 600,
                    color: '#1a1a1a',
                    lineHeight: 1.3,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}>
                    {alert.title}
                  </p>
                  {/* Time */}
                  <p style={{ margin: 0, fontSize: 11, color: '#bbb' }}>
                    {timeAgo(alert.createdAt)}
                  </p>
                </div>
                <span style={{ color: '#ccc', fontSize: 20, flexShrink: 0 }}>›</span>
              </Link>
            )
          }

          // Standard alert card layout
          return (
            <Link
              key={alert.id}
              to={`/alerts/${alert.id}`}
              className="card-hover block group"
            >
              <div className="p-4 sm:p-5">
                <div className="flex items-start gap-3.5">
                  {/* Category icon */}
                  <div className={`w-10 h-10 ${cat.bg} rounded-xl flex items-center justify-center flex-shrink-0 text-lg`}>
                    {cat.icon}
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Severity badge */}
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`badge ring-1 ${sev.badge}`}>
                        <span className={`w-1.5 h-1.5 ${sev.dot} rounded-full mr-1.5`} />
                        {sev.label}
                      </span>
                    </div>

                    {/* Title */}
                    <h3 className="font-semibold text-gray-900 group-hover:text-brand-700 transition-colors leading-snug line-clamp-1">
                      {alert.title}
                    </h3>

                    {/* Description preview */}
                    <p className="text-sm text-gray-500 mt-1 line-clamp-1 leading-relaxed">
                      {alert.description}
                    </p>

                    {/* Source + time */}
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                      <span>{alert.source}</span>
                      <span>·</span>
                      <time dateTime={alert.createdAt}>{timeAgo(alert.createdAt)}</time>
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
      </div>
    </div>
  )
}
