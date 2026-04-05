import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import SearchPage from './pages/SearchPage';
import DashboardPage from './pages/DashboardPage';
import InvestorDetailPage from './pages/InvestorDetailPage';
import SavedPage from './pages/SavedPage';

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-layout">
        <Navbar />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Navigate to="/search" replace />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/saved" element={<SavedPage />} />
            <Route path="/investors/:id" element={<InvestorDetailPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
