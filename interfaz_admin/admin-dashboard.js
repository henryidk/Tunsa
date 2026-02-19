// ==================== ADMIN DASHBOARD JS ====================

// ── Navegación por secciones ──
const secciones = {
    'dashboard':           'Dashboard',
    'rentas-solicitudes':  'Solicitudes',
    'rentas-activas':      'Rentas Activas',
    'rentas-historial':    'Historial',
    'rentas-vencidas':     'Vencidas',
    'equipos':             'Equipos',
    'clientes':            'Clientes',
    'usuarios':            'Usuarios del sistema',
};

document.querySelectorAll('.nav-item[data-section]').forEach(item => {
    item.addEventListener('click', e => {
        e.preventDefault();
        navTo(item.dataset.section);
    });
});

function navTo(section) {
    // Actualizar nav items
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    const navItem = document.querySelector(`.nav-item[data-section="${section}"]`);
    if (navItem) navItem.classList.add('active');

    // Cambiar sección visible
    document.querySelectorAll('.page-section').forEach(el => el.classList.remove('active'));
    const sec = document.getElementById(`sec-${section}`);
    if (sec) sec.classList.add('active');

    // Breadcrumb
    const bc = document.getElementById('breadcrumbCurrent');
    if (bc) bc.textContent = secciones[section] || section;
}

// ── Sidebar toggle ──
const sidebar = document.getElementById('sidebar');
document.getElementById('sidebarToggle')?.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
});

// ── Toast ──
let toastTimer = null;
function showToast(icon, title, msg) {
    const toast = document.getElementById('toast');
    document.getElementById('toastIcon').textContent  = icon;
    document.getElementById('toastTitle').textContent = title;
    document.getElementById('toastMsg').textContent   = msg;

    toast.style.display = 'flex';
    toast.style.animation = 'toastSlideIn 250ms ease';

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.style.display = 'none'; }, 3500);
}

// ── Filtros tabs ──
function setTab(btn) {
    const parent = btn.closest('.ad-filter-tabs');
    parent.querySelectorAll('.ad-ftab').forEach(b => b.classList.remove('ad-ftab-active'));
    btn.classList.add('ad-ftab-active');
}

// ── Modal detalle renta ──
const rentaData = {
    'RNT-2024-089': { cliente:'Juan Choc — CLI-0042', estado:'Pendiente', total:'Q 2,900.00', equipos:'Compresor x1 · Martillo x1 · Andamio x2', inicio:'19 Feb 2026', duracion:'5 días' },
    'RNT-2024-087': { cliente:'Carlos Tun — CLI-0031', estado:'Pendiente', total:'Q 1,250.00', equipos:'Cortadora de Concreto x1', inicio:'22 Feb 2026', duracion:'5 días' },
    'RNT-2024-088': { cliente:'María González — CLI-0028', estado:'Aprobada', total:'Q 450.00', equipos:'Taladro Industrial x1', inicio:'15 Feb 2026', duracion:'3 días' },
    'RNT-2024-085': { cliente:'Ferretería El Progreso', estado:'Activa', total:'Q 3,220.00', equipos:'Generador Eléctrico x1 · Sierra Circular x1', inicio:'12 Feb 2026', duracion:'7 días' },
    'RNT-2024-086': { cliente:'Construcciones Ajú', estado:'Activa', total:'Q 2,420.00', equipos:'Andamio Metálico x4 · Mezcladora x1', inicio:'19 Feb 2026', duracion:'10 días' },
    'RNT-2024-081': { cliente:'Roberto Ajú Tum — CLI-0019', estado:'Vencida', total:'Q 1,540.00', equipos:'Mezcladora de Concreto x1', inicio:'10 Feb 2026', duracion:'7 días' },
};

function abrirDetalleRenta(id) {
    const data = rentaData[id] || {};
    document.getElementById('rentaModalTitle').textContent = id;
    document.getElementById('rentaModalSub').textContent  = data.cliente || '';

    // Actualizar filas del modal
    const rows = document.querySelectorAll('#rentaModalOverlay .ad-detail-row');
    const vals = [data.estado, data.cliente, '—', '—', data.equipos, data.inicio, data.duracion, data.total, 'Juan Pérez — Enc. Máquinas', '—'];
    // Solo actualizar los que tenemos
    rows.forEach((row, i) => {
        const span = row.querySelector('span:last-child');
        if (span && vals[i]) {
            if (i === 0) {
                const statusClass = data.estado === 'Pendiente' ? 'status-pending' :
                                    data.estado === 'Aprobada'  ? 'status-approved' :
                                    data.estado === 'Activa'    ? 'status-active' : 'status-overdue';
                span.innerHTML = `<span class="status-badge ${statusClass}">${data.estado}</span>`;
            }
        }
    });

    document.getElementById('rentaModalOverlay').classList.add('open');
    document.body.style.overflow = 'hidden';
}

function cerrarDetalleRenta() {
    document.getElementById('rentaModalOverlay').classList.remove('open');
    document.body.style.overflow = '';
}