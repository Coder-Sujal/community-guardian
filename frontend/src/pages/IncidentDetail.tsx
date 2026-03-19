import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import api from '../lib/api'

interface Incident {
  id: string
  title: string
  description: string
  category: string
  severity: string
  location?: { lat: number; lng: number; radius: number }
  source: string
  sourceUrl?: string
  verified: boolean
  aiConfidence?: number
  createdAt: string
}

const categoryConfig: Record<string, { icon: string; label: string; bg: string; color: string }> = {
  CRIME:   { icon: '🚨', label: 'Crime',   bg: 'bg-red-50',     color: 'text-red-700' },
  WEATHER: { icon: '🌧️', label: 'Weather', bg: 'bg-sky-50',     color: 'text-sky-700' },
  HEALTH:  { icon: '🏥', label: 'Health',  bg: 'bg-emerald-50', color: 'text-emerald-700' },
  SCAM:    { icon: '⚠️', label: 'Scam',    bg: 'bg-amber-50',   color: 'text-amber-700' },
  CYBER:   { icon: '💻', label: 'Cyber',   bg: 'bg-violet-50',  color: 'text-violet-700' },
  OTHER:   { icon: '📋', label: 'Other',   bg: 'bg-gray-50',    color: 'text-gray-700' },
}

const severityConfig: Record<string, { label: string; dot: string; badge: string }> = {
  HIGH:   { label: 'High Severity',   dot: 'bg-red-500',   badge: 'bg-red-50 text-red-700 ring-red-200' },
  MEDIUM: { label: 'Medium Severity', dot: 'bg-amber-500', badge: 'bg-amber-50 text-amber-700 ring-amber-200' },
  LOW:    { label: 'Low Severity',    dot: 'bg-green-500', badge: 'bg-green-50 text-green-700 ring-green-200' },
}

export default function IncidentDetail() {
  const { id } = useParams()
  const [incident, setIncident] = useState<Incident | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchIncident()
  }, [id])

  const fetchIncident = async () => {
    try {
      const res = await api.get(`/feed/${id}`)
      setIncident(res.data)
    } catch (err) {
      setError('Failed to load incident')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="w-10 h-10 border-3 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
      </div>
    )
  }

  if (error || !incident) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">❌</span>
        </div>
        <p className="text-gray-700 font-medium mb-2">{error || 'Incident not found'}</p>
        <Link to="/feed" className="text-brand-600 text-sm font-medium hover:text-brand-800 transition-colors">
          ← Back to feed
        </Link>
      </div>
    )
  }

  const cat = categoryConfig[incident.category] || categoryConfig.OTHER
  const sev = severityConfig[incident.severity] || severityConfig.MEDIUM

  return (
    <div className="max-w-2xl mx-auto">
      <Link
        to="/feed"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-brand-600 transition-colors mb-6 group"
      >
        <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back to feed
      </Link>

      <div className="card overflow-hidden">
        {/* Colored top bar */}
        <div className={`h-1.5 ${incident.severity === 'HIGH' ? 'bg-red-500' : incident.severity === 'MEDIUM' ? 'bg-amber-500' : 'bg-green-500'}`} />

        <div className="p-6 sm:p-8">
          {/* Badges */}
          <div className="flex items-center gap-2 mb-5 flex-wrap">
            <span className={`badge ring-1 ${sev.badge}`}>
              <span className={`w-1.5 h-1.5 ${sev.dot} rounded-full mr-1.5`} />
              {sev.label}
            </span>
            <span className={`badge ${cat.bg} ${cat.color} ring-1 ring-current/10`}>
              {cat.icon} {cat.label}
            </span>
            {incident.verified ? (
              <span className="badge bg-brand-50 text-brand-700 ring-1 ring-brand-200">
                ✓ AI Verified
                {incident.aiConfidence != null && ` · ${Math.round(incident.aiConfidence * 100)}% confidence`}
              </span>
            ) : (
              <span className="badge bg-gray-50 text-gray-500 ring-1 ring-gray-200">
                ⚠ Unverified
              </span>
            )}
          </div>

          {/* Title */}
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 leading-snug mb-5">
            {incident.title}
          </h1>

          {/* Description */}
          <p className="text-gray-600 whitespace-pre-wrap leading-relaxed text-[15px]">
            {incident.description}
          </p>

          {/* Meta */}
          <div className="mt-8 pt-6 border-t border-gray-100 grid gap-3 text-sm">
            <div className="flex items-center gap-2 text-gray-500">
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              <span className="text-gray-400">Source:</span>
              {incident.sourceUrl ? (
                <a href={incident.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:text-brand-800 transition-colors">
                  {incident.source} ↗
                </a>
              ) : (
                <span className="text-gray-700">{incident.source}</span>
              )}
            </div>

            <div className="flex items-center gap-2 text-gray-500">
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-gray-400">Reported:</span>
              <span className="text-gray-700">{new Date(incident.createdAt).toLocaleString()}</span>
            </div>

            {incident.location && (
              <div className="flex items-center gap-2 text-gray-500">
                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="text-gray-400">Location:</span>
                <span className="text-gray-700">
                  {incident.location.lat.toFixed(4)}, {incident.location.lng.toFixed(4)}
                  {incident.location.radius && ` · ${incident.location.radius}km radius`}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
