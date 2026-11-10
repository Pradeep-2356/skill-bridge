/**
 * API calls grouped by feature. Each returns { data, meta } from the envelope.
 * Components never build URLs themselves, so the API surface lives in one file.
 */
import { api, request } from '../services/apiClient.js';

export const authApi = {
  forgotPassword: (email) => request(api.post('/auth/forgot-password', { email })),
  resetPassword: (body) => request(api.post('/auth/reset-password', body)),
  changePassword: (body) => request(api.patch('/auth/password', body)),
};

export const profileApi = {
  me: () => request(api.get('/users/me')),
  update: (changes) => request(api.patch('/users/me', changes)),
  uploadAvatar: (file) => {
    const form = new FormData();
    form.append('avatar', file);
    return request(api.put('/users/me/avatar', form, { headers: { 'Content-Type': 'multipart/form-data' } }));
  },
  removeAvatar: () => request(api.delete('/users/me/avatar')),
  preview: () => request(api.get('/users/me/preview')),
  publicProfile: (id) => request(api.get(`/users/${id}`)),
  deactivate: (password) => request(api.post('/users/me/deactivate', { password })),
  deleteAccount: (body) => request(api.delete('/users/me', { data: body })),
};

export const skillsApi = {
  categories: () => request(api.get('/categories')),
  catalog: (params) => request(api.get('/skills', { params })),
  mine: () => request(api.get('/users/me/skills')),
  add: (kind, body) => request(api.post(`/users/me/${kind}-skills`, body)),
  update: (kind, entryId, body) => request(api.patch(`/users/me/${kind}-skills/${entryId}`, body)),
  remove: (kind, entryId) => request(api.delete(`/users/me/${kind}-skills/${entryId}`)),
  suggest: (params) => request(api.get('/skills/suggest', { params })),
  related: (id) => request(api.get(`/skills/${id}/related`)),
};

export const availabilityApi = {
  get: () => request(api.get('/users/me/availability')),
  save: (body) => request(api.put('/users/me/availability', body)),
};

export const dashboardApi = {
  get: () => request(api.get('/dashboard')),
};

export const sessionsApi = {
  list: (params) => request(api.get('/sessions', { params })),
};

export const searchApi = {
  mentors: (params) => request(api.get('/search/mentors', { params })),
};

export const adminApi = {
  users: (params) => request(api.get('/admin/users', { params })),
  user: (id) => request(api.get(`/admin/users/${id}`)),
  setStatus: (id, body) => request(api.patch(`/admin/users/${id}/status`, body)),
};
