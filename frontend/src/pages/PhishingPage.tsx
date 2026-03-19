import { useState, useEffect, useCallback } from 'react'
import api from '../lib/api'

interface PhishingSite {
  id: string
  url: string
  target: string
  detailUrl: string
  submittedAt: string
  verifiedAt: string
  online: boolean
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export default function PhishingPage() {
  const [sites, setSites] = useState<PhishingSite[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' })
      if (search) params.set('search', search)
      
      const res = await api.get(`/phishing?${params}`)
      setSites(res.data.sites)
      setPagination(res.data.pagination)
    } catch (err) {
      setError('Failed to load phishing data')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [page, search])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    setSearch(searchInput)
  }

  const clearSearch = () => {
    setSearchInput('')
    setSearch('')
    setPage(1)
  }

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Phishing Sites</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Verified phishing URLs from PhishTank
        </p>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="mb-6">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by URL or target..."
              className="w-full px-4 py-2.5 pr-10 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            />
            {searchInput && (
              <button
                type="button"
                onClick={clearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            )}
          </div>
          <button
            type="submit"
            className="px-5 py-2.5 bg-brand-600 text-white rounded-xl font-medium hover:bg-brand-700 transition-colors"
          >
            Search
          </button>
        </div>
      </form>

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-10 h-10 border-3 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
          <p className="text-sm text-gray-400">Loading phishing data...</p>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="text-center py-16">
          <p className="text-red-600 mb-4">{error}</p>
          <button onClick={fetchData} className="btn-primary">
            Try again
          </button>
        </div>
      )}

      {/* Results */}
      {!loading && !error && (
        <>
          {/* Stats */}
          {pagination && (
            <div className="mb-4 text-sm text-gray-500">
              Showing {sites.length} of {pagination.total.toLocaleString()} results
              {search && <span> for "{search}"</span>}
            </div>
          )}

          {/* Empty state */}
          {sites.length === 0 && (
            <div className="text-center py-16">
              <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🔍</span>
              </div>
              <p className="text-gray-900 font-semibold">No phishing sites found</p>
              <p className="text-sm text-gray-500 mt-1">
                {search ? 'Try a different search term' : 'Check back later'}
              </p>
            </div>
          )}

          {/* Site list */}
          <div className="space-y-3">
            {sites.map((site) => (
              <div key={site.id} className="card-hover p-4 sm:p-5">
                <div className="flex items-start gap-3.5">
                  {/* Icon */}
                  <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center flex-shrink-0 text-lg">
                    🎣
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Status badge */}
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`badge ring-1 ${site.online ? 'bg-red-50 text-red-700 ring-red-200' : 'bg-gray-50 text-gray-600 ring-gray-200'}`}>
                        <span className={`w-1.5 h-1.5 ${site.online ? 'bg-red-500' : 'bg-gray-400'} rounded-full mr-1.5`} />
                        {site.online ? 'Online' : 'Offline'}
                      </span>
                      <span className="badge bg-violet-50 text-violet-700 ring-1 ring-violet-200">
                        Target: {site.target || 'Unknown'}
                      </span>
                    </div>

                    {/* URL */}
                    <p className="font-mono text-sm text-gray-900 break-all leading-relaxed">
                      {site.url}
                    </p>

                    {/* Meta */}
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                      <span>ID: {site.id}</span>
                      <span>·</span>
                      <span>Verified: {formatDate(site.verifiedAt)}</span>
                    </div>
                  </div>

                  {/* External link */}
                  <a
                    href={site.detailUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                    title="View on PhishTank"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="px-4 py-2 text-sm text-gray-600">
                Page {page} of {pagination.totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                disabled={page === pagination.totalPages}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
