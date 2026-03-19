import { Link, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Chatbot from './Chatbot'

export default function Layout() {
  const { user, logout } = useAuth()
  const location = useLocation()

  const navItems = [
    { path: '/feed', label: 'Feed', icon: '📰' },
    { path: '/alerts', label: 'Alerts', icon: '🔔' },
    { path: '/phishing', label: 'Phishing', icon: '🎣' },
    { path: '/circles', label: 'Circles', icon: '👥' },
    { path: '/profile', label: 'Profile', icon: '👤' },
  ]

  return (
    <div className="min-h-screen bg-gray-50/80">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <Link to="/feed" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 bg-brand-600 rounded-xl flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
              <span className="text-white text-lg">🛡️</span>
            </div>
            <span className="font-bold text-lg text-gray-900 tracking-tight hidden sm:inline">
              Community Guardian
            </span>
          </Link>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-full">
              <div className="w-6 h-6 bg-brand-100 text-brand-700 rounded-full flex items-center justify-center text-xs font-bold">
                {user?.displayName?.charAt(0).toUpperCase()}
              </div>
              <span className="text-gray-600 text-sm">{user?.displayName}</span>
            </div>
            <button
              onClick={logout}
              className="btn-ghost text-gray-400 hover:text-red-600"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="flex gap-1">
            {navItems.map(item => {
              const active = location.pathname.startsWith(item.path)
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`relative px-4 py-3.5 text-sm font-medium transition-colors ${
                    active
                      ? 'text-brand-600'
                      : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  <span className="mr-1.5">{item.icon}</span>
                  {item.label}
                  {active && (
                    <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-brand-600 rounded-full" />
                  )}
                </Link>
              )
            })}
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <Outlet />
      </main>

      {/* AI Chatbot */}
      <Chatbot />
    </div>
  )
}
