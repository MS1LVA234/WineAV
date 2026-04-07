// Room view: wine list, top 10, ratings
let currentUser = null;
let roomId = null;
let roomData = null;
let winesData = [];
let activeRatingWineId = null;

document.addEventListener('DOMContentLoaded', async () => {
  roomId = getParam('id');
  if (!roomId) { window.location.href = '/dashboard.html'; return; }

  currentUser = await checkAuth();
  if (!currentUser) return;

  document.getElementById('username-display').textContent = currentUser.username;
  if (currentUser.avatar) {
    const navAvatar = document.getElementById('nav-avatar');
    if (navAvatar) navAvatar.src = currentUser.avatar;
  }
  if (currentUser.role === 'admin') {
    const adminLink = document.getElementById('admin-nav-link');
    if (adminLink) adminLink.classList.remove('d-none');
  }
  setupLogout();

  await loadRoom();
  await loadWines();
  setupRatingModal();
  setupRatingsListModal();
  setupMembersModal();

  document.getElementById('tab-wines').addEventListener('click', loadWines);
  document.getElementById('tab-top10').addEventListener('click', loadTop10);
});

async function loadRoom() {
  try {
    const data = await apiCall('GET', `/rooms/${roomId}`);
    if (!data) return;
    roomData = data;
    document.getElementById('room-name').textContent = data.room.name;
    document.getElementById('room-name-header').textContent = data.room.name;
    document.getElementById('invite-code').textContent = data.room.invite_code;
    document.getElementById('member-count').textContent = data.members.length;
    document.title = `WineAV – ${data.room.name}`;
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function loadWines() {
  const container = document.getElementById('wines-container');
  container.innerHTML = '<div class="text-center py-4"><span class="spinner-border" style="color:var(--wine-primary)"></span></div>';

  try {
    const data = await apiCall('GET', `/rooms/${roomId}/wines`);
    if (!data) return;
    winesData = data.wines;

    if (data.wines.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🍾</div>
          <p class="fw-semibold">Sem vinhos ainda</p>
          <p class="small">Adiciona o primeiro vinho desta sala!</p>
        </div>`;
      return;
    }

    container.innerHTML = data.wines.map(w => renderWineCard(w)).join('');
  } catch (err) {
    container.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
  }
}

async function loadTop10() {
  const container = document.getElementById('top10-container');
  container.innerHTML = '<div class="text-center py-4"><span class="spinner-border" style="color:var(--wine-primary)"></span></div>';

  try {
    const data = await apiCall('GET', `/rooms/${roomId}/wines/top10`);
    if (!data) return;

    if (data.wines.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🏆</div>
          <p class="fw-semibold">Ainda não há avaliações</p>
          <p class="small">Avalia os vinhos para ver o Top 10!</p>
        </div>`;
      return;
    }

    container.innerHTML = data.wines.map((w, i) => renderTop10Item(w, i + 1)).join('');
  } catch (err) {
    container.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
  }
}

function renderWineCard(w) {
  const hasRating = w.avg_rating !== null && w.avg_rating !== undefined;
  const avgDisplay = hasRating ? parseFloat(w.avg_rating).toFixed(1) : '—';
  const ratingCount = w.rating_count || 0;
  const myRating = w.my_rating !== null && w.my_rating !== undefined ? parseFloat(w.my_rating).toFixed(1) : null;

  const detailRows = [
    w.castas ? `<div class="wine-detail-item"><span class="wine-detail-label">Castas</span><span>${escapeHtml(w.castas)}</span></div>` : '',
    w.tempo_estagio ? `<div class="wine-detail-item"><span class="wine-detail-label">Estágio</span><span>${escapeHtml(w.tempo_estagio)}</span></div>` : '',
    w.volume_alcool ? `<div class="wine-detail-item"><span class="wine-detail-label">Álcool</span><span>${w.volume_alcool}%</span></div>` : '',
    w.preco ? `<div class="wine-detail-item"><span class="wine-detail-label">Preço</span><span>€${parseFloat(w.preco).toFixed(2)}</span></div>` : '',
    w.chosen_by_name ? `<div class="wine-detail-item"><span class="wine-detail-label">Escolhido por</span><span>${escapeHtml(w.chosen_by_name)}</span></div>` : '',
    `<div class="wine-detail-item"><span class="wine-detail-label">Adicionado por</span><span>${escapeHtml(w.added_by_name)}</span></div>`,
  ].filter(Boolean).join('');

  return `
    <div class="wine-card card mb-3" id="wine-card-${w.id}">
      <div class="card-header-custom d-flex align-items-start justify-content-between gap-2">
        <div style="flex:1;min-width:0;">
          <p class="wine-name">${escapeHtml(w.name)}</p>
          <p class="wine-year-region">${[w.region, w.year].filter(Boolean).join(' • ') || 'Sem região/ano'}</p>
        </div>
        <div class="rating-badge ${hasRating ? '' : 'no-rating'}">
          <span class="rating-value">${avgDisplay}</span>
          <span class="rating-label">${hasRating ? `★ (${ratingCount})` : 'sem av.'}</span>
        </div>
      </div>
      <div class="card-body pb-2">
        <div class="collapse" id="details-${w.id}">
          ${detailRows}
          <hr class="my-2">
        </div>
        <div class="d-flex flex-wrap gap-2 align-items-center mt-1">
          <button class="btn btn-outline-secondary btn-sm" data-bs-toggle="collapse" data-bs-target="#details-${w.id}">
            Detalhes
          </button>
          <button class="btn btn-sm" style="background:#f3ecf0;color:var(--wine-primary);font-weight:600;"
            onclick="openRatingModal(${w.id}, '${escapeHtml(w.name).replace(/'/g, "\\'")}', ${myRating !== null ? myRating : 'null'})">
            ⭐ Avaliar
          </button>
          <button class="btn btn-outline-secondary btn-sm"
            onclick="openRatingsListModal(${w.id}, '${escapeHtml(w.name).replace(/'/g, "\\'")}')">
            Ver avaliações
          </button>
          <a href="/edit-wine.html?wineId=${w.id}&roomId=${roomId}" class="btn btn-sm btn-outline-wine ms-auto">
            ✎ Editar
          </a>
        </div>
        ${myRating !== null ? `<div class="mt-2"><span class="my-rating-tag">A minha avaliação: ${myRating}/10</span></div>` : ''}
      </div>
    </div>`;
}

function renderTop10Item(w, rank) {
  const rankClass = rank <= 3 ? `rank-${rank}` : 'rank-other';
  const rankLabel = rank <= 3 ? ['🥇', '🥈', '🥉'][rank - 1] : rank;

  return `
    <div class="top10-item">
      <div class="rank-badge ${rankClass}">${rankLabel}</div>
      <div class="top10-wine-info">
        <div class="top10-wine-name">${escapeHtml(w.name)}</div>
        <div class="top10-wine-sub">
          ${[w.region, w.year].filter(Boolean).join(' • ') || ''}
          ${w.chosen_by_name ? ` · Escolhido por ${escapeHtml(w.chosen_by_name)}` : ''}
        </div>
        <small class="text-muted">${w.rating_count} avalia${w.rating_count !== 1 ? 'ções' : 'ção'}</small>
      </div>
      <div class="top10-rating">${parseFloat(w.avg_rating).toFixed(1)}</div>
    </div>`;
}

// --- Rating Modal ---
function setupRatingModal() {
  const slider = document.getElementById('rating-slider');
  const display = document.getElementById('rating-display-value');

  slider.addEventListener('input', () => {
    display.textContent = parseFloat(slider.value).toFixed(1);
  });

  document.getElementById('submit-rating-btn').addEventListener('click', async () => {
    const btn = document.getElementById('submit-rating-btn');
    btn.disabled = true;
    try {
      const data = await apiCall('POST', `/wines/${activeRatingWineId}/ratings`, {
        rating: parseFloat(slider.value)
      });
      if (data) {
        bootstrap.Modal.getInstance(document.getElementById('ratingModal')).hide();
        showToast('Avaliação registada com sucesso!');
        await loadWines();
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      btn.disabled = false;
    }
  });
}

function openRatingModal(wineId, wineName, currentRating) {
  activeRatingWineId = wineId;
  document.getElementById('rating-modal-wine-name').textContent = wineName;
  const slider = document.getElementById('rating-slider');
  const initial = currentRating !== null ? currentRating : 5;
  slider.value = initial;
  document.getElementById('rating-display-value').textContent = parseFloat(initial).toFixed(1);
  new bootstrap.Modal(document.getElementById('ratingModal')).show();
}

// --- Ratings List Modal ---
function setupRatingsListModal() {}

async function openRatingsListModal(wineId, wineName) {
  document.getElementById('ratings-list-title').textContent = `Avaliações – ${wineName}`;
  document.getElementById('ratings-list-body').innerHTML = '<div class="text-center py-3"><span class="spinner-border spinner-border-sm"></span></div>';
  new bootstrap.Modal(document.getElementById('ratingsListModal')).show();

  try {
    const data = await apiCall('GET', `/wines/${wineId}/ratings`);
    if (!data) return;

    if (data.ratings.length === 0) {
      document.getElementById('ratings-list-body').innerHTML = '<p class="text-muted text-center">Sem avaliações ainda.</p>';
      return;
    }

    document.getElementById('ratings-list-body').innerHTML = data.ratings.map(r => `
      <div class="d-flex justify-content-between align-items-center py-2 border-bottom">
        <span class="fw-semibold">${escapeHtml(r.username)}</span>
        <span class="badge fs-6" style="background:var(--wine-primary)">${parseFloat(r.rating).toFixed(1)}</span>
      </div>`).join('');
  } catch (err) {
    document.getElementById('ratings-list-body').innerHTML = `<p class="text-danger">${err.message}</p>`;
  }
}

// --- Members Modal ---
function setupMembersModal() {
  document.getElementById('members-btn').addEventListener('click', () => {
    if (!roomData) return;
    document.getElementById('members-list-body').innerHTML = roomData.members.map(m => `
      <div class="d-flex align-items-center gap-2 py-2 border-bottom">
        <span class="fw-bold" style="background:var(--wine-primary);color:#fff;border-radius:50%;width:34px;height:34px;display:inline-flex;align-items:center;justify-content:center;">
          ${m.username[0].toUpperCase()}
        </span>
        <span>${escapeHtml(m.username)}</span>
        ${m.id === roomData.room.created_by ? '<span class="badge" style="background:var(--wine-gold)">Criador</span>' : ''}
      </div>`).join('');
    new bootstrap.Modal(document.getElementById('membersModal')).show();
  });

  document.getElementById('copy-invite-btn').addEventListener('click', () => {
    if (!roomData) return;
    navigator.clipboard.writeText(roomData.room.invite_code).then(() => showToast('Código copiado!'));
  });
}

function setupLogout() {
  document.getElementById('logoutBtn').addEventListener('click', async () => {
    await apiCall('POST', '/auth/logout');
    clearUser();
    window.location.href = '/index.html';
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
