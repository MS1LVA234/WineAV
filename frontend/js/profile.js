document.addEventListener('DOMContentLoaded', async () => {
  const user = await checkAuth();
  if (!user) return;

  document.getElementById('profile-username').value = user.username || '';
  document.getElementById('profile-email').value = user.email || '';

  setupInfoForm();
  setupPasswordChange();
});

function setupInfoForm() {
  const form = document.getElementById('profile-info-form');
  const errEl = document.getElementById('info-error');
  const successEl = document.getElementById('info-success');
  const btn = document.getElementById('info-save-btn');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errEl.classList.add('d-none');
    successEl.classList.add('d-none');

    const username = document.getElementById('profile-username').value.trim();
    const email = document.getElementById('profile-email').value.trim();

    btn.disabled = true;
    btn.textContent = 'A guardar...';

    try {
      await apiCall('PUT', '/auth/profile/info', { username, email });
      successEl.classList.remove('d-none');
      // Atualizar sessionStorage com novos dados
      const user = JSON.parse(sessionStorage.getItem('wineav_user') || '{}');
      user.username = username;
      user.email = email;
      sessionStorage.setItem('wineav_user', JSON.stringify(user));
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.remove('d-none');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Guardar Dados';
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
