let currentUser = null;
let deleteTargetId = null;

document.addEventListener('DOMContentLoaded', async () => {
  currentUser = await checkAuth();
  if (!currentUser) return;

  if (currentUser.role !== 'admin') {
    window.location.href = '/dashboard.html';
    return;
  }

  await loadUsers();

  document.getElementById('confirm-delete-btn').addEventListener('click', confirmDelete);
});

async function loadUsers() {
  const list = document.getElementById('users-list');
  try {
    const data = await apiCall('GET', '/auth/admin/users');
    if (!data) return;

    document.getElementById('user-count').textContent = data.users.length + ' utilizadores';

    if (data.users.length === 0) {
      list.innerHTML = '<p class="text-muted text-center">Nenhum utilizador.</p>';
      return;
    }

    list.innerHTML = data.users.map(u => `
      <div class="d-flex align-items-center justify-content-between py-2 border-bottom" id="user-row-${u.id}">
        <div>
          <div class="fw-semibold">${escapeHtml(u.username)}
            ${u.role === 'admin' ? '<span class="badge ms-1" style="background:var(--wine-gold);color:#000;">Admin</span>' : ''}
          </div>
          <small class="text-muted">${escapeHtml(u.email)}</small><br>
          <small class="text-muted">Registado em ${new Date(u.created_at).toLocaleDateString('pt-PT')}</small>
        </div>
        <div class="d-flex gap-2">
          ${u.id !== currentUser.id ? `
            <button class="btn btn-sm ${u.role === 'admin' ? 'btn-outline-secondary' : 'btn-outline-wine'}"
              onclick="toggleRole(${u.id}, '${u.role}', '${escapeHtml(u.username)}')"
              title="${u.role === 'admin' ? 'Remover Admin' : 'Tornar Admin'}">
              ${u.role === 'admin' ? '↓ User' : '↑ Admin'}
            </button>
            <button class="btn btn-sm btn-outline-danger"
              onclick="askDelete(${u.id}, '${escapeHtml(u.username)}')">
              🗑
            </button>
          ` : '<span class="text-muted small">Tu</span>'}
        </div>
      </div>
    `).join('');
  } catch (err) {
    list.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
  }
}

function askDelete(id, username) {
  deleteTargetId = id;
  document.getElementById('delete-username').textContent = username;
  new bootstrap.Modal(document.getElementById('deleteModal')).show();
}

async function confirmDelete() {
  if (!deleteTargetId) return;
  const btn = document.getElementById('confirm-delete-btn');
  btn.disabled = true;
  try {
    await apiCall('DELETE', `/auth/admin/users/${deleteTargetId}`);
    bootstrap.Modal.getInstance(document.getElementById('deleteModal')).hide();
    document.getElementById(`user-row-${deleteTargetId}`)?.remove();
    const count = document.querySelectorAll('[id^="user-row-"]').length;
    document.getElementById('user-count').textContent = count + ' utilizadores';
  } catch (err) {
    alert(err.message);
  } finally {
    btn.disabled = false;
    deleteTargetId = null;
  }
}

async function toggleRole(id, currentRole, username) {
  const newRole = currentRole === 'admin' ? 'user' : 'admin';
  if (!confirm(`${newRole === 'admin' ? 'Tornar' : 'Remover Admin de'} "${username}"?`)) return;
  try {
    await apiCall('PUT', `/auth/admin/users/${id}/role`, { role: newRole });
    await loadUsers();
  } catch (err) {
    alert(err.message);
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
