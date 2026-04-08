document.addEventListener('DOMContentLoaded', async () => {
  const user = await checkAuth();
  if (!user) return;

  document.getElementById('navbar-username').textContent = user.username || '';
  document.getElementById('current-username-display').textContent = user.username || '';
  document.getElementById('current-email-display').textContent = user.email || '';

  setupToggle('username');
  setupToggle('email');
  setupToggle('password');

  setupSaveUsername();
  setupSaveEmail();
  setupSavePassword();
});

function setupToggle(name) {
  const btn = document.getElementById(`btn-toggle-${name}`);
  const form = document.getElementById(`form-${name}`);
  const arrow = document.getElementById(`arrow-${name}`);
  const cancel = document.getElementById(`cancel-${name}`);

  btn.addEventListener('click', () => {
    const isOpen = !form.classList.contains('d-none');
    ['username', 'email', 'password'].forEach(n => {
      document.getElementById(`form-${n}`).classList.add('d-none');
      document.getElementById(`arrow-${n}`).textContent = '▼';
    });
    if (!isOpen) {
      form.classList.remove('d-none');
      arrow.textContent = '▲';
    }
  });

  cancel.addEventListener('click', () => {
    form.classList.add('d-none');
    arrow.textContent = '▼';
    document.getElementById(`err-${name}`).classList.add('d-none');
    document.getElementById(`ok-${name}`).classList.add('d-none');
  });
}

function setupSaveUsername() {
  const saveBtn = document.getElementById('save-username');
  const input = document.getElementById('input-username');
  const errEl = document.getElementById('err-username');
  const okEl = document.getElementById('ok-username');
  const display = document.getElementById('current-username-display');
  const navbar = document.getElementById('navbar-username');

  document.getElementById('btn-toggle-username').addEventListener('click', () => {
    if (document.getElementById('form-username').classList.contains('d-none')) return;
    input.value = display.textContent;
    input.focus();
  });

  saveBtn.addEventListener('click', async () => {
    errEl.classList.add('d-none');
    okEl.classList.add('d-none');
    const val = input.value.trim();
    if (val.length < 3) {
      errEl.textContent = 'O nome deve ter pelo menos 3 caracteres.';
      errEl.classList.remove('d-none');
      return;
    }
    saveBtn.disabled = true; saveBtn.textContent = 'A guardar...';
    try {
      await apiCall('PUT', '/auth/profile/info', { username: val });
      display.textContent = val;
      navbar.textContent = val;
      const u = JSON.parse(sessionStorage.getItem('wineav_user') || '{}');
      u.username = val;
      sessionStorage.setItem('wineav_user', JSON.stringify(u));
      okEl.classList.remove('d-none');
      setTimeout(() => { document.getElementById('cancel-username').click(); }, 1500);
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.remove('d-none');
    } finally {
      saveBtn.disabled = false; saveBtn.textContent = 'Confirmar';
    }
  });
}

function setupSaveEmail() {
  const saveBtn = document.getElementById('save-email');
  const input = document.getElementById('input-email');
  const errEl = document.getElementById('err-email');
  const okEl = document.getElementById('ok-email');
  const display = document.getElementById('current-email-display');

  document.getElementById('btn-toggle-email').addEventListener('click', () => {
    if (document.getElementById('form-email').classList.contains('d-none')) return;
    input.value = display.textContent;
    input.focus();
  });

  saveBtn.addEventListener('click', async () => {
    errEl.classList.add('d-none');
    okEl.classList.add('d-none');
    const val = input.value.trim();
    if (!val.includes('@')) {
      errEl.textContent = 'Introduz um email valido.';
      errEl.classList.remove('d-none');
      return;
    }
    saveBtn.disabled = true; saveBtn.textContent = 'A guardar...';
    try {
      await apiCall('PUT', '/auth/profile/info', { email: val });
      display.textContent = val;
      const u = JSON.parse(sessionStorage.getItem('wineav_user') || '{}');
      u.email = val;
      sessionStorage.setItem('wineav_user', JSON.stringify(u));
      okEl.classList.remove('d-none');
      setTimeout(() => { document.getElementById('cancel-email').click(); }, 1500);
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.remove('d-none');
    } finally {
      saveBtn.disabled = false; saveBtn.textContent = 'Confirmar';
    }
  });
}

function setupSavePassword() {
  const saveBtn = document.getElementById('save-password');
  const errEl = document.getElementById('err-password');
  const okEl = document.getElementById('ok-password');

  saveBtn.addEventListener('click', async () => {
    errEl.classList.add('d-none');
    okEl.classList.add('d-none');
    const current = document.getElementById('current-password').value;
    const newPw = document.getElementById('new-password').value;
    const confirm = document.getElementById('confirm-password').value;
    if (!current || !newPw) {
      errEl.textContent = 'Preenche todos os campos.';
      errEl.classList.remove('d-none');
      return;
    }
    if (newPw !== confirm) {
      errEl.textContent = 'As passwords nao coincidem.';
      errEl.classList.remove('d-none');
      return;
    }
    saveBtn.disabled = true; saveBtn.textContent = 'A guardar...';
    try {
      await apiCall('PUT', '/auth/profile/password', { currentPassword: current, newPassword: newPw });
      okEl.classList.remove('d-none');
      document.getElementById('current-password').value = '';
      document.getElementById('new-password').value = '';
      document.getElementById('confirm-password').value = '';
      setTimeout(() => { document.getElementById('cancel-password').click(); }, 1500);
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.remove('d-none');
    } finally {
      saveBtn.disabled = false; saveBtn.textContent = 'Confirmar';
    }
  });
}
