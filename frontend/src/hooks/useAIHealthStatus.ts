import { useState, useEffect, useCallback, useRef } from 'react'
import api from '../lib/api'

export interface AIHealthStatus {
  available: boolean
  lastCheck: string | null
  mode: 'ai' | 'fallback'
}

interface UseAIHealthStatusResult {
  status: AIHealthStatus
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

const DEFAULT_STATUS: AIHealthStatus = {
  available: true,
  lastCheck: null,
  mode: 'ai',
}

const POLL_INTERVAL_MS = 30_000

/**
 * Fetch AI health status from the backend.
 */
export async function fetchAIHealthStatus(): Promise<AIHealthStatus> {
  const res = await api.get('/health/ai')
  return res.data
}

/**
 * Hook that polls the AI health status endpoint at a regular interval.
 */
export function useAIHealthStatus(pollInterval = POLL_INTERVAL_MS): UseAIHealthStatusResult {
  const [status, setStatus] = useState<AIHealthStatus>(DEFAULT_STATUS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const refresh = useCallback(async () => {
    try {
      const data = await fetchAIHealthStatus()
      setStatus(data)
      setError(null)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch AI health status')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
    timerRef.current = setInterval(refresh, pollInterval)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [refresh, pollInterval])

  return { status, loading, error, refresh }
}
