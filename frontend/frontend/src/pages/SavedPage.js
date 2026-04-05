import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getInvestors, updateShortlist } from '../services/api';

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

export default function SavedPage() {
  const navigate = useNavigate();
  const [investors, setInvestors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('saved');

  const loadInvestors = async (status) => {
    setLoading(true);
    try {
      const params = { shortlist_status: status, sort_by: 'overall_investor_fit_score' };
      const r = await getInvestors(params);
      setInvestors(r.data.investors || []);
    } catch { setInvestors([]); }
    setLoading(false);
  };

  useEffect(() => {
    loadInvestors(activeTab);
  }, [activeTab]);

  const handleStatusChange = async (id, newStatus) => {
    try {
      await updateShortlist(id, newStatus);
      setInvestors(prev => prev.filter(i => i._id !== id));
    } catch {}
  };

  const stats = {
    saved: investors.filter(i => i.shortlist_status === 'saved').length,
    contacted: investors.filter(i => i.shortlist_status === 'contacted').length,
    rejected: investors.filter(i => i.shortlist_status === 'rejected').length
  };

  const tabs = [
    { value: 'saved', label: '⭐ Saved', count: stats.saved },
    { value: 'contacted', label: '📨 Contacted', count: stats.contacted },
    { value: 'rejected', label: '✖ Rejected', count: stats.rejected }
  ];

  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">Saved <span>Investors</span></h1>
        <p className="page-subtitle">Your shortlisted prospects across all searches.</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, borderBottom: '2px solid var(--border)' }}>
        {tabs.map(tab => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            style={{
              padding: '12px 20px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === tab.value ? '2px solid var(--accent)' : '2px solid transparent',
              color: activeTab === tab.value ? 'var(--accent)' : 'var(--text-secondary)',
              fontWeight: activeTab === tab.value ? 600 : 400,
              fontSize: 14,
              cursor: 'pointer',
              marginBottom: -2,
              transition: 'all 0.2s'
            }}
          >
            {tab.label} {tab.count > 0 && `(${tab.count})`}
          </button>
        ))}
      </div>

      <div className="card">
        {loading ? (
          <div className="loading-center">
            <div className="spinner spinner-lg" />
            <span style={{ color: 'var(--text-muted)' }}>Loading investors…</span>
          </div>
        ) : investors.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              {activeTab === 'saved' && '⭐'}
              {activeTab === 'contacted' && '📨'}
              {activeTab === 'rejected' && '✖'}
            </div>
            <div className="empty-title">No {activeTab} investors</div>
            <div className="empty-text">
              {activeTab === 'saved' && 'Save investors from the dashboard to build your shortlist.'}
              {activeTab === 'contacted' && 'Mark investors as contacted to track your outreach.'}
              {activeTab === 'rejected' && 'Rejected investors will appear here.'}
            </div>
            <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={() => navigate('/dashboard')}>
              📊 Go to Dashboard
            </button>
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
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {investors.map((inv, idx) => {
                  const label = getScoreLabel(inv.overall_investor_fit_score);
                  const color = SCORE_COLORS[label];
                  return (
                    <tr key={inv._id} onClick={() => navigate(`/investors/${inv._id}`)} style={{ cursor: 'pointer' }}>
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
                      <td onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {activeTab !== 'saved' && (
                            <button className="btn btn-sm btn-ghost" onClick={() => handleStatusChange(inv._id, 'saved')} title="Save">
                              ⭐
                            </button>
                          )}
                          {activeTab !== 'contacted' && (
                            <button className="btn btn-sm btn-ghost" onClick={() => handleStatusChange(inv._id, 'contacted')} title="Mark Contacted">
                              📨
                            </button>
                          )}
                          {activeTab !== 'rejected' && (
                            <button className="btn btn-sm btn-ghost" onClick={() => handleStatusChange(inv._id, 'rejected')} title="Reject">
                              ✖
                            </button>
                          )}
                          <button className="btn btn-sm btn-ghost" onClick={() => handleStatusChange(inv._id, 'none')} title="Remove">
                            🗑
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
