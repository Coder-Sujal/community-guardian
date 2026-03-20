import { useAIHealthStatus } from '../hooks/useAIHealthStatus'

export default function FallbackBanner() {
  const { status } = useAIHealthStatus()

  const shouldShow = !status.available || status.mode === 'fallback'

  if (!shouldShow) return null

  return (
    <div
      className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3.5 mb-5 flex items-start gap-3"
      role="alert"
    >
      <div className="w-8 h-8 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
        <span className="text-amber-600 text-sm" aria-hidden="true">⚠️</span>
      </div>
      <div>
        <p className="text-sm font-semibold text-amber-800">
          AI verification unavailable
        </p>
        <p className="text-xs text-amber-600 mt-0.5 leading-relaxed">
          Alerts are still collected from official sources but haven't been AI-verified.
          Exercise extra caution.
        </p>
      </div>
    </div>
  )
}
