import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getInvestors, getSearches, updateShortlist, getExportUrl } from '../services/api';

const SCORE_COLORS = { Excellent: '#FFD700', Strong: '#4A90E2', Moderate: '#C0C0C0', Low: '#808080', Weak: '#5a5a78' };

function getScoreLabel(score) {
  if (score >= 80) return 'Excellent';
  if (score >= 65) return 'Strong';
  if (score >= 50) return 'Moderate';
  if (score >= 35) return 'Low';
  return 'Weak';
}

function ScoreBar({ value, color }) {
  return (
    <div className="score-bar-wrap">
      <div className="score-bar">
        <div className="score-bar-fill" style={{ width: `${value}%`, background: color || `hsl(${value * 1.2}, 70%, 55%)` }} />
      </div>
      <span className="score-val" style={{ color: color || `hsl(${value * 1.2}, 70%, 55%)` }}>{value}</span>
    </div>
  );
}

function InvestorTypeBadge({ type }) {
  const labels = { family_office: '🏛 Family Office', fund_manager: '📈 Fund Manager', real_estate_operator: '🏗 RE Operator', private_investor: '💼 Private Investor', unknown: '❓ Unknown' };
  return <span className={`investor-type-badge type-${type}`}>{labels[type] || type}</span>;
}

function ShortlistMenu({ investorId, current, onUpdate }) {
  const [open, setOpen] = useState(false);
  const options = [
    { value: 'saved', label: '⭐ Saved', cls: 'status-saved' },
    { value: 'contacted', label: '📨 Contacted', cls: 'status-contacted' },
    { value: 'rejected', label: '✖ Rejected', cls: 'status-rejected' },
    { value: 'none', label: '— Clear', cls: 'status-none' }
  ];
  const handleClick = async (val) => {
    setOpen(false);
    try { await updateShortlist(investorId, val); onUpdate(investorId, val); } catch {}
  };
  const cur = options.find(o => o.value === current) || options[3];
  return (
    <div className="shortlist-menu" onClick={e => e.stopPropagation()}>
      <button className={`btn btn-sm ${cur.value !== 'none' ? '' : 'btn-ghost'}`} style={cur.value !== 'none' ? { background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)', color: 'var(--text-primary)', padding: '5px 12px', fontSize: 12 } : {}} onClick={() => setOpen(v => !v)}>
        {cur.label} ▾
      </button>
      {open && (
        <div className="shortlist-dropdown">
          {options.map(o => <button key={o.value} className="shortlist-option" onClick={() => handleClick(o.value)}><span className={`status-pill ${o.cls}`} style={{ padding: '2px 8px' }}>{o.label}</span></button>)}
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const searchId = searchParams.get('search_id');
  const [investors, setInvestors] = useState([]);
  const [searches, setSearches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchStatus, setSearchStatus] = useState(null);
  const [searchInfo, setSearchInfo] = useState(null);
  const [filters, setFilters] = useState({ investor_type: '', min_score: '', location: '', shortlist_status: '' });
  const [sortBy, setSortBy] = useState('overall_investor_fit_score');
  const [selectedSearch, setSelectedSearch] = useState(searchId || '');
  const [loadingNextPage, setLoadingNextPage] = useState(false);

  // Check search status
  const checkSearchStatus = useCallback(async () => {
    if (!selectedSearch) return;
    try {
      const searches = await getSearches();
      const search = searches.data.find(s => s._id === selectedSearch);
      setSearchStatus(search?.status || null);
      setSearchInfo(search || null);
      return search?.status;
    } catch {
      return null;
    }
  }, [selectedSearch]);

  const loadInvestors = useCallback(async () => {
    if (!selectedSearch) {
      setLoading(true);
      try {
        const params = { sort_by: sortBy };
        if (filters.investor_type) params.investor_type = filters.investor_type;
        if (filters.min_score) params.min_score = filters.min_score;
        if (filters.location) params.location = filters.location;
        if (filters.shortlist_status) params.shortlist_status = filters.shortlist_status;
        const r = await getInvestors(params);
        setInvestors(r.data.investors || []);
      } catch { setInvestors([]); }
      setLoading(false);
      return;
    }

    // Check if search is completed before loading investors
    const status = await checkSearchStatus();
    if (status !== 'completed') {
      setLoading(true);
      return;
    }

    setLoading(true);
    try {
      const params = { sort_by: sortBy, search_id: selectedSearch };
      if (filters.investor_type) params.investor_type = filters.investor_type;
      if (filters.min_score) params.min_score = filters.min_score;
      if (filters.location) params.location = filters.location;
      if (filters.shortlist_status) params.shortlist_status = filters.shortlist_status;
      const r = await getInvestors(params);
      setInvestors(r.data.investors || []);
    } catch { setInvestors([]); }
    setLoading(false);
  }, [selectedSearch, filters, sortBy, checkSearchStatus]);

  useEffect(() => {
    getSearches().then(r => setSearches(r.data || [])).catch(() => {});
    loadInvestors();
  }, [loadInvestors]);

  // Poll for search completion
  useEffect(() => {
    if (!selectedSearch || searchStatus === 'completed' || searchStatus === 'failed') return;
    
    const interval = setInterval(async () => {
      const status = await checkSearchStatus();
      if (status === 'completed') {
        loadInvestors();
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [selectedSearch, searchStatus, checkSearchStatus, loadInvestors]);

  const handleShortlistUpdate = (id, val) => {
    setInvestors(prev => prev.map(i => i._id === id ? { ...i, shortlist_status: val } : i));
  };

  const handleLoadNextPage = async () => {
    if (!selectedSearch || !searchInfo) return;
    setLoadingNextPage(true);
    try {
      const { loadNextPage } = await import('../services/api');
      await loadNextPage(selectedSearch, searchInfo.current_page + 1);
      
      // Poll for completion and reload investors
      const pollInterval = setInterval(async () => {
        const updatedSearches = await getSearches();
        const updatedSearch = updatedSearches.data.find(s => s._id === selectedSearch);
        setSearchInfo(updatedSearch);
        
        if (updatedSearch?.status === 'completed') {
          clearInterval(pollInterval);
          await loadInvestors();
          setLoadingNextPage(false);
        }
      }, 2000);
      
      // Timeout after 60 seconds
      setTimeout(() => {
        clearInterval(pollInterval);
        setLoadingNextPage(false);
      }, 60000);
    } catch (err) {
      console.error('Failed to load next page:', err);
      setLoadingNextPage(false);
    }
  };

  const stats = {
    total: investors.length,
    excellent: investors.filter(i => i.overall_investor_fit_score >= 80).length,
    strong: investors.filter(i => i.overall_investor_fit_score >= 65 && i.overall_investor_fit_score < 80).length,
    saved: investors.filter(i => i.shortlist_status === 'saved').length,
    avgScore: investors.length ? Math.round(investors.reduce((s, i) => s + i.overall_investor_fit_score, 0) / investors.length) : 0,
    withContact: investors.filter(i => i.contact_availability_score > 50).length,
  };

  return (
    <div className="container">
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h1 className="page-title">Investor <span>Dashboard</span></h1>
          <p className="page-subtitle">Ranked, scored, and ready for action.</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <a href={getExportUrl(selectedSearch)} download className="btn btn-secondary btn-sm">
            ⬇ Export CSV
          </a>
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/search')}>
            + New Search
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'var(--accent-subtle)' }}>🎯</div>
          <div className="stat-value">{stats.total}</div>
          <div className="stat-label">Total Investors</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'var(--green-original-subtle)' }}>🏆</div>
          <div className="stat-value">{stats.excellent}</div>
          <div className="stat-label">Excellent Matches</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'var(--blue-subtle)' }}>💪</div>
          <div className="stat-value">{stats.strong}</div>
          <div className="stat-label">Strong Matches</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'var(--gold-subtle)' }}>📊</div>
          <div className="stat-value">{stats.avgScore}</div>
          <div className="stat-label">Avg. Fit Score</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'var(--purple-subtle)' }}>📨</div>
          <div className="stat-value">{stats.withContact}</div>
          <div className="stat-label">Contactable</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'var(--green-original-subtle)' }}>⭐</div>
          <div className="stat-value">{stats.saved}</div>
          <div className="stat-label">Shortlisted</div>
        </div>
      </div>

      <div className="card">
        {/* Filters */}
        <div className="filters-bar">
          <select className="filter-select" value={selectedSearch} onChange={e => setSelectedSearch(e.target.value)}>
            <option value="">All Searches</option>
            {searches.filter(s => s.status === 'completed').map(s => (
              <option key={s._id} value={s._id}>
                {[s.investor_type_filter, s.target_geography].filter(Boolean).join(' · ') || 'General'} — {new Date(s.created_at).toLocaleDateString()}
              </option>
            ))}
          </select>
          <select className="filter-select" value={filters.investor_type} onChange={e => setFilters(f => ({ ...f, investor_type: e.target.value }))}>
            <option value="">All Types</option>
            <option value="family_office">Family Office</option>
            <option value="fund_manager">Fund Manager</option>
            <option value="real_estate_operator">RE Operator</option>
            <option value="private_investor">Private Investor</option>
          </select>
          <select className="filter-select" value={filters.min_score} onChange={e => setFilters(f => ({ ...f, min_score: e.target.value }))}>
            <option value="">All Scores</option>
            <option value="80">80+ Excellent</option>
            <option value="65">65+ Strong</option>
            <option value="50">50+ Moderate</option>
          </select>
          <input className="filter-input" placeholder="Filter by location…" value={filters.location} onChange={e => setFilters(f => ({ ...f, location: e.target.value }))} />
          <select className="filter-select" value={filters.shortlist_status} onChange={e => setFilters(f => ({ ...f, shortlist_status: e.target.value }))}>
            <option value="">All Statuses</option>
            <option value="saved">⭐ Saved</option>
            <option value="contacted">📨 Contacted</option>
            <option value="rejected">✖ Rejected</option>
          </select>
          <select className="filter-select" value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ marginLeft: 'auto' }}>
            <option value="overall_investor_fit_score">Sort: Overall Score</option>
            <option value="real_estate_interest_score">Sort: RE Interest</option>
            <option value="confidence_score">Sort: Confidence</option>
            <option value="contact_availability_score">Sort: Contactability</option>
          </select>
        </div>

        {/* Table */}
        {loading ? (
          <div className="loading-center">
            <div className="spinner spinner-lg" />
            <span style={{ color: 'var(--text-muted)' }}>
              {searchStatus === 'pending' || searchStatus === 'running' 
                ? `Processing search... (${searchStatus})` 
                : 'Loading investors…'}
            </span>
          </div>
        ) : investors.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🔍</div>
            <div className="empty-title">No investors found</div>
            <div className="empty-text">Run a search to discover and rank investor leads.</div>
            <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={() => navigate('/search')}>🚀 Start a Search</button>
          </div>
        ) : (
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Investor</th>
                  <th>Type</th>
                  <th>Location</th>
                  <th>Overall Score</th>
                  <th>Confidence</th>
                  <th>Signal Tags</th>
                  <th>Shortlist</th>
                </tr>
              </thead>
              <tbody>
                {investors.map((inv, idx) => {
                  const label = getScoreLabel(inv.overall_investor_fit_score);
                  const color = SCORE_COLORS[label];
                  return (
                    <tr key={inv._id} onClick={() => navigate(`/investors/${inv._id}`)}>
                      <td style={{ color: 'var(--text-muted)', fontWeight: 600, width: 36 }}>#{idx + 1}</td>
                      <td>
                        <div className="investor-name">{inv.person_full_name_cleaned}</div>
                        <div className="investor-title">{inv.standardized_job_title} · {inv.organization_name_cleaned}</div>
                      </td>
                      <td><InvestorTypeBadge type={inv.investor_type_classified} /></td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{inv.location_standardized || '—'}</td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <span className={`score-badge score-${label.toLowerCase()}`}>{inv.overall_investor_fit_score} · {label}</span>
                          <ScoreBar value={inv.overall_investor_fit_score} color={color} />
                        </div>
                      </td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600 }}>{inv.confidence_score}%</td>
                      <td>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {inv.real_estate_signal_detected && <span className="tag tag-re">🏘 RE</span>}
                          {inv.investment_language_detected && <span className="tag tag-inv">💰 INV</span>}
                          {inv.executive_role_detected && <span className="tag tag-exec">👔 EXEC</span>}
                        </div>
                      </td>
                      <td>
                        <ShortlistMenu investorId={inv._id} current={inv.shortlist_status} onUpdate={handleShortlistUpdate} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Load More Button */}
        {!loading && searchInfo && searchInfo.current_page < searchInfo.total_pages && (
          <div style={{ padding: '24px', textAlign: 'center', borderTop: '1px solid var(--border)' }}>
            <button 
              className="btn btn-primary" 
              onClick={handleLoadNextPage}
              disabled={loadingNextPage}
              style={{ minWidth: 180 }}
            >
              {loadingNextPage ? (
                <>
                  <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                  Loading...
                </>
              ) : (
                <>Load More ({searchInfo.total_apollo_results - (searchInfo.current_page * 10)} remaining)</>
              )}
            </button>
            <div style={{ marginTop: 12, fontSize: 13, color: 'var(--text-muted)' }}>
              Showing {Math.min(searchInfo.current_page * 10, searchInfo.total_apollo_results)} of {searchInfo.total_apollo_results} results
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
