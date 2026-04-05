import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getInvestor, updateShortlist, revealPhone } from '../services/api';

function getScoreLabel(score) {
  if (score >= 80) return 'Excellent';
  if (score >= 65) return 'Strong';
  if (score >= 50) return 'Moderate';
  if (score >= 35) return 'Low';
  return 'Weak';
}

function ScoreRow({ label, value, weight, color }) {
  // Use bright colors: gold, blue, silver gradient
  const getColor = (val) => {
    if (val >= 80) return '#FFD700'; // Gold
    if (val >= 60) return '#4A90E2'; // Blue
    if (val >= 40) return '#C0C0C0'; // Silver
    return '#808080'; // Gray
  };
  const c = color || getColor(value);
  return (
    <div className="score-row">
      <div className="score-row-label">{label} <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>({weight})</span></div>
      <div className="score-row-bar"><div className="score-row-fill" style={{ width: `${value}%`, background: c }} /></div>
      <div className="score-row-val" style={{ color: c }}>{value}</div>
    </div>
  );
}

function InvestorTypeBadge({ type }) {
  const labels = { family_office: '🏛 Family Office', fund_manager: '📈 Fund Manager', real_estate_operator: '🏗 RE Operator', private_investor: '💼 Private Investor', unknown: '❓ Unknown' };
  return <span className={`investor-type-badge type-${type}`}>{labels[type] || type}</span>;
}

export default function InvestorDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [shortlistStatus, setShortlistStatus] = useState('none');
  const [rawExpanded, setRawExpanded] = useState(false);
  const [toast, setToast] = useState(null);
  const [revealingPhone, setRevealingPhone] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      try {
        const r = await getInvestor(id);
        if (cancelled) return;

        console.log('📊 Investor data loaded:', { 
          phone: r.data.phone_ready ? 'Ready' : 'Not available',
          enriched: r.data.raw_apollo_data?.enriched 
        });

        setData(r.data);
        setShortlistStatus(r.data.profile?.shortlist_status || 'none');
        setLoading(false);
      } catch (err) {
        console.error('Error loading investor:', err);
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleShortlist = async (val) => {
    try {
      await updateShortlist(id, val);
      setShortlistStatus(val);
      setToast({ msg: `Status updated: ${val}`, type: 'success' });
      setTimeout(() => setToast(null), 2500);
    } catch { setToast({ msg: 'Update failed', type: 'error' }); }
  };

  const handleRevealPhone = async () => {
    setRevealingPhone(true);
    try {
      const response = await revealPhone(id);
      if (response.data.success) {
        // Update data with new phone
        setData(prev => ({
          ...prev,
          raw_apollo_data: {
            ...prev.raw_apollo_data,
            actual_phone: response.data.phone,
            enriched: true
          },
          phone_ready: true
        }));
        setToast({ msg: 'Phone number revealed!', type: 'success' });
      } else if (response.data.enriching) {
        setToast({ msg: 'Phone enrichment in progress, please wait...', type: 'info' });
        // Poll for updates
        setTimeout(() => {
          getInvestor(id).then(r => {
            setData(r.data);
            if (r.data.phone_ready) {
              setToast({ msg: 'Phone number revealed!', type: 'success' });
            }
          });
        }, 5000);
      }
    } catch (err) {
      setToast({ msg: 'Failed to reveal phone', type: 'error' });
    } finally {
      setRevealingPhone(false);
      setTimeout(() => setToast(null), 3000);
    }
  };

  if (loading) return (
    <div className="container">
      <div className="loading-center">
        <div className="spinner spinner-lg" />
        <p style={{ marginTop: 16, color: 'var(--text-muted)', fontSize: 14 }}>
          Loading investor profile...
        </p>
      </div>
    </div>
  );
  if (!data) return (
    <div className="container"><div className="empty-state"><div className="empty-icon">❌</div><div className="empty-title">Investor not found</div><button className="btn btn-primary" style={{ marginTop: 20 }} onClick={() => navigate('/dashboard')}>← Back to Dashboard</button></div></div>
  );

  const { profile, enriched, raw_apollo_data } = data;
  const scoreLabel = getScoreLabel(enriched?.overall_investor_fit_score || 0);

  const SHORTLIST_OPTIONS = [
    { value: 'saved', label: '⭐ Save', active: 'var(--gold)' },
    { value: 'contacted', label: '📨 Contacted', active: 'var(--blue)' },
    { value: 'rejected', label: '✖ Rejected', active: '#808080' },
    { value: 'none', label: '— Clear', active: 'var(--text-muted)' }
  ];

  return (
    <div className="container">
      {toast && (
        <div className={`toast toast-${toast.type}`}>{toast.msg}</div>
      )}

      {/* Back + breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, fontSize: 13, color: 'var(--text-muted)' }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}>← Back</button>
        <span>/</span><span>Investor Detail</span>
      </div>

      {/* Hero header */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ padding: '28px 28px 24px', display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          {/* Avatar */}
          <div style={{
            width: 72, height: 72, borderRadius: 20, flexShrink: 0,
            background: 'linear-gradient(135deg, var(--accent), var(--purple))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28, fontWeight: 800, color: '#fff', fontFamily: 'var(--font-display)'
          }}>
            {(profile?.person_full_name_cleaned || '?')[0]}
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
              <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>
                {profile?.person_full_name_cleaned}
              </h1>
              <InvestorTypeBadge type={profile?.investor_type_classified} />
            </div>
            <div style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 10 }}>
              {profile?.standardized_job_title} · <strong style={{ color: 'var(--text-primary)' }}>{profile?.organization_name_cleaned}</strong>
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              {profile?.location_standardized && (
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>📍 {profile.location_standardized}</span>
              )}
              {profile?.linkedin_url && (
                <a href={profile.linkedin_url} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm" style={{ fontSize: 12.5 }} onClick={e => e.stopPropagation()}>
                  🔗 LinkedIn
                </a>
              )}
              {enriched?.estimated_investment_capacity_range && (
                <span style={{ fontSize: 13, background: 'var(--gold-subtle)', color: 'var(--gold)', padding: '3px 10px', borderRadius: 6, fontWeight: 600 }}>
                  💰 {enriched.estimated_investment_capacity_range}
                </span>
              )}
            </div>
          </div>

          {/* Score highlight */}
          <div style={{ textAlign: 'center', padding: '16px 24px', background: 'var(--bg-elevated)', borderRadius: 16, border: '1px solid var(--border-strong)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 4 }}>Investor Fit</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 48, fontWeight: 800, lineHeight: 1, color: scoreLabel === 'Excellent' ? '#FFD700' : scoreLabel === 'Strong' ? '#4A90E2' : scoreLabel === 'Moderate' ? '#C0C0C0' : '#808080' }}>
              {enriched?.overall_investor_fit_score || 0}
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginTop: 4 }}>{scoreLabel}</div>
          </div>
        </div>

        {/* Shortlist bar */}
        <div style={{ padding: '14px 28px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 12.5, color: 'var(--text-muted)', marginRight: 8 }}>Shortlist Status:</span>
          {SHORTLIST_OPTIONS.map(opt => (
            <button key={opt.value} className={`btn btn-sm ${shortlistStatus === opt.value ? 'btn-primary' : 'btn-ghost'}`}
              style={shortlistStatus === opt.value ? { background: opt.active === 'var(--text-muted)' ? 'var(--bg-elevated)' : undefined } : {}}
              onClick={() => handleShortlist(opt.value)}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main detail grid */}
      <div className="detail-grid">
        <div>
          {/* AI Summary */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header">
              <span className="card-title">🤖 AI Analysis</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Confidence: <strong style={{ color: 'var(--text-primary)' }}>{enriched?.confidence_score || 0}%</strong></span>
            </div>
            <div className="card-body">
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 20, fontSize: 14.5 }}>
                {enriched?.ai_generated_summary || 'No summary available.'}
              </p>

              {/* Why ranked */}
              {enriched?.reasoning_text && (
                <div style={{ background: 'var(--accent-subtle)', border: '1px solid var(--accent-glow)', borderRadius: 10, padding: '14px 16px' }}>
                  <div style={{ fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--accent-light)', marginBottom: 8 }}>
                    🔥 Why This Investor Ranks Here
                  </div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: 13.5 }}>
                    {enriched.reasoning_text.split('·').map((r, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 4 }}>
                        <span style={{ color: 'var(--accent-light)', marginTop: 1 }}>✓</span>
                        <span>{r.trim()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Signal tags */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header"><span className="card-title">🔔 Signal Tags</span></div>
            <div className="card-body">
              <div className="signal-tags">
                <span className={`tag tag-re`} style={{ opacity: enriched?.real_estate_signal_detected ? 1 : 0.3, padding: '6px 14px', fontSize: 13 }}>
                  🏘 Real Estate Signal {enriched?.real_estate_signal_detected ? '✓' : '✗'}
                </span>
                <span className={`tag tag-inv`} style={{ opacity: enriched?.investment_language_detected ? 1 : 0.3, padding: '6px 14px', fontSize: 13 }}>
                  💰 Investment Language {enriched?.investment_language_detected ? '✓' : '✗'}
                </span>
                <span className={`tag tag-exec`} style={{ opacity: enriched?.executive_role_detected ? 1 : 0.3, padding: '6px 14px', fontSize: 13 }}>
                  👔 Executive Role {enriched?.executive_role_detected ? '✓' : '✗'}
                </span>
              </div>
            </div>
          </div>

          {/* Score breakdown */}
          <div className="card">
            <div className="card-header"><span className="card-title">📊 Score Breakdown</span></div>
            <div className="card-body">
              <div className="score-breakdown-grid">
                <ScoreRow label="Investment Capacity" value={enriched?.capital_capacity_score || 0} weight="30%" />
                <ScoreRow label="Real Estate Relevance" value={enriched?.real_estate_interest_score || 0} weight="25%" />
                <ScoreRow label="Decision-Making Power" value={enriched?.decision_making_power_score || 0} weight="15%" />
                <ScoreRow label="Geography Match" value={enriched?.geography_fit_score || 0} weight="10%" />
                <ScoreRow label="Contactability" value={profile?.contact_availability_score || 0} weight="10%" />
                <ScoreRow label="Data Confidence" value={enriched?.confidence_score || 0} weight="10%" />
              </div>
              <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Overall Investor Fit Score</span>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800, color: 'var(--accent-light)' }}>{enriched?.overall_investor_fit_score || 0} / 100</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right sidebar */}
        <div>
          {/* Contact panel */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header">
              <span className="card-title">📬 Contact & Availability</span>
              {raw_apollo_data?.enriched ? (
                <span style={{ fontSize: 11, color: '#4A90E2', fontWeight: 600 }}>✓ Enriched</span>
              ) : raw_apollo_data?.enrichment_requested ? (
                <span style={{ fontSize: 11, color: '#FFD700', fontWeight: 600 }}>⏳ Enriching...</span>
              ) : null}
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {raw_apollo_data?.enrichment_requested && !raw_apollo_data?.enriched && (
                <div style={{ 
                  padding: '10px 12px', 
                  background: 'var(--amber-subtle)', 
                  border: '1px solid var(--amber)', 
                  borderRadius: 8,
                  fontSize: 12,
                  color: 'var(--text-secondary)'
                }}>
                  ⏳ Contact enrichment in progress. Phone number will appear when available.
                </div>
              )}
              {raw_apollo_data?.actual_email ? (
                <div>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Email</span>
                  <a href={`mailto:${raw_apollo_data.actual_email}`} style={{ fontWeight: 600, fontSize: 13, color: 'var(--accent)' }}>
                    {raw_apollo_data.actual_email}
                  </a>
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Email Status</span>
                  <span style={{ fontWeight: 600, fontSize: 13, color: raw_apollo_data?.email_status === 'verified' ? '#4A90E2' : raw_apollo_data?.email_status === 'guessed' ? '#FFD700' : 'var(--text-muted)' }}>
                    {raw_apollo_data?.email_status || 'Unknown'}
                  </span>
                </div>
              )}
              
              {raw_apollo_data?.actual_phone ? (
                <div>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Phone</span>
                  <a href={`tel:${raw_apollo_data.actual_phone}`} style={{ fontWeight: 600, fontSize: 13, color: 'var(--accent)' }}>
                    {raw_apollo_data.actual_phone}
                  </a>
                </div>
              ) : raw_apollo_data?.phone_status ? (
                <div>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Phone</span>
                  <button 
                    className="btn btn-primary btn-sm" 
                    onClick={handleRevealPhone}
                    disabled={revealingPhone}
                    style={{ marginTop: 4 }}
                  >
                    {revealingPhone ? '⏳ Revealing...' : '📞 Reveal Phone Number'}
                  </button>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                    Status: {raw_apollo_data.phone_status}
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Phone Status</span>
                  <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-muted)' }}>
                    Unavailable
                  </span>
                </div>
              )}
              
              {raw_apollo_data?.actual_linkedin_url && (
                <div>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>LinkedIn</span>
                  <a href={raw_apollo_data.actual_linkedin_url} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 600, fontSize: 13, color: 'var(--accent)' }}>
                    View Profile →
                  </a>
                </div>
              )}
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Availability Score</span>
                <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, color: 'var(--accent-light)' }}>{profile?.contact_availability_score || 0}</span>
              </div>
            </div>
          </div>


        </div>
      </div>
    </div>
  );
}
