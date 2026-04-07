document.addEventListener('DOMContentLoaded', async () => {
  const user = await checkAuth();
  if (!user) return;

  document.getElementById('profile-username').textContent = user.username;
  document.getElementById('profile-email').textContent = user.email || '';
  if (user.avatar) {
    document.getElementById('avatar-preview').src = user.avatar;
  }

  setupAvatarUpload();
  setupPasswordChange();
});

function setupAvatarUpload() {
  const input = document.getElementById('avatar-input');
  const preview = document.getElementById('avatar-preview');
  const saveBtn = document.getElementById('avatar-save-btn');
  const errEl = document.getElementById('avatar-error');
  let pendingAvatar = null;

  input.addEventListener('change', () => {
    const file = input.files[0];
    if (!file) return;

    if (file.size > 300 * 1024) {
      errEl.textContent = 'Imagem demasiado grande. Máximo 300KB.';
      errEl.classList.remove('d-none');
      return;
    }

    errEl.classList.add('d-none');
    const reader = new FileReader();
    reader.onload = (e) => {
      pendingAvatar = e.target.result;
      preview.src = pendingAvatar;
      saveBtn.classList.remove('d-none');
    };
    reader.readAsDataURL(file);
  });

  saveBtn.addEventListener('click', async () => {
    if (!pendingAvatar) return;
    saveBtn.disabled = true;
    saveBtn.textContent = 'A guardar...';
    errEl.classList.add('d-none');

    try {
      await apiCall('PUT', '/auth/profile/avatar', { avatar: pendingAvatar });
      showToast('Foto atualizada!');
      saveBtn.classList.add('d-none');
      pendingAvatar = null;
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.remove('d-none');
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Guardar foto';
    }
  });
}

function setupPasswordChange() {
  const form = document.getElementById('change-password-form');
  const errEl = document.getElementById('pw-error');
  const successEl = document.getElementById('pw-success');
  const btn = document.getElementById('pw-save-btn');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errEl.classList.add('d-none');
    successEl.classList.add('d-none');

    const currentPassword = document.getElementById('current-password').value;
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;

    if (newPassword !== confirmPassword) {
      errEl.textContent = 'As passwords não coincidem.';
      errEl.classList.remove('d-none');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'A alterar...';

    try {
      await apiCall('PUT', '/auth/profile/password', { currentPassword, newPassword });
      successEl.classList.remove('d-none');
      form.reset();
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.remove('d-none');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Alterar Password';
    }
  });
}
