import { Link } from 'react-router-dom'

export interface Alert {
  id: string
  title: string
  description: string
  category: string
  severity: string
  source: string
  sourceUrl?: string
  verified: boolean
  aiConfidence?: number
  createdAt: string
}

const categoryConfig: Record<string, { icon: string; bg: string }> = {
  CRIME:   { icon: '🚨', bg: 'bg-red-50' },
  WEATHER: { icon: '🌧️', bg: 'bg-sky-50' },
  HEALTH:  { icon: '🏥', bg: 'bg-emerald-50' },
  SCAM:    { icon: '⚠️', bg: 'bg-amber-50' },
  CYBER:   { icon: '💻', bg: 'bg-violet-50' },
  OTHER:   { icon: '📋', bg: 'bg-gray-50' },
}

const severityConfig: Record<string, { label: string; dot: string; badge: string }> = {
  HIGH:   { label: 'High',   dot: 'bg-red-500',   badge: 'bg-red-50 text-red-700 ring-red-200' },
  MEDIUM: { label: 'Medium', dot: 'bg-amber-500', badge: 'bg-amber-50 text-amber-700 ring-amber-200' },
  LOW:    { label: 'Low',    dot: 'bg-green-500', badge: 'bg-green-50 text-green-700 ring-green-200' },
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const hours = Math.floor(diff / 3600000)
  if (hours < 1) return 'Just now'
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString()
}

export default function AlertCard({ alert }: { alert: Alert }) {
  const cat = categoryConfig[alert.category] || categoryConfig.OTHER
  const sev = severityConfig[alert.severity] || severityConfig.MEDIUM

  return (
    <Link to={`/feed/${alert.id}`} className="card-hover block group">
      <div className="p-4 sm:p-5">
        <div className="flex items-start gap-3.5">
          <div className={`w-10 h-10 ${cat.bg} rounded-xl flex items-center justify-center flex-shrink-0 text-lg`}>
            {cat.icon}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className={`badge ring-1 ${sev.badge}`}>
                <span className={`w-1.5 h-1.5 ${sev.dot} rounded-full mr-1.5`} />
                {sev.label}
              </span>
              {alert.verified ? (
                <span className="badge bg-blue-50 text-blue-700 ring-1 ring-blue-200">
                  ✓ Verified{alert.aiConfidence != null && ` ${Math.round(alert.aiConfidence * 100)}%`}
                </span>
              ) : (
                <span className="badge bg-gray-50 text-gray-500 ring-1 ring-gray-200">Unverified</span>
              )}
            </div>

            <h3 className="font-semibold text-gray-900 group-hover:text-brand-700 transition-colors leading-snug">
              {alert.title}
            </h3>
            <p className="text-sm text-gray-500 mt-1 line-clamp-2 leading-relaxed">{alert.description}</p>

            <div className="flex items-center gap-3 mt-3 text-xs text-gray-400">
              <span>{alert.source}</span>
              <span>·</span>
              <time dateTime={alert.createdAt}>{timeAgo(alert.createdAt)}</time>
            </div>
          </div>

          <svg className="w-5 h-5 text-gray-300 group-hover:text-brand-500 flex-shrink-0 mt-1 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </Link>
  )
}
