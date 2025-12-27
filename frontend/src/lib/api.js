import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Test Cases API
export const testCaseApi = {
  // Get all test cases with pagination (REST API)
  getAll: (page = 0, size = 20, category = '') => {
    const params = { page, size };
    if (category) params.category = category;
    return api.get('/api/cases', { params });
  },

  // Get single test case by ID (REST API)
  getById: (id) => api.get(`/api/cases/${id}`),

  // Create new test case (JSON)
  create: (data) => api.post('/api/cases', data, {
    headers: { 'Content-Type': 'application/json' }
  }),

  // Update test case (JSON)
  update: (id, data) => api.put(`/api/cases/${id}`, data, {
    headers: { 'Content-Type': 'application/json' }
  }),

  // Delete test case (REST API)
  delete: (id) => api.delete(`/api/cases/${id}`),

  // Get categories
  getCategories: () => api.get('/api/categories'),
};

// Migration API
export const migrationApi = {
  // Get migration stats
  getStats: () => api.get('/migration/stats'),

  // Migrate single file
  migrateSingle: (fileName) => api.post('/migration/single', null, { params: { fileName } }),

  // Migrate all files
  migrateAll: () => api.post('/migration/all'),

  // Delete case
  deleteCase: (fileName) => api.delete('/migration/case', { params: { fileName } }),

  // Delete all data
  deleteAll: () => api.delete('/migration/all'),
};

export default api;
