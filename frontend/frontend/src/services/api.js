import axios from 'axios';

const API = axios.create({ 
  baseURL: process.env.REACT_APP_API_URL || '/api'
});

// Search
export const submitSearch = (data) => API.post('/search', data);
export const getSearches = () => API.get('/search');
export const getSearch = (id) => API.get(`/search/${id}`);
export const replaySearch = (id) => API.post(`/search/${id}/replay`);
export const loadNextPage = (id, page) => API.post(`/search/${id}/load-page`, { page });

// Investors
export const getInvestors = (params) => API.get('/investors', { params });
export const getInvestor = (id) => API.get(`/investors/${id}`);

// Shortlist
export const updateShortlist = (id, status) => API.put(`/shortlist/${id}`, { status });

// Export
export const getExportUrl = (searchId) => {
  const baseURL = process.env.REACT_APP_API_URL || '/api';
  return searchId ? `${baseURL}/export?search_id=${searchId}` : `${baseURL}/export`;
};


// Reveal phone number for investor
export const revealPhone = (investorId) => API.post(`/investors/${investorId}/reveal-phone`);
