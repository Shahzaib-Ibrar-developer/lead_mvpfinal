import React from 'react';
import { NavLink } from 'react-router-dom';

export default function Navbar() {
  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <NavLink to="/search" className="navbar-brand">
          <img src="/logo.png" alt="InvestorAI" style={{ height: 150, width: 'auto' }} />
        </NavLink>

        <div className="navbar-nav">
          <NavLink
            to="/search"
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          >
            <span>🔍</span> New Search
          </NavLink>
          <NavLink
            to="/dashboard"
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          >
            <span>📊</span> Dashboard
          </NavLink>
          <NavLink
            to="/saved"
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          >
            <span>⭐</span> Saved
          </NavLink>
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="navbar-badge">MVP</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>AI Investor Discovery</span>
        </div>
      </div>
    </nav>
  );
}
