import { useState, useEffect, useCallback, useRef } from 'react'
import api from '../lib/api'

export interface Alert {
  id: string
  title: string
  description: string
  category: string
  severity: string
  source: string
  sourceUrl?: string
  articleUrl?: string
  imageUrl?: string
  actionStep?: string
  steps?: string[] | string
  verified: boolean
  aiProcessed?: boolean
  aiConfidence?: number
  createdAt: string
  expiresAt?: string
}

interface UseLocationAlertsResult {
  alerts: Alert[]
  city: string | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

/**
 * Get the browser's current position as a promise.
 * Resolves to coords or null if denied/unavailable.
 */
function getBrowserLocation(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
    )
  })
}

export function useLocationAlerts(): UseLocationAlertsResult {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [city, setCity] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const locationRef = useRef<{ lat: number; lng: number } | null>(null)

  const fetchAlerts = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // Try to get browser location if we don't have it yet
      if (!locationRef.current) {
        locationRef.current = await getBrowserLocation()
      }

      const params: Record<string, string> = {}
      if (locationRef.current) {
        params.lat = locationRef.current.lat.toString()
        params.lng = locationRef.current.lng.toString()
      }

      const res = await api.get('/alerts', { params })
      setAlerts(res.data.alerts || [])
      setCity(res.data.city || null)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load alerts')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAlerts()
  }, [fetchAlerts])

  return { alerts, city, loading, error, refresh: fetchAlerts }
}
