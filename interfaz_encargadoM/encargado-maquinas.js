// Función para limpiar todos los datos (SOLO PARA PRUEBAS)
function limpiarDatosPrueba() {
    if (confirm('⚠️ ¿Borrar TODOS los datos? (Solo para pruebas)')) {
        localStorage.clear();
        location.reload();
    }
}

// Data structures
let rentals = JSON.parse(localStorage.getItem('rentals')) || [];
let requestCounter = parseInt(localStorage.getItem('requestCounter')) || 1;
let currentExtendId = null;
let currentReturnId = null;
let equiposEnSolicitud = []; // Array para equipos en la solicitud actual

// Equipment database
const equipmentDatabase = {
    'Taladro Industrial': { cost: 150, available: 3, total: 5 },
    'Compresor de Aire': { cost: 200, available: 2, total: 3 },
    'Martillo Neumático': { cost: 180, available: 4, total: 6 },
    'Cortadora de Concreto': { cost: 250, available: 1, total: 2 },
    'Andamio Metálico': { cost: 100, available: 5, total: 8 },
    'Mezcladora de Concreto': { cost: 220, available: 2, total: 3 },
    'Sierra Circular': { cost: 160, available: 3, total: 4 },
    'Generador Eléctrico': { cost: 300, available: 1, total: 2 },
    'Niveladora Láser': { cost: 120, available: 2, total: 3 }
};


// ==================== SIDEBAR & NAVIGATION ====================
function initializeSidebar() {
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebarToggle');
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
            localStorage.setItem('sidebarCollapsed', sidebar.classList.contains('collapsed'));
        });
    }
    
    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', () => {
            sidebar.classList.toggle('open');
        });
    }
    
    const isCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
    if (isCollapsed && sidebar) sidebar.classList.add('collapsed');
    
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 1024 && sidebar && mobileMenuBtn) {
            if (!sidebar.contains(e.target) && !mobileMenuBtn.contains(e.target)) {
                sidebar.classList.remove('open');
            }
        }
    });
}

function initializeNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    
    navItems.forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            
            const section = this.dataset.section;
            if (!section) return;
            
            navItems.forEach(nav => nav.classList.remove('active'));
            this.classList.add('active');
            
            showSection(section);
            
            const label = this.querySelector('.nav-label');
            if (label) updateBreadcrumb(label.textContent);
            
            if (window.innerWidth <= 1024) {
                const sidebar = document.getElementById('sidebar');
                if (sidebar) sidebar.classList.remove('open');
            }
        });
    });
    
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            refreshBtn.style.transform = 'rotate(360deg)';
            setTimeout(() => refreshBtn.style.transform = '', 300);
            
            renderAllTables();
            renderEquipmentGrid();
            updateStats();
            
            showToast('✅', 'Actualizado', 'Datos actualizados correctamente');
        });
    }
}

function showSection(sectionId) {
    document.querySelectorAll('.page-section').forEach(section => {
        section.classList.remove('active');
    });
    
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.classList.add('active');
        
        switch(sectionId) {
            case 'dashboard': renderDashboard(); break;
            case 'pendientes-autorizacion': renderPendingAuth(); break;
            case 'rentas-activas': renderActiveRentals(); break;
            case 'rentas-vencidas': renderOverdueRentals(); break;
            case 'historial': renderHistory(); break;
            case 'equipos': renderEquipmentGrid(); break;
        }
    }
}

function updateBreadcrumb(text) {
    const breadcrumb = document.getElementById('breadcrumbCurrent');
    if (breadcrumb) breadcrumb.textContent = text;
}

function renderDashboard() {
    updateStats();
    renderRecentActivity();
}

function renderRecentActivity() {
    const activityList = document.getElementById('recentActivity');
    if (!activityList) return;
    
    const recentRentals = rentals.slice(-5).reverse();
    
    if (recentRentals.length === 0) {
        activityList.innerHTML = `
            <div class="activity-item">
                <div class="activity-icon activity-success">✓</div>
                <div class="activity-content">
                    <div class="activity-title">Sistema iniciado correctamente</div>
                    <div class="activity-time">Hace unos momentos</div>
                </div>
            </div>
        `;
        return;
    }
    
    activityList.innerHTML = recentRentals.map(rental => {
        const icon = rental.status === 'approved' ? '✓' : rental.status === 'rejected' ? '✗' : '⏳';
        const iconClass = rental.status === 'approved' ? 'activity-success' : 'activity-warning';
        const timeAgo = getTimeAgo(rental.timestamp);
        const equiposSummary = rental.equipos.map(e => e.nombre).join(', ');
        
        return `
            <div class="activity-item">
                <div class="activity-icon ${iconClass}">${icon}</div>
                <div class="activity-content">
                    <div class="activity-title">${rental.cliente} - ${equiposSummary}</div>
                    <div class="activity-time">${timeAgo}</div>
                </div>
            </div>
        `;
    }).join('');
}

function getTimeAgo(dateString) {
    if (!dateString) return 'Hace unos momentos';
    const date = new Date(dateString);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);
    
    if (diff < 60) return 'Hace unos segundos';
    if (diff < 3600) return `Hace ${Math.floor(diff / 60)} minutos`;
    if (diff < 86400) return `Hace ${Math.floor(diff / 3600)} horas`;
    return `Hace ${Math.floor(diff / 86400)} días`;
}

function showToast(icon, title, message) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    
    const iconEl = toast.querySelector('.toast-icon');
    const titleEl = toast.querySelector('.toast-title');
    const messageEl = toast.querySelector('.toast-message');
    
    if (iconEl) iconEl.textContent = icon;
    if (titleEl) titleEl.textContent = title;
    if (messageEl) messageEl.textContent = message;
    
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 4000);
}


// ==================== FORMULARIO DE NUEVA SOLICITUD ====================
function initializeForm() {
    // Set today as default for the equipment date selector
    const today = new Date().toISOString().split('T')[0];
    const equipDateEl = document.getElementById('equipStartDate');
    if (equipDateEl) {
        equipDateEl.min   = today;
        equipDateEl.value = today;
    }
}

// Agregar equipo a la lista de equipos en solicitud
function agregarEquipoALista() {
    const equipmentSelect = document.getElementById('equipmentSelect');
    const cantidadInput   = document.getElementById('equipmentQty');
    const fechaInput      = document.getElementById('equipStartDate');
    const duracionInput   = document.getElementById('equipDuration');

    const nombreEquipo = equipmentSelect.value;
    const cantidad     = parseInt(cantidadInput.value) || 1;
    const fechaInicio  = fechaInput.value;
    const duracion     = parseInt(duracionInput.value) || 1;

    if (!nombreEquipo) {
        showToast('⚠️', 'Validación', 'Selecciona un equipo');
        return;
    }
    if (!fechaInicio) {
        showToast('⚠️', 'Validación', 'Selecciona una fecha de inicio');
        return;
    }
    if (duracion < 1) {
        showToast('⚠️', 'Validación', 'La duración debe ser al menos 1 día');
        return;
    }

    // Validar disponibilidad
    if (equipmentDatabase[nombreEquipo] && equipmentDatabase[nombreEquipo].available < cantidad) {
        showToast('❌', 'Stock insuficiente', `Solo hay ${equipmentDatabase[nombreEquipo].available} unidades disponibles`);
        return;
    }

    // Verificar duplicado
    if (equiposEnSolicitud.find(e => e.nombre === nombreEquipo)) {
        showToast('⚠️', 'Equipo duplicado', 'Este equipo ya está en la lista');
        return;
    }

    const costo    = equipmentDatabase[nombreEquipo] ? equipmentDatabase[nombreEquipo].cost : 0;
    const subtotal = cantidad * costo * duracion;

    equiposEnSolicitud.push({
        nombre:      nombreEquipo,
        cantidad:    cantidad,
        fechaInicio: fechaInicio,
        duracion:    duracion,
        costo:       costo,
        subtotal:    subtotal
    });

    renderizarTablaEquipos();
    calcularTotalSolicitud();

    // Reset selector fields
    equipmentSelect.value  = '';
    cantidadInput.value    = '1';
    duracionInput.value    = '1';
    // keep date for convenience (user likely adding same-day items)
}

function renderizarTablaEquipos() {
    const tbody = document.getElementById('equipmentListBody');
    if (!tbody) return;

    if (equiposEnSolicitud.length === 0) {
        tbody.innerHTML = `
            <tr class="empty-row">
                <td colspan="8">
                    <div class="empty-state">
                        <div class="empty-icon">📭</div>
                        <p>Selecciona un equipo y haz clic en "Agregar"</p>
                    </div>
                </td>
            </tr>`;
        return;
    }

    tbody.innerHTML = equiposEnSolicitud.map((equipo, idx) => `
        <tr>
            <td style="color:var(--text-light);font-size:12px;">${idx + 1}</td>
            <td><strong>${equipo.nombre}</strong></td>
            <td>${equipo.cantidad}</td>
            <td style="font-size:12px;color:var(--text-secondary);">${formatDate(equipo.fechaInicio)}</td>
            <td><span class="ns-dias-badge">${equipo.duracion}d</span></td>
            <td>Q${equipo.costo.toFixed(2)}</td>
            <td><strong>Q${equipo.subtotal.toFixed(2)}</strong></td>
            <td>
                <button type="button" class="btn btn-sm btn-danger" onclick="quitarEquipoDeLista(${idx})" title="Quitar equipo">✕</button>
            </td>
        </tr>
    `).join('');
}

function quitarEquipoDeLista(index) {
    equiposEnSolicitud.splice(index, 1);
    renderizarTablaEquipos();
    calcularTotalSolicitud();
}

function calcularTotalSolicitud() {
    const total = equiposEnSolicitud.reduce((sum, eq) => sum + eq.subtotal, 0);
    const cantidadEquipos = equiposEnSolicitud.length;

    // Compact total display
    const totalCostEl = document.getElementById('totalCost');
    const costBreakdownEl = document.getElementById('costBreakdown');
    if (totalCostEl) totalCostEl.textContent = total.toFixed(2);
    if (costBreakdownEl) costBreakdownEl.textContent =
        `${cantidadEquipos} ${cantidadEquipos === 1 ? 'equipo' : 'equipos'} seleccionado${cantidadEquipos !== 1 ? 's' : ''}`;

    // Side summary panel
    const summaryItems = document.getElementById('summaryItems');
    const summaryEmpty = document.getElementById('summaryEmpty');

    if (!summaryItems) return;

    // Remove old rows
    summaryItems.querySelectorAll('.ns-summary-row').forEach(el => el.remove());
    if (summaryEmpty) summaryEmpty.remove();

    if (cantidadEquipos === 0) {
        summaryItems.innerHTML = `
            <div class="ns-summary-empty" id="summaryEmpty">
                <div class="ns-summary-empty-icon">📦</div>
                <div>Aún no hay equipos<br>agregados a la solicitud</div>
            </div>`;
        return;
    }

    equiposEnSolicitud.forEach(eq => {
        const row = document.createElement('div');
        row.className = 'ns-summary-row';
        row.innerHTML = `
            <div class="ns-summary-row-name">
                <strong>${eq.nombre}</strong>
                ${eq.cantidad}u × ${eq.duracion}d × Q${eq.costo.toFixed(2)}/día
            </div>
            <div class="ns-summary-row-val">Q${eq.subtotal.toFixed(2)}</div>`;
        summaryItems.appendChild(row);
    });
}

function resetFormComplete() {
    document.getElementById('clientName').value  = '';
    document.getElementById('clientPhone').value = '';
    document.getElementById('notes').value       = '';

    // Reset equipment selector
    const equipSel  = document.getElementById('equipmentSelect');
    const equipQty  = document.getElementById('equipmentQty');
    const equipDate = document.getElementById('equipStartDate');
    const equipDur  = document.getElementById('equipDuration');
    if (equipSel)  equipSel.value  = '';
    if (equipQty)  equipQty.value  = '1';
    if (equipDate) equipDate.value = new Date().toISOString().split('T')[0];
    if (equipDur)  equipDur.value  = '1';

    equiposEnSolicitud = [];
    renderizarTablaEquipos();
    calcularTotalSolicitud();
}

// Create Rental
function createRental() {
    if (equiposEnSolicitud.length === 0) {
        showToast('❌', 'Error', 'Debes agregar al menos un equipo a la solicitud');
        return;
    }

    const clientName  = document.getElementById('clientName').value.trim();
    const clientPhone = document.getElementById('clientPhone').value.trim();

    if (!clientName || !clientPhone) {
        showToast('❌', 'Error', 'Completa los datos del cliente (nombre y teléfono)');
        return;
    }

    const total = equiposEnSolicitud.reduce((sum, eq) => sum + eq.subtotal, 0);

    // Use the earliest start date among all equipment as the rental reference date
    const fechasInicio = equiposEnSolicitud.map(eq => eq.fechaInicio).sort();
    const fechaInicioGeneral = fechasInicio[0];
    const duracionMaxima = Math.max(...equiposEnSolicitud.map(eq => eq.duracion));

    const rental = {
        id:              `SOL-${String(requestCounter).padStart(4, '0')}`,
        type:            'Renta de Equipo',
        status:          'pending',
        timestamp:       new Date().toISOString(),
        cliente:         clientName,
        telefono:        clientPhone,
        fechaInicio:     fechaInicioGeneral,
        duracion:        duracionMaxima,
        equipos:         JSON.parse(JSON.stringify(equiposEnSolicitud)),
        observaciones:   document.getElementById('notes').value,
        totalEstimado:   total
    };

    rentals.push(rental);
    requestCounter++;

    saveData();

    // Send to secretary
    let pendingRequests = JSON.parse(localStorage.getItem('pendingRequests')) || [];
    pendingRequests.push(rental);
    localStorage.setItem('pendingRequests', JSON.stringify(pendingRequests));

    showToast('✅', 'Solicitud Creada', `${rental.id} enviada a secretaría para aprobación`);

    resetFormComplete();
    updateStats();
    renderAllTables();

    // Navigate to pending tab
    const pendientesNav = document.querySelector('[data-section="pendientes-autorizacion"]');
    if (pendientesNav) pendientesNav.click();
}

// Update request status
function updateRequestStatus(id, status) {
    const rental = rentals.find(r => r.id === id);
    if (rental) {
        rental.status = status;
        
        if (status === 'approved') {
            rental.fechaAprobacion = new Date().toISOString();
            // Reduce inventory when approved
            rental.equipos.forEach(equipo => {
                if (equipmentDatabase[equipo.nombre]) {
                    equipmentDatabase[equipo.nombre].available -= equipo.cantidad;
                }
            });
        }
        
        saveData();
        renderAllTables();
        updateStats();
        renderEquipmentGrid();
        
        const statusText = status === 'approved' ? '✅ Solicitud Aprobada' : '❌ Solicitud Rechazada';
        const message = status === 'approved' 
            ? `${rental.id} ha sido aprobada. La renta está activa.`
            : `${rental.id} ha sido rechazada por secretaría.`;
        
        showToast(
            status === 'approved' ? '✅' : '❌',
            statusText,
            message
        );
    }
}

// Check for updates from secretary
function checkForUpdates() {
    const updates = localStorage.getItem('requestUpdates');
    if (updates) {
        const updateList = JSON.parse(updates);
        updateList.forEach(update => {
            updateRequestStatus(update.id, update.status);
        });
        localStorage.removeItem('requestUpdates');
    }
}

// Check for overdue rentals
function checkOverdueRentals() {
    const now = new Date();
    rentals.forEach(rental => {
        if (rental.status === 'approved' && !rental.fechaDevolucion) {
            const endDate = new Date(rental.fechaInicio);
            endDate.setDate(endDate.getDate() + rental.duracion);
            
            if (now > endDate && !rental.overdue) {
                rental.overdue = true;
                saveData();
                renderAllTables();
                updateStats();
                
                const equiposSummary = rental.equipos.map(e => e.nombre).join(', ');
                showToast(
                    '⚠️',
                    'Renta Vencida',
                    `${rental.id} - ${equiposSummary} está vencida`
                );
            }
        }
    });
}

// Render Pending Authorization
function renderPendingAuth() {
    const tbody = document.getElementById('pendingTable');
    const pendingRentals = rentals.filter(r => r.status === 'pending');
    
    if (pendingRentals.length === 0) {
        tbody.innerHTML = `
            <tr class="empty-row">
                <td colspan="8">
                    <div class="empty-state">
                        <div class="empty-icon">✅</div>
                        <p>No hay solicitudes pendientes</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = pendingRentals.map(rental => {
        const equiposSummary = rental.equipos.map(e => `${e.nombre} (x${e.cantidad})`).join(', ');
        const total = rental.totalEstimado || rental.equipos.reduce((sum, e) => sum + e.subtotal, 0);
        
        return `
            <tr class="highlight">
                <td><strong>${rental.id}</strong></td>
                <td>${rental.cliente}</td>
                <td>${equiposSummary}</td>
                <td>${formatDateTime(rental.timestamp)}</td>
                <td>${formatDate(rental.fechaInicio)}</td>
                <td>${rental.duracion} días</td>
                <td><strong>Q${total.toFixed(2)}</strong></td>
                <td>
                    <span class="status-badge status-pending">
                        ⏳ Pendiente
                    </span>
                </td>
            </tr>
        `;
    }).join('');
}

// Render Active Rentals
function renderActiveRentals() {
    const tbody = document.getElementById('activeTable');
    const activeRentals = rentals.filter(r => r.status === 'approved' && !r.fechaDevolucion);
    
    if (activeRentals.length === 0) {
        tbody.innerHTML = `
            <tr class="empty-row">
                <td colspan="8">
                    <div class="empty-state">
                        <div class="empty-icon">📦</div>
                        <p>No hay rentas activas</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = activeRentals.map(rental => {
        const startDate = new Date(rental.fechaInicio);
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + rental.duracion);
        
        const now = new Date();
        const daysLeft = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
        const isNearExpiry = daysLeft <= 2 && daysLeft >= 0;
        const isOverdue = daysLeft < 0;
        
        const total = rental.totalEstimado || rental.equipos.reduce((sum, e) => sum + e.subtotal, 0);
        const equiposSummary = rental.equipos.map(e => `${e.nombre} (x${e.cantidad})`).join(', ');
        
        return `
            <tr class="${isOverdue ? 'overdue' : isNearExpiry ? 'highlight' : ''}">
                <td><strong>${rental.id}</strong></td>
                <td>${rental.cliente}</td>
                <td>${equiposSummary}</td>
                <td>${formatDate(rental.fechaInicio)}</td>
                <td>${formatDate(endDate)}</td>
                <td>
                    <span class="status-badge ${isOverdue ? 'status-overdue' : isNearExpiry ? 'status-pending' : 'status-active'}">
                        ${isOverdue ? 'Vencido' : `${daysLeft} días`}
                    </span>
                </td>
                <td><strong>Q${total.toFixed(2)}</strong></td>
                <td>
                    <button class="btn btn-sm btn-warning" onclick="openExtendModal('${rental.id}')">
                        ⏱️ Extender
                    </button>
                    <button class="btn btn-sm btn-success" onclick="openReturnModal('${rental.id}')">
                        ✓ Devolver
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// Render Overdue Rentals
function renderOverdueRentals() {
    const tbody = document.getElementById('overdueTable');
    const overdueRentals = rentals.filter(r => {
        if (r.status !== 'approved' || r.fechaDevolucion) return false;
        const endDate = new Date(r.fechaInicio);
        endDate.setDate(endDate.getDate() + r.duracion);
        return new Date() > endDate;
    });
    
    if (overdueRentals.length === 0) {
        tbody.innerHTML = `
            <tr class="empty-row">
                <td colspan="9">
                    <div class="empty-state">
                        <div class="empty-icon">✅</div>
                        <p>No hay rentas vencidas</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = overdueRentals.map(rental => {
        const endDate = new Date(rental.fechaInicio);
        endDate.setDate(endDate.getDate() + rental.duracion);
        
        const now = new Date();
        const daysLate = Math.floor((now - endDate) / (1000 * 60 * 60 * 24));
        
        let originalCost = 0;
        let lateFee = 0;
        
        rental.equipos.forEach(equipo => {
            const subOriginal = equipo.cantidad * equipo.duracion * equipo.costo;
            const subLate = equipo.cantidad * daysLate * equipo.costo;
            originalCost += subOriginal;
            lateFee += subLate;
        });
        
        const totalCost = originalCost + lateFee;
        const equiposSummary = rental.equipos.map(e => `${e.nombre} (x${e.cantidad})`).join(', ');
        
        return `
            <tr class="overdue">
                <td><strong>${rental.id}</strong></td>
                <td>${rental.cliente}</td>
                <td>${equiposSummary}</td>
                <td>${formatDate(rental.fechaInicio)}</td>
                <td>${formatDate(endDate)}</td>
                <td>
                    <span class="status-badge status-overdue">
                        ${daysLate} ${daysLate === 1 ? 'día' : 'días'}
                    </span>
                </td>
                <td>Q${originalCost.toFixed(2)}</td>
                <td class="late-fee-warning">
                    <strong>Q${lateFee.toFixed(2)}</strong>
                </td>
                <td>
                    <strong style="color: var(--danger);">Q${totalCost.toFixed(2)}</strong>
                </td>
                <td>
                    <button class="btn btn-sm btn-success" onclick="openReturnModal('${rental.id}')">
                        ✓ Devolver
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// Render History
function renderHistory() {
    const tbody = document.getElementById('historyTable');
    const completedRentals = rentals.filter(r => r.fechaDevolucion || r.status === 'rejected');
    
    if (completedRentals.length === 0) {
        tbody.innerHTML = `
            <tr class="empty-row">
                <td colspan="8">
                    <div class="empty-state">
                        <div class="empty-icon">📋</div>
                        <p>No hay historial de rentas</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = completedRentals.reverse().map(rental => {
        if (rental.status === 'rejected') {
            const equiposSummary = rental.equipos.map(e => `${e.nombre} (x${e.cantidad})`).join(', ');
            return `
                <tr>
                    <td><strong>${rental.id}</strong></td>
                    <td>${rental.cliente}</td>
                    <td>${equiposSummary}</td>
                    <td colspan="2">${formatDate(rental.timestamp)}</td>
                    <td>-</td>
                    <td>Q0.00</td>
                    <td><span class="status-badge status-rejected">Rechazada</span></td>
                </tr>
            `;
        }
        
        const startDate = new Date(rental.fechaInicio);
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + rental.duracion);
        const returnDate = new Date(rental.fechaDevolucion);
        
        const daysLate = Math.max(0, Math.floor((returnDate - endDate) / (1000 * 60 * 60 * 24)));
        const wasLate = daysLate > 0;
        
        const totalPaid = rental.totalPagado || (rental.totalEstimado || rental.equipos.reduce((sum, e) => sum + e.subtotal, 0));
        const equiposSummary = rental.equipos.map(e => `${e.nombre} (x${e.cantidad})`).join(', ');
        
        return `
            <tr>
                <td><strong>${rental.id}</strong></td>
                <td>${rental.cliente}</td>
                <td>${equiposSummary}</td>
                <td>${formatDate(rental.fechaInicio)} - ${formatDate(endDate)}</td>
                <td>${rental.duracion} días</td>
                <td>${formatDate(rental.fechaDevolucion)}</td>
                <td><strong>Q${totalPaid.toFixed(2)}</strong></td>
                <td>
                    <span class="status-badge ${wasLate ? 'status-completed-late' : 'status-completed'}">
                        ${wasLate ? `Tardío (+${daysLate}d)` : 'Completada'}
                    </span>
                </td>
            </tr>
        `;
    }).join('');
}

// Render Equipment Grid
function renderEquipmentGrid() {
    const grid = document.getElementById('equipmentGrid');
    
    grid.innerHTML = Object.entries(equipmentDatabase).map(([name, data]) => {
        const availabilityPercent = (data.available / data.total) * 100;
        let statusClass = 'available';
        let statusText = 'Disponible';
        
        if (data.available === 0) {
            statusClass = 'unavailable';
            statusText = 'No disponible';
        } else if (availabilityPercent < 50) {
            statusClass = 'rented';
            statusText = 'Baja disponibilidad';
        }
        
        return `
            <div class="equipment-card">
                <div class="equipment-header">
                    <div class="equipment-name">${name}</div>
                    <span class="equipment-status ${statusClass}">${statusText}</span>
                </div>
                <div class="equipment-info">
                    <div class="info-row">
                        <span class="info-label">Disponibles:</span>
                        <span class="info-value">${data.available} / ${data.total}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Costo/día:</span>
                        <span class="info-value">Q${data.cost.toFixed(2)}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">En renta:</span>
                        <span class="info-value">${data.total - data.available} unidades</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Modal Functions - Extend Rental
function openExtendModal(id) {
    const rental = rentals.find(r => r.id === id);
    if (!rental) return;
    
    currentExtendId = id;
    
    document.getElementById('extendClient').textContent = rental.cliente;
    
    const equiposHtml = rental.equipos.map(e => 
        `<div style="padding: 0.25rem 0; font-size: 0.875rem;">• ${e.nombre} (x${e.cantidad}) - Q${e.costo}/día</div>`
    ).join('');
    document.getElementById('extendEquipmentList').innerHTML = equiposHtml;
    
    const endDate = new Date(rental.fechaInicio);
    endDate.setDate(endDate.getDate() + rental.duracion);
    document.getElementById('extendCurrentEnd').textContent = formatDate(endDate);
    
    document.getElementById('extendDays').value = 1;
    updateExtendCost();
    
    document.getElementById('extendDays').addEventListener('input', updateExtendCost);
    
    document.getElementById('extendModal').classList.add('show');
}

function updateExtendCost() {
    if (!currentExtendId) return;
    
    const rental = rentals.find(r => r.id === currentExtendId);
    const days = parseInt(document.getElementById('extendDays').value) || 0;
    
    let cost = 0;
    rental.equipos.forEach(equipo => {
        cost += equipo.cantidad * days * equipo.costo;
    });
    
    document.getElementById('extendCost').textContent = `Q${cost.toFixed(2)}`;
}

function closeExtendModal() {
    document.getElementById('extendModal').classList.remove('show');
    currentExtendId = null;
}

function confirmExtend() {
    const rental = rentals.find(r => r.id === currentExtendId);
    if (!rental) return;
    
    const additionalDays = parseInt(document.getElementById('extendDays').value);
    rental.duracion += additionalDays;
    
    // Recalculate subtotals
    rental.equipos.forEach(equipo => {
        equipo.subtotal = equipo.cantidad * equipo.duracion * equipo.costo;
    });
    
    rental.totalEstimado = rental.equipos.reduce((sum, e) => sum + e.subtotal, 0);
    
    saveData();
    renderAllTables();
    updateStats();
    
    showToast(
        '✅',
        'Renta Extendida',
        `${rental.id} extendida por ${additionalDays} días adicionales`
    );
    
    closeExtendModal();
}

// Modal Functions - Return Equipment
function openReturnModal(id) {
    const rental = rentals.find(r => r.id === id);
    if (!rental) return;
    
    currentReturnId = id;
    
    document.getElementById('returnClient').textContent = rental.cliente;
    
    const equiposHtml = rental.equipos.map(e => 
        `<div style="padding: 0.25rem 0; font-size: 0.875rem;">• ${e.nombre} (x${e.cantidad})</div>`
    ).join('');
    document.getElementById('returnEquipmentList').innerHTML = equiposHtml;
    
    // Calculate if late and late fees
    const endDate = new Date(rental.fechaInicio);
    endDate.setDate(endDate.getDate() + rental.duracion);
    const now = new Date();
    const daysLate = Math.max(0, Math.floor((now - endDate) / (1000 * 60 * 60 * 24)));
    
    let originalCost = 0;
    let lateFee = 0;
    
    rental.equipos.forEach(equipo => {
        const subOriginal = equipo.cantidad * equipo.duracion * equipo.costo;
        const subLate = equipo.cantidad * daysLate * equipo.costo;
        originalCost += subOriginal;
        lateFee += subLate;
    });
    
    let totalCost = originalCost + lateFee;
    
    if (daysLate > 0) {
        document.getElementById('returnLateFee').style.display = 'block';
        document.getElementById('lateFeeAmount').textContent = `Q${lateFee.toFixed(2)} (${daysLate} ${daysLate === 1 ? 'día' : 'días'})`;
    } else {
        document.getElementById('returnLateFee').style.display = 'none';
    }
    
    document.getElementById('returnTotal').textContent = `Q${totalCost.toFixed(2)}`;
    
    document.getElementById('returnModal').classList.add('show');
}

function closeReturnModal() {
    document.getElementById('returnModal').classList.remove('show');
    currentReturnId = null;
}

function confirmReturn() {
    const rental = rentals.find(r => r.id === currentReturnId);
    if (!rental) return;
    
    const condition = document.getElementById('equipmentCondition').value;
    const notes = document.getElementById('returnNotes').value;
    
    // Calculate final payment
    const endDate = new Date(rental.fechaInicio);
    endDate.setDate(endDate.getDate() + rental.duracion);
    const now = new Date();
    const daysLate = Math.max(0, Math.floor((now - endDate) / (1000 * 60 * 60 * 24)));
    
    let originalCost = 0;
    let lateFee = 0;
    
    rental.equipos.forEach(equipo => {
        const subOriginal = equipo.cantidad * equipo.duracion * equipo.costo;
        const subLate = equipo.cantidad * daysLate * equipo.costo;
        originalCost += subOriginal;
        lateFee += subLate;
    });
    
    const totalCost = originalCost + lateFee;
    
    rental.fechaDevolucion = new Date().toISOString();
    rental.condicionDevolucion = condition;
    rental.notasDevolucion = notes;
    rental.totalPagado = totalCost;
    rental.diasAtraso = daysLate;
    
    // Return equipment to inventory
    rental.equipos.forEach(equipo => {
        if (equipmentDatabase[equipo.nombre]) {
            equipmentDatabase[equipo.nombre].available += equipo.cantidad;
        }
    });
    
    saveData();
    renderAllTables();
    updateStats();
    renderEquipmentGrid();
    
    const equiposSummary = rental.equipos.map(e => e.nombre).join(', ');
    showToast(
        '✅',
        'Equipo Devuelto',
        `${rental.id} - Total cobrado: Q${totalCost.toFixed(2)}`
    );
    
    closeReturnModal();
}

// View Rental Details
function viewRentalDetails(id) {
    const rental = rentals.find(r => r.id === id);
    if (!rental) return;
    
    const equiposDetalles = rental.equipos.map(e => 
        `  • ${e.nombre}: ${e.cantidad} x Q${e.costo}/día = Q${e.subtotal.toFixed(2)}`
    ).join('\n');
    
    const details = `
=== DETALLE DE RENTA ===
ID: ${rental.id}
Cliente: ${rental.cliente}
Teléfono: ${rental.telefono}

Equipos rentados:
${equiposDetalles}

Fecha de inicio: ${formatDate(rental.fechaInicio)}
Duración: ${rental.duracion} días
${rental.fechaDevolucion ? `Fecha de devolución: ${formatDate(rental.fechaDevolucion)}` : ''}
${rental.totalPagado ? `Total pagado: Q${rental.totalPagado.toFixed(2)}` : ''}
${rental.diasAtraso ? `Días de atraso: ${rental.diasAtraso}` : ''}
${rental.observaciones ? `Observaciones: ${rental.observaciones}` : ''}
${rental.notasDevolucion ? `Notas de devolución: ${rental.notasDevolucion}` : ''}
Estado: ${rental.status}
    `;
    
    alert(details);
}

// Render all tables
function renderAllTables() {
    renderPendingAuth();
    renderActiveRentals();
    renderOverdueRentals();
    renderHistory();
    updateStats();
}

// Update Statistics
function updateStats() {
    const pendingRentals = rentals.filter(r => r.status === 'pending');
    const activeRentals = rentals.filter(r => r.status === 'approved' && !r.fechaDevolucion);
    const overdueRentals = rentals.filter(r => {
        if (r.status !== 'approved' || r.fechaDevolucion) return false;
        const endDate = new Date(r.fechaInicio);
        endDate.setDate(endDate.getDate() + r.duracion);
        return new Date() > endDate;
    });
    
    // Calculate monthly revenue
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    const monthlyRevenue = rentals
        .filter(r => r.fechaDevolucion)
        .filter(r => {
            const returnDate = new Date(r.fechaDevolucion);
            return returnDate.getMonth() === currentMonth && returnDate.getFullYear() === currentYear;
        })
        .reduce((sum, r) => sum + (r.totalPagado || 0), 0);
    
    document.getElementById('dashPendingCount').textContent = pendingRentals.length;
    document.getElementById('dashActiveCount').textContent = activeRentals.length;
    document.getElementById('dashOverdueCount').textContent = overdueRentals.length;
    document.getElementById('dashRevenue').textContent = `Q${monthlyRevenue.toFixed(2)}`;
    
    // Update nav badges
    document.getElementById('navBadgePending').textContent = pendingRentals.length;
    document.getElementById('navBadgeActive').textContent = activeRentals.length;
    document.getElementById('navBadgeOverdue').textContent = overdueRentals.length;
}

// Utility Functions
function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-GT', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
    });
}

function formatDateTime(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('es-GT', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function saveData() {
    localStorage.setItem('rentals', JSON.stringify(rentals));
    localStorage.setItem('requestCounter', requestCounter.toString());
    localStorage.setItem('equipmentDatabase', JSON.stringify(equipmentDatabase));
}

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    initializeSidebar();
    initializeNavigation();
    initializeForm();
    renderAllTables();
    renderEquipmentGrid();
    updateStats();
    checkOverdueRentals();

    // Check for updates every second
    setInterval(checkForUpdates, 1000);
    setInterval(checkOverdueRentals, 60000); // Check every minute
});
// ==================== MÓDULO CLIENTE ====================

// Base de clientes de prueba (reemplazar con API)
const clDB = [
    { codigo:'CLI-0001', nombre:'Juan Carlos Pérez López',    telefono:'5555-1234', dpi:'2345 67890 1234', doc:true,  rentas:5  },
    { codigo:'CLI-0002', nombre:'María González Xol',         telefono:'4444-5678', dpi:'3456 78901 2345', doc:true,  rentas:2  },
    { codigo:'CLI-0003', nombre:'Roberto Ajú Tum',            telefono:'3333-9012', dpi:'4567 89012 3456', doc:false, rentas:1  },
    { codigo:'CLI-0004', nombre:'Ferretería El Progreso S.A.',telefono:'2222-3456', dpi:'5678 90123 4567', doc:true,  rentas:12 },
];

let clActual    = null; // cliente seleccionado para la solicitud
let clPasoActual = 1;   // paso del modal (1 o 2)

// ── Utilidades ──────────────────────────────────────────
function clIniciales(nombre) {
    return nombre.trim().split(' ').slice(0, 2).map(p => p[0].toUpperCase()).join('');
}

// ── Buscador ────────────────────────────────────────────
function clBuscar(q) {
    const dropdown = document.getElementById('clDropdown');
    const clearBtn = document.getElementById('clClearBtn');

    clearBtn.classList.toggle('show', q.length > 0);

    if (q.length < 2) { dropdown.classList.remove('open'); return; }

    const matches = clDB.filter(c =>
        c.nombre.toLowerCase().includes(q.toLowerCase()) ||
        c.codigo.toLowerCase().includes(q.toLowerCase())
    );

    if (matches.length === 0) {
        dropdown.innerHTML = `<div class="cl-drop-empty">No se encontró ningún cliente — ¿deseas <strong>registrarlo nuevo</strong>?</div>`;
    } else {
        dropdown.innerHTML = matches.map(c => `
            <div class="cl-drop-item" onclick="clSeleccionar('${c.codigo}')">
                <div class="cl-drop-avatar">${clIniciales(c.nombre)}</div>
                <div>
                    <div class="cl-drop-name">${c.nombre}</div>
                    <div class="cl-drop-meta">${c.telefono} · DPI: ${c.dpi} · ${c.rentas} renta${c.rentas!==1?'s':''}</div>
                </div>
                <div class="cl-drop-code">${c.codigo}</div>
            </div>
        `).join('');
    }

    dropdown.classList.add('open');
}

function clLimpiarBusqueda() {
    document.getElementById('clientSearch').value = '';
    document.getElementById('clClearBtn').classList.remove('show');
    document.getElementById('clDropdown').classList.remove('open');
}

function clSeleccionar(codigo) {
    const c = clDB.find(x => x.codigo === codigo);
    if (!c) return;
    clActual = c;

    // Sincronizar campos hidden que usa createRental()
    document.getElementById('clientName').value  = c.nombre;
    document.getElementById('clientPhone').value = c.telefono;

    // Rellenar perfil
    document.getElementById('clAvatar').textContent  = clIniciales(c.nombre);
    document.getElementById('clNombre').textContent  = c.nombre;
    document.getElementById('clCodigo').textContent  = c.codigo;
    document.getElementById('clTelefono').textContent = c.telefono;
    document.getElementById('clDpi').textContent     = c.dpi;

    const docTag = document.getElementById('clDocTag');
    if (c.doc) {
        docTag.textContent = '📄 Documentación OK';
        docTag.className   = 'cl-tag cl-tag-doc';
    } else {
        docTag.textContent = '⚠️ Sin documentos';
        docTag.className   = 'cl-tag cl-tag-warn';
    }

    // Cambiar estado visual
    document.getElementById('clEmptyState').style.display    = 'none';
    document.getElementById('clSelectedState').style.display = 'block';
    clLimpiarBusqueda();
}

function clDeseleccionar() {
    clActual = null;
    document.getElementById('clientName').value  = '';
    document.getElementById('clientPhone').value = '';
    document.getElementById('clEmptyState').style.display    = 'block';
    document.getElementById('clSelectedState').style.display = 'none';
}

// Cerrar dropdown al hacer clic fuera
document.addEventListener('click', e => {
    const wrap     = document.querySelector('.cl-search-wrap');
    const dropdown = document.getElementById('clDropdown');
    if (wrap && !wrap.contains(e.target)) dropdown.classList.remove('open');
});

// ── Modal registro ───────────────────────────────────────
function clAbrirModal() {
    clPasoActual = 1;
    clRenderPaso();
    document.getElementById('clModalOverlay').classList.add('open');
    document.body.style.overflow = 'hidden';
}

function clCerrarModal(e) {
    if (e && e.target !== document.getElementById('clModalOverlay')) return;
    document.getElementById('clModalOverlay').classList.remove('open');
    document.body.style.overflow = '';
    clResetModal();
}

function clResetModal() {
    ['clRegNombre','clRegTel','clRegDpi'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    document.getElementById('clDpiCount').textContent = '0 / 13';
    document.getElementById('clDpiCount').className   = 'cl-dpi-count';
    clQuitarArchivo();
    clPasoActual = 1;
}

function clRenderPaso() {
    const paso1 = document.getElementById('clStep1');
    const paso2 = document.getElementById('clStep2');
    const ind1  = document.getElementById('clStep1Ind');
    const ind2  = document.getElementById('clStep2Ind');
    const line  = document.querySelector('.cl-step-line');
    const btnBack   = document.getElementById('clBtnBack');
    const btnNext   = document.getElementById('clBtnNext');
    const btnGuardar= document.getElementById('clBtnGuardar');

    if (clPasoActual === 1) {
        paso1.style.display = 'block';
        paso2.style.display = 'none';
        ind1.className = 'cl-step cl-step-active';
        ind2.className = 'cl-step';
        line.className = 'cl-step-line';
        btnBack.style.display    = 'none';
        btnNext.style.display    = 'inline-flex';
        btnGuardar.style.display = 'none';
    } else {
        paso1.style.display = 'none';
        paso2.style.display = 'block';
        ind1.className = 'cl-step cl-step-done';
        ind2.className = 'cl-step cl-step-active';
        line.className = 'cl-step-line done';
        btnBack.style.display    = 'inline-flex';
        btnNext.style.display    = 'none';
        btnGuardar.style.display = 'inline-flex';
    }
}

function clSiguientePaso() {
    // Validar paso 1
    const nombre = document.getElementById('clRegNombre').value.trim();
    const tel    = document.getElementById('clRegTel').value.trim();
    const dpiRaw = document.getElementById('clRegDpi').value.replace(/\D/g,'');

    if (!nombre) { document.getElementById('clRegNombre').focus(); showToast('⚠️','Campo requerido','Ingresa el nombre del cliente'); return; }
    if (!tel)    { document.getElementById('clRegTel').focus();    showToast('⚠️','Campo requerido','Ingresa el teléfono');          return; }
    if (dpiRaw.length !== 13) { document.getElementById('clRegDpi').focus(); showToast('⚠️','DPI inválido','El DPI debe tener exactamente 13 dígitos'); return; }

    clPasoActual = 2;
    clRenderPaso();
}

function clPasoAnterior() {
    clPasoActual = 1;
    clRenderPaso();
}

function clGuardarCliente() {
    const archivo = document.getElementById('clFileInput').files[0];
    if (!archivo) { showToast('⚠️','Documentación requerida','Sube el PDF con la documentación del cliente'); return; }

    // Crear nuevo cliente (sin lógica real de BD, solo demo)
    const nombre  = document.getElementById('clRegNombre').value.trim();
    const tel     = document.getElementById('clRegTel').value.trim();
    const dpiRaw  = document.getElementById('clRegDpi').value.replace(/\D/g,'');
    const dpiForm = dpiRaw.replace(/(\d{4})(\d{5})(\d{4})/, '$1 $2 $3');
    const codigo  = 'CLI-' + String(clDB.length + 1).padStart(4,'0');

    const nuevo = { codigo, nombre, telefono: tel, dpi: dpiForm, doc: true, rentas: 0 };
    clDB.push(nuevo);

    // Cerrar modal y seleccionar automáticamente
    document.getElementById('clModalOverlay').classList.remove('open');
    document.body.style.overflow = '';
    clResetModal();

    clSeleccionar(codigo);
    showToast('✅','Cliente registrado',`${nombre} fue registrado como ${codigo} y seleccionado`);
}

// ── DPI formatter ────────────────────────────────────────
function clFormatDpi(input) {
    let raw = input.value.replace(/\D/g,'').slice(0,13);
    let fmt = raw;
    if (raw.length > 4) fmt = raw.slice(0,4)+' '+raw.slice(4);
    if (raw.length > 9) fmt = raw.slice(0,4)+' '+raw.slice(4,9)+' '+raw.slice(9);
    input.value = fmt;

    const counter = document.getElementById('clDpiCount');
    counter.textContent = `${raw.length} / 13`;
    counter.className   = 'cl-dpi-count' + (raw.length===13?' ok': raw.length>13?' err':'');
}

// ── Upload ───────────────────────────────────────────────
function clDragOver(e) {
    e.preventDefault();
    document.getElementById('clUploadZone').classList.add('drag-over');
}
function clDragLeave() {
    document.getElementById('clUploadZone').classList.remove('drag-over');
}
function clDrop(e) {
    e.preventDefault();
    document.getElementById('clUploadZone').classList.remove('drag-over');
    if (e.dataTransfer.files[0]) clProcesarArchivo(e.dataTransfer.files[0]);
}
function clArchivoElegido(input) {
    if (input.files[0]) clProcesarArchivo(input.files[0]);
}
function clProcesarArchivo(file) {
    if (file.type !== 'application/pdf') { showToast('⚠️','Formato inválido','Solo se aceptan archivos PDF'); return; }
    if (file.size > 10*1024*1024)        { showToast('⚠️','Archivo muy grande','El PDF no debe superar 10 MB'); return; }

    const size = file.size > 1024*1024
        ? (file.size/(1024*1024)).toFixed(1)+' MB'
        : (file.size/1024).toFixed(0)+' KB';

    document.getElementById('clFileName').textContent = file.name;
    document.getElementById('clFileSize').textContent = size;
    document.getElementById('clUploadIdle').style.display = 'none';
    document.getElementById('clUploadDone').style.display = 'flex';
    document.getElementById('clUploadZone').style.cssText = 'border-color:#86efac; border-style:solid;';
}
function clQuitarArchivo() {
    document.getElementById('clUploadIdle').style.display = 'block';
    document.getElementById('clUploadDone').style.display = 'none';
    document.getElementById('clUploadZone').style.cssText = '';
    document.getElementById('clFileInput').value = '';
}