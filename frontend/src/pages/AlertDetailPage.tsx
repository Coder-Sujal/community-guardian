import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../lib/api'
import { Alert } from '../hooks/useLocationAlerts'

const severityColors: Record<string, string> = {
  high: 'bg-red-600',
  medium: 'bg-amber-600',
  low: 'bg-green-600',
}

const categoryIcons: Record<string, string> = {
  weather: '⛈️',
  cyber: '🔒',
  news: '📰',
  crime: '🚨',
  scam: '⚠️',
  health: '🏥',
}

export default function AlertDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [alert, setAlert] = useState<Alert | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchAlert() {
      try {
        const res = await api.get(`/alerts/${id}`)
        setAlert(res.data)
      } catch (err: any) {
        setError(err.response?.data?.error || 'Alert not found')
      } finally {
        setLoading(false)
      }
    }
    fetchAlert()
  }, [id])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="w-10 h-10 border-3 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
        <p className="text-sm text-gray-400">Loading...</p>
      </div>
    )
  }

  if (error || !alert) {
    return (
      <div className="text-center py-16">
        <button
          onClick={() => navigate(-1)}
          className="text-brand-600 hover:text-brand-800 mb-4 inline-flex items-center gap-1"
        >
          ← Back
        </button>
        <p className="text-gray-500">{error || 'Alert not found.'}</p>
      </div>
    )
  }

  const bgColor = severityColors[alert.severity] || 'bg-brand-600'
  const icon = categoryIcons[alert.category] || '⚠️'

  // Parse steps - handle both string (JSON) and array
  let steps: string[] = []
  try {
    if (Array.isArray(alert.steps)) {
      steps = alert.steps
    } else if (typeof alert.steps === 'string') {
      steps = JSON.parse(alert.steps)
    }
  } catch {
    steps = []
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Coloured header */}
      <div className={`${bgColor} rounded-t-2xl p-6 -mx-4 sm:-mx-6 -mt-8`}>
        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          className="bg-white/20 hover:bg-white/30 text-white rounded-lg px-3 py-1.5 text-sm font-medium mb-4 inline-flex items-center gap-1 transition-colors"
        >
          ← Back to alerts
        </button>

        {/* Category icon + severity badge */}
        <div className="flex items-center gap-3 mb-3">
          <span className="text-2xl">{icon}</span>
          <span className="bg-white/25 text-white text-xs font-bold px-3 py-1 rounded uppercase tracking-wide">
            {alert.severity}
          </span>
        </div>

        {/* Title */}
        <h1 className="text-xl font-bold text-white mb-3 leading-snug">
          {alert.title}
        </h1>

        {/* Summary */}
        <p className="text-white/90 text-sm leading-relaxed">
          {alert.description}
        </p>
      </div>

      {/* Content area */}
      <div className="bg-white rounded-b-2xl shadow-sm border border-t-0 border-gray-100 -mx-4 sm:-mx-6 px-4 sm:px-6 pb-6">
        {/* Do right now box */}
        {alert.actionStep && (
          <div className="mt-6">
            <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4">
              <p className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-2">
                ⚡ Do right now
              </p>
              <p className="text-amber-800 font-medium leading-relaxed">
                {alert.actionStep}
              </p>
            </div>
          </div>
        )}

        {/* Safety checklist */}
        {steps.length > 0 && (
          <div className="mt-6">
            <p className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-4">
              Safety checklist
            </p>
            <div className="space-y-0">
              {steps.map((step, i) => (
                <div
                  key={i}
                  className={`flex gap-4 py-4 ${i < steps.length - 1 ? 'border-b border-gray-100' : ''}`}
                >
                  {/* Step number circle */}
                  <div className="w-7 h-7 bg-brand-600 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
                    {i + 1}
                  </div>
                  {/* Step text */}
                  <p className="text-gray-700 leading-relaxed pt-0.5">
                    {step}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Source + confidence */}
        <div className="mt-6 pt-4 border-t border-gray-100">
          {alert.articleUrl ? (
            <a
              href={alert.articleUrl}
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'block',
                margin: '0',
                padding: '12px 16px',
                background: '#F4F6F8',
                borderRadius: 8,
                fontSize: 13,
                color: '#1A3C5E',
                fontWeight: 500,
                textDecoration: 'none',
              }}
            >
              Read full article → {alert.source}
            </a>
          ) : alert.sourceUrl ? (
            <a
              href={alert.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-brand-600 hover:text-brand-800 transition-colors"
            >
              Read original report → {alert.source}
            </a>
          ) : (
            <p className="text-sm text-gray-500">Source: {alert.source}</p>
          )}
          {alert.aiConfidence != null && (
            <p className="text-xs text-gray-400 mt-1">
              AI confidence: {Math.round(alert.aiConfidence * 100)}%
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
