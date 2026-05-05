// Dashboard: list rooms, create room, join room
let currentUser = null;

document.addEventListener('DOMContentLoaded', async () => {
  currentUser = await checkAuth();
  if (!currentUser) return;

  document.getElementById('username-display').textContent = currentUser.username;
  if (currentUser.role === 'admin') {
    const adminLink = document.getElementById('admin-nav-link');
    if (adminLink) adminLink.classList.remove('d-none');
  }

  await loadRooms();
  setupCreateRoom();
  setupJoinRoom();
  setupLogout();
});

async function loadRooms() {
  const container = document.getElementById('rooms-list');
  container.innerHTML = '<div class="text-center py-4"><span class="spinner-border text-wine"></span></div>';

  try {
    const data = await apiCall('GET', '/rooms');
    if (!data) return;

    if (data.rooms.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🍷</div>
          <p class="fw-semibold">Ainda não tens salas</p>
          <p class="small">Cria uma nova sala ou entra com um código de convite.</p>
        </div>`;
      return;
    }

    container.innerHTML = '<div class="row">' + data.rooms.map(room => {
      const isCreator = currentUser && room.created_by === currentUser.id;
      const actionBtn = isCreator
        ? `<button class="btn btn-sm btn-outline-danger" onclick="event.stopPropagation();deleteRoom(${room.id},'${escapeHtml(room.name).replace(/'/g, "\\'")}')">🗑 Eliminar</button>`
        : `<button class="btn btn-sm btn-outline-secondary" onclick="event.stopPropagation();leaveRoom(${room.id},'${escapeHtml(room.name).replace(/'/g, "\\'")}')">🚪 Sair</button>`;
      return `
      <div class="col-12 col-sm-6">
        <div class="room-card card p-0 mb-3" onclick="window.location.href='/room.html?id=${room.id}'" style="cursor:pointer">
          <div class="room-icon">🍷</div>
          <div class="card-body pt-1">
            <h5 class="fw-700 mb-1">${escapeHtml(room.name)}</h5>
            <div class="d-flex gap-2 flex-wrap mb-2">
              <span class="badge bg-light text-dark border">👥 ${room.member_count} membros</span>
              <span class="badge bg-light text-dark border">🍾 ${room.wine_count} vinhos</span>
            </div>
            <div class="d-flex align-items-center justify-content-between">
              <small class="text-muted">Criada por ${escapeHtml(room.creator_name)}</small>
              <span class="invite-code" style="font-size:0.75rem;padding:2px 8px;">${room.invite_code}</span>
            </div>
            <div class="d-flex justify-content-end mt-2">
              ${actionBtn}
            </div>
          </div>
        </div>
      </div>`;
    }).join('') + '</div>';
  } catch (err) {
    container.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
  }
}

function setupCreateRoom() {
  const form = document.getElementById('createRoomForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type=submit]');
    const errEl = document.getElementById('createRoomError');
    errEl.classList.add('d-none');
    btn.disabled = true;

    try {
      const data = await apiCall('POST', '/rooms', { name: form.roomName.value.trim() });
      if (data && data.room) {
        bootstrap.Modal.getInstance(document.getElementById('createRoomModal')).hide();
        form.reset();
        showToast(`Sala "${data.room.name}" criada! Código: ${data.room.invite_code}`);
        await loadRooms();
      }
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.remove('d-none');
    } finally {
      btn.disabled = false;
    }
  });
}

function setupJoinRoom() {
  const form = document.getElementById('joinRoomForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type=submit]');
    const errEl = document.getElementById('joinRoomError');
    errEl.classList.add('d-none');
    btn.disabled = true;

    try {
      const data = await apiCall('POST', '/rooms/join', { invite_code: form.inviteCode.value.trim() });
      if (data && data.room) {
        bootstrap.Modal.getInstance(document.getElementById('joinRoomModal')).hide();
        form.reset();
        showToast(`Entraste na sala "${data.room.name}"!`);
        await loadRooms();
      }
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.remove('d-none');
    } finally {
      btn.disabled = false;
    }
  });
}

function setupLogout() {
  document.getElementById('logoutBtn').addEventListener('click', async () => {
    await apiCall('POST', '/auth/logout');
    clearUser();
    window.location.href = '/index.html';
  });
}

async function deleteRoom(id, name) {
  if (!confirm(`Tens a certeza que queres eliminar a sala "${name}"?\nTodos os vinhos e avaliações serão apagados.`)) return;
  try {
    await apiCall('DELETE', `/rooms/${id}`);
    showToast(`Sala "${name}" eliminada.`);
    await loadRooms();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

async function leaveRoom(id, name) {
  if (!confirm(`Queres sair da sala "${name}"?`)) return;
  try {
    await apiCall('DELETE', `/rooms/${id}/leave`);
    showToast(`Saíste da sala "${name}".`);
    await loadRooms();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
