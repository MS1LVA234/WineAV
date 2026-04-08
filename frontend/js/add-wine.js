// Add wine form
let currentUser = null;
let roomId = null;
let labelImageBase64 = null;

document.addEventListener('DOMContentLoaded', async () => {
  roomId = getParam('roomId');
  if (!roomId) { window.location.href = '/dashboard.html'; return; }

  currentUser = await checkAuth();
  if (!currentUser) return;

  document.getElementById('username-display').textContent = currentUser.username;
  document.getElementById('back-link').href = `/room.html?id=${roomId}`;

  await loadRoomMembers();
  setupLabelUpload();
  setupForm();
  setupLogout();
});

async function loadRoomMembers() {
  try {
    const data = await apiCall('GET', `/rooms/${roomId}`);
    if (!data) return;

    document.getElementById('room-name-header').textContent = data.room.name;
    document.title = `Adicionar Vinho – ${data.room.name}`;

    const select = document.getElementById('chosen_by');
    select.innerHTML = '<option value="">— Nenhum —</option>';
    data.members.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = m.username;
      if (m.id === currentUser.id) opt.textContent += ' (eu)';
      select.appendChild(opt);
    });
  } catch (err) {
    showToast(err.message, 'error');
  }
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
    preview.src = '';
    preview.style.display = 'none';
    placeholder.style.display = 'block';
    removeBtn.classList.add('d-none');
    input.value = '';
  });
}

function setupForm() {
  const form = document.getElementById('addWineForm');
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
      image: labelImageBase64 || null
    };

    try {
      const data = await apiCall('POST', `/rooms/${roomId}/wines`, payload);
      if (data) {
        showToast('Vinho adicionado com sucesso!');
        setTimeout(() => { window.location.href = `/room.html?id=${roomId}`; }, 800);
      }
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.remove('d-none');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<span>🍾</span> Adicionar Vinho';
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
