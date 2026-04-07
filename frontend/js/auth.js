// Login and Register logic
document.addEventListener('DOMContentLoaded', async () => {
  // If already logged in, redirect to dashboard
  try {
    const data = await fetch('/api/auth/me', { credentials: 'include' });
    if (data.ok) {
      const json = await data.json();
      if (json.user) {
        setUser(json.user);
        window.location.href = '/dashboard.html';
        return;
      }
    }
  } catch {}

  setupLoginForm();
  setupRegisterForm();
});

function setupLoginForm() {
  const form = document.getElementById('loginForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type=submit]');
    const errEl = document.getElementById('loginError');
    errEl.classList.add('d-none');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> A entrar...';

    try {
      const data = await apiCall('POST', '/auth/login', {
        email: form.email.value.trim(),
        password: form.password.value
      });
      if (data && data.user) {
        setUser(data.user);
        window.location.href = '/dashboard.html';
      }
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.remove('d-none');
    } finally {
      btn.disabled = false;
      btn.innerHTML = 'Entrar';
    }
  });
}

function setupRegisterForm() {
  const form = document.getElementById('registerForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type=submit]');
    const errEl = document.getElementById('registerError');
    errEl.classList.add('d-none');

    if (form.password.value !== form.confirmPassword.value) {
      errEl.textContent = 'As passwords não coincidem.';
      errEl.classList.remove('d-none');
      return;
    }

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> A registar...';

    try {
      const data = await apiCall('POST', '/auth/register', {
        username: form.username.value.trim(),
        email: form.email.value.trim(),
        password: form.password.value
      });
      if (data && data.user) {
        setUser(data.user);
        window.location.href = '/dashboard.html';
      }
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.remove('d-none');
    } finally {
      btn.disabled = false;
      btn.innerHTML = 'Criar Conta';
    }
  });
}
