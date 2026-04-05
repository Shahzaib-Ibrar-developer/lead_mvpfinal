import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { submitSearch, getSearches, replaySearch } from '../services/api';

const INVESTOR_TYPES = ['', 'family_office', 'private_investor', 'real_estate_operator', 'fund_manager'];
const CHECK_SIZES = ['$100K', '$250K', '$500K', '$1M', '$2M', '$5M', '$10M', '$25M', '$50M+'];

function Toast({ msg, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, [onClose]);
  return <div className={`toast toast-${type}`}><span>{msg}</span><button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', marginLeft: 8 }}>✕</button></div>;
}

export default function SearchPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    investor_type_filter: '',
    target_geography: '',
    company_industry_filter: '',
    job_title_keywords: '',
    minimum_estimated_check_size: '',
    maximum_estimated_check_size: '',
    real_estate_interest_keywords: '',
    search_notes_optional: ''
  });
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [toast, setToast] = useState(null);

  const loadHistory = async () => {
    try { const r = await getSearches(); setHistory(r.data); } catch {}
  };

  useEffect(() => { loadHistory(); }, []);

  // Poll for running searches
  useEffect(() => {
    const hasRunning = history.some(h => ['pending', 'running'].includes(h.status));
    if (!hasRunning) return;
    const t = setInterval(loadHistory, 2500);
    return () => clearInterval(t);
  }, [history]);

  const handleChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async e => {
    e.preventDefault();
    setLoading(true);
    try {
      const r = await submitSearch(form);
      setToast({ msg: '✅ Search started! Processing investors…', type: 'success' });
      setForm({ investor_type_filter: '', target_geography: '', company_industry_filter: '', job_title_keywords: '', minimum_estimated_check_size: '', maximum_estimated_check_size: '', real_estate_interest_keywords: '', search_notes_optional: '' });
      loadHistory();
      // After 3s, navigate to dashboard with this search
      setTimeout(() => navigate(`/dashboard?search_id=${r.data.search_request_id}`), 3000);
    } catch (err) {
      setToast({ msg: `❌ ${err.response?.data?.error || 'Submission failed'}`, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleReplay = async (id) => {
    try {
      await replaySearch(id);
      setToast({ msg: '🔄 Search replayed!', type: 'info' });
      loadHistory();
    } catch { setToast({ msg: '❌ Replay failed', type: 'error' }); }
  };

  const statusClass = s => ({ pending: 'hs-pending', running: 'hs-running', completed: 'hs-completed', failed: 'hs-failed' }[s] || 'hs-pending');

  return (
    <div className="container">
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      <div className="page-header">
        <h1 className="page-title">Discover <span>Investor Leads</span></h1>
        <p className="page-subtitle">Configure your search criteria — our AI will rank and score every result.</p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="search-hero">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
            <span style={{ fontSize: 22 }}>🎯</span>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 17, color: 'var(--text-primary)' }}>Search Configuration</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Powered by B2B Data · Scored by AI</div>
            </div>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Investor Type</label>
              <select name="investor_type_filter" value={form.investor_type_filter} onChange={handleChange} className="form-select">
                <option value="">All Types</option>
                {INVESTOR_TYPES.filter(Boolean).map(t => (
                  <option key={t} value={t}>{t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Target Geography</label>
              <input name="target_geography" value={form.target_geography} onChange={handleChange} className="form-input" placeholder="e.g. New York, United States" />
            </div>

            <div className="form-group">
              <label className="form-label">Company Industry</label>
              <input name="company_industry_filter" value={form.company_industry_filter} onChange={handleChange} className="form-input" placeholder="e.g. Real Estate, Private Equity" />
            </div>

            <div className="form-group">
              <label className="form-label">Job Title Keyword</label>
              <input name="job_title_keywords" value={form.job_title_keywords} onChange={handleChange} className="form-input" placeholder="e.g. CEO, Managing Director, CIO" />
            </div>
          </div>

          <div className="search-divider">Investment Range</div>

          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Min. Check Size</label>
              <select name="minimum_estimated_check_size" value={form.minimum_estimated_check_size} onChange={handleChange} className="form-select">
                <option value="">No Minimum</option>
                {CHECK_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Max. Check Size</label>
              <select name="maximum_estimated_check_size" value={form.maximum_estimated_check_size} onChange={handleChange} className="form-select">
                <option value="">No Maximum</option>
                {CHECK_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label">Real Estate Interest Keyword</label>
              <input name="real_estate_interest_keywords" value={form.real_estate_interest_keywords} onChange={handleChange} className="form-input" placeholder="e.g. multifamily, commercial, REIT, development, acquisitions" />
            </div>
          </div>

          <div className="search-divider">Optional</div>

          <div className="form-group">
            <label className="form-label">Search Notes</label>
            <textarea name="search_notes_optional" value={form.search_notes_optional} onChange={handleChange} className="form-textarea" placeholder="Additional context for this search " />
          </div>

          <div style={{ marginTop: 28, display: 'flex', gap: 12, alignItems: 'center' }}>
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ minWidth: 180 }}>
              {loading ? <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Submitting…</> : <><span>🚀</span> Run Investor Search</>}
            </button>
            <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Results will be ready in ~10–30 seconds</span>
          </div>
        </div>
      </form>

      {/* Search History */}
      {history.length > 0 && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">🕐 Recent Searches</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Auto-refreshes when processing</span>
          </div>
          {history.map(h => (
            <div key={h._id} className="history-item">
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span className={`history-status ${statusClass(h.status)}`}>
                    {['pending','running'].includes(h.status) && <span className="pulse-dot" />}
                    {h.status.charAt(0).toUpperCase() + h.status.slice(1)}
                  </span>
                  {h.status === 'completed' && (
                    <span style={{ fontSize: 12, color: '#4A90E2' }}>{h.results_count} unique leads</span>
                  )}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  {[h.investor_type_filter, h.target_geography, h.company_industry_filter].filter(Boolean).join(' · ') || 'General search'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  {new Date(h.created_at).toLocaleString()}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {h.status === 'completed' && (
                  <button className="btn btn-sm btn-secondary" onClick={() => navigate(`/dashboard?search_id=${h._id}`)}>
                    📊 View Results
                  </button>
                )}
                <button className="btn btn-sm btn-ghost" onClick={() => handleReplay(h._id)} title="Replay Search">
                  🔄 Replay
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
