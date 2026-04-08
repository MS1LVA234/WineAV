document.addEventListener('DOMContentLoaded', async () => {
  const user = await checkAuth();
  if (!user) return;

  // Mostrar username na navbar e no display
  const navbarUsername = document.getElementById('navbar-username');
  const currentDisplay = document.getElementById('current-username-display');
  if (navbarUsername) navbarUsername.textContent = user.username || '';
  if (currentDisplay) currentDisplay.textContent = user.username || '';

  setupUsernameEdit(user);
  setupPasswordChange();
});

function setupUsernameEdit(user) {
  const editBtn = document.getElementById('edit-username-btn');
  const cancelBtn = document.getElementById('info-cancel-btn');
  const saveBtn = document.getElementById('info-save-btn');
  const editArea = document.getElementById('username-edit-area');
  const input = document.getElementById('profile-username');
  const errEl = document.getElementById('info-error');
  const successEl = document.getElementById('info-success');
  const currentDisplay = document.getElementById('current-username-display');
  const navbarUsername = document.getElementById('navbar-username');

  editBtn.addEventListener('click', () => {
    input.value = currentDisplay.textContent;
    editArea.classList.remove('d-none');
    editBtn.classList.add('d-none');
    errEl.classList.add('d-none');
    successEl.classList.add('d-none');
    input.focus();
  });

  cancelBtn.addEventListener('click', () => {
    editArea.classList.add('d-none');
    editBtn.classList.remove('d-none');
    errEl.classList.add('d-none');
    successEl.classList.add('d-none');
  });

  saveBtn.addEventListener('click', async () => {
    errEl.classList.add('d-none');
    successEl.classList.add('d-none');

    const newUsername = input.value.trim();
    if (!newUsername || newUsername.length < 3) {
      errEl.textContent = 'O nome deve ter pelo menos 3 caracteres.';
      errEl.classList.remove('d-none');
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = 'A guardar...';

    try {
      const currentUser = JSON.parse(sessionStorage.getItem('wineav_user') || '{}');
      await apiCall('PUT', '/auth/profile/info', { username: newUsername, email: currentUser.email || user.email });
      // Atualizar displays
      currentDisplay.textContent = newUsername;
      if (navbarUsername) navbarUsername.textContent = newUsername;
      // Atualizar sessionStorage
      currentUser.username = newUsername;
      sessionStorage.setItem('wineav_user', JSON.stringify(currentUser));
      successEl.classList.remove('d-none');
      // Fechar área de edição após breve delay
      setTimeout(() => {
        editArea.classList.add('d-none');
        editBtn.classList.remove('d-none');
        successEl.classList.add('d-none');
      }, 1500);
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.remove('d-none');
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Confirmar';
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
