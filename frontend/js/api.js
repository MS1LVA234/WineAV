// Shared API utility for WineAV
const API_BASE = '/api';

async function apiCall(method, endpoint, data = null) {
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include'
  };

  if (data !== null) {
    options.body = JSON.stringify(data);
  }

  const res = await fetch(API_BASE + endpoint, options);

  if (res.status === 401) {
    sessionStorage.removeItem('wineav_user');
    window.location.href = '/index.html';
    return null;
  }

  const json = await res.json();

  if (!res.ok) {
    throw new Error(json.error || 'Erro desconhecido');
  }

  return json;
}

function getUser() {
  const u = sessionStorage.getItem('wineav_user');
  return u ? JSON.parse(u) : null;
}

function setUser(user) {
  sessionStorage.setItem('wineav_user', JSON.stringify(user));
}

function clearUser() {
  sessionStorage.removeItem('wineav_user');
}

async function checkAuth() {
  try {
    const data = await apiCall('GET', '/auth/me');
    if (data && data.user) {
      setUser(data.user);
      return data.user;
    }
    window.location.href = '/index.html';
    return null;
  } catch {
    window.location.href = '/index.html';
    return null;
  }
}

function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const id = 'toast-' + Date.now();
  const bg = type === 'success' ? 'bg-success' : 'bg-danger';
  container.insertAdjacentHTML('beforeend', `
    <div id="${id}" class="toast align-items-center text-white ${bg} border-0" role="alert" aria-atomic="true">
      <div class="d-flex">
        <div class="toast-body">${message}</div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
      </div>
    </div>
  `);
  const el = document.getElementById(id);
  new bootstrap.Toast(el, { delay: 3500 }).show();
  el.addEventListener('hidden.bs.toast', () => el.remove());
}

function getParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function starsFromRating(rating) {
  if (rating === null || rating === undefined) return '';
  const full = Math.floor(rating / 2);
  const half = (rating % 2) >= 1 ? 1 : 0;
  const empty = 5 - full - half;
  return '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(empty);
}
