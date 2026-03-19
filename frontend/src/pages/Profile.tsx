import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

export default function Profile() {
  const { user, updateLocation } = useAuth()
  const [lat, setLat] = useState(user?.location?.lat?.toString() || '')
  const [lng, setLng] = useState(user?.location?.lng?.toString() || '')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const handleSaveLocation = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage('')
    setSaving(true)

    try {
      await updateLocation(parseFloat(lat), parseFloat(lng))
      setMessage('Location saved!')
    } catch (err) {
      setMessage('Failed to save location')
    } finally {
      setSaving(false)
    }
  }

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      setMessage('Geolocation not supported')
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLat(position.coords.latitude.toString())
        setLng(position.coords.longitude.toString())
        setMessage('Location detected! Click Save to confirm.')
      },
      (error) => {
        setMessage('Could not get location: ' + error.message)
      }
    )
  }

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 tracking-tight mb-6">Profile</h1>

      {/* Account Info */}
      <div className="card p-6 mb-5">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Account</h2>

        <div className="flex items-center gap-4 mb-5">
          <div className="w-14 h-14 bg-brand-100 text-brand-700 rounded-2xl flex items-center justify-center text-xl font-bold">
            {user?.displayName?.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-gray-900">{user?.displayName}</p>
            <p className="text-sm text-gray-500">{user?.email}</p>
          </div>
        </div>

        {user?.location && (
          <div className="flex items-center gap-2 text-sm text-gray-500 bg-gray-50 rounded-xl px-3 py-2">
            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span>Current location: {user.location.lat.toFixed(4)}, {user.location.lng.toFixed(4)}</span>
          </div>
        )}
      </div>

      {/* Location Settings */}
      <div className="card p-6">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-1">Location</h2>
        <p className="text-sm text-gray-500 mb-5">
          Set your location to enable nearby alert filtering.
        </p>

        {message && (
          <div className={`px-4 py-3 rounded-xl mb-5 text-sm border ${
            message.includes('Failed') || message.includes('Could not')
              ? 'bg-red-50 text-red-700 border-red-200'
              : 'bg-green-50 text-green-700 border-green-200'
          }`} role="status">
            {message}
          </div>
        )}

        <form onSubmit={handleSaveLocation} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="lat" className="block text-sm font-medium text-gray-700 mb-1.5">
                Latitude
              </label>
              <input
                id="lat"
                type="number"
                step="any"
                value={lat}
                onChange={e => setLat(e.target.value)}
                placeholder="40.7128"
                className="input-field"
              />
            </div>
            <div>
              <label htmlFor="lng" className="block text-sm font-medium text-gray-700 mb-1.5">
                Longitude
              </label>
              <input
                id="lng"
                type="number"
                step="any"
                value={lng}
                onChange={e => setLng(e.target.value)}
                placeholder="-74.0060"
                className="input-field"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <button type="button" onClick={handleGetCurrentLocation} className="btn-secondary">
              <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Detect
            </button>
            <button
              type="submit"
              disabled={saving || !lat || !lng}
              className="btn-primary"
            >
              {saving ? 'Saving...' : 'Save Location'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
