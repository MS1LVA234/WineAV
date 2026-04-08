// Edit wine form
let currentUser = null;
let wineId = null;
let roomId = null;
let labelImageBase64 = null;

document.addEventListener('DOMContentLoaded', async () => {
  wineId = getParam('wineId');
  roomId = getParam('roomId');
  if (!wineId || !roomId) { window.location.href = '/dashboard.html'; return; }

  currentUser = await checkAuth();
  if (!currentUser) return;

  document.getElementById('username-display').textContent = currentUser.username;
  document.getElementById('back-link').href = `/room.html?id=${roomId}`;

  await loadRoomAndWine();
  setupLabelUpload();
  setupForm();
  setupDelete();
  setupLogout();
});

async function loadRoomAndWine() {
  try {
    const [roomData, wineData] = await Promise.all([
      apiCall('GET', `/rooms/${roomId}`),
      apiCall('GET', `/rooms/${roomId}/wines/${wineId}`)
    ]);

    if (!roomData || !wineData) return;

    document.getElementById('room-name-header').textContent = roomData.room.name;
    document.title = `Editar Vinho – ${roomData.room.name}`;

    // Populate members select
    const select = document.getElementById('chosen_by');
    select.innerHTML = '<option value="">— Nenhum —</option>';
    roomData.members.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = m.username;
      if (m.id === currentUser.id) opt.textContent += ' (eu)';
      select.appendChild(opt);
    });

    // Fill form with wine data
    const w = wineData.wine;
    const form = document.getElementById('editWineForm');
    form.name.value = w.name || '';
    form.region.value = w.region || '';
    form.year.value = w.year || '';
    form.castas.value = w.castas || '';
    form.tempo_estagio.value = w.tempo_estagio || '';
    form.volume_alcool.value = w.volume_alcool || '';
    form.preco.value = w.preco || '';
    if (w.chosen_by) select.value = w.chosen_by;

    // Pre-populate image if exists
    if (w.image) {
      labelImageBase64 = w.image;
      const preview = document.getElementById('label-preview');
      const placeholder = document.getElementById('label-upload-placeholder');
      const removeBtn = document.getElementById('label-remove-btn');
      preview.src = w.image;
      preview.style.display = 'block';
      placeholder.style.display = 'none';
      removeBtn.classList.remove('d-none');
    }

    // Only show delete button to the user who added the wine
    if (w.added_by === currentUser.id) {
      document.getElementById('delete-btn').classList.remove('d-none');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function setupForm() {
  const form = document.getElementById('editWineForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type=submit]');
    const errEl = document.getElementById('form-error');
    errEl.classList.add('d-none');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> A guardar...';

    const payload = {
      name: form.name.value.trim(),
      region: form.region.value.trim() || null,
      year: form.year.value || null,
      castas: form.castas.value.trim() || null,
      tempo_estagio: form.tempo_estagio.value.trim() || null,
      volume_alcool: form.volume_alcool.value || null,
      preco: form.preco.value || null,
      chosen_by: form.chosen_by.value || null,
      image: labelImageBase64
    };

    try {
      const data = await apiCall('PUT', `/rooms/${roomId}/wines/${wineId}`, payload);
      if (data) {
        showToast('Vinho atualizado com sucesso!');
        setTimeout(() => { window.location.href = `/room.html?id=${roomId}`; }, 800);
      }
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.remove('d-none');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '💾 Guardar Alterações';
    }
  });
}

function setupDelete() {
  document.getElementById('delete-btn').addEventListener('click', () => {
    new bootstrap.Modal(document.getElementById('deleteConfirmModal')).show();
  });

  document.getElementById('confirm-delete-btn').addEventListener('click', async () => {
    const btn = document.getElementById('confirm-delete-btn');
    btn.disabled = true;
    btn.textContent = 'A eliminar...';
    try {
      await apiCall('DELETE', `/rooms/${roomId}/wines/${wineId}`);
      showToast('Vinho eliminado.');
      setTimeout(() => { window.location.href = `/room.html?id=${roomId}`; }, 800);
    } catch (err) {
      bootstrap.Modal.getInstance(document.getElementById('deleteConfirmModal')).hide();
      showToast(err.message, 'error');
      btn.disabled = false;
      btn.textContent = 'Eliminar';
    }
  });
}

function setupLabelUpload() {
  const input = document.getElementById('label-file-input');
  const preview = document.getElementById('label-preview');
  const placeholder = document.getElementById('label-upload-placeholder');
  const removeBtn = document.getElementById('label-remove-btn');

  input.addEventListener('change', () => {
    const file = input.files[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      showToast('A imagem deve ter menos de 3MB.', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      labelImageBase64 = e.target.result;
      preview.src = labelImageBase64;
      preview.style.display = 'block';
      placeholder.style.display = 'none';
      removeBtn.classList.remove('d-none');
    };
    reader.readAsDataURL(file);
  });

  removeBtn.addEventListener('click', () => {
    labelImageBase64 = null;
    preview.src = ''; preview.style.display = 'none';
    placeholder.style.display = 'block';
    removeBtn.classList.add('d-none');
    input.value = '';
  });
}

function setupLogout() {
  document.getElementById('logoutBtn').addEventListener('click', async () => {
    await apiCall('POST', '/auth/logout');
    clearUser();
    window.location.href = '/index.html';
  });
}
