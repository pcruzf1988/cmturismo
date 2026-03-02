// ── ESTADO GLOBAL ─────────────────────────────────────────────────────────────
const state = {
  clients: [],
  currentClient: null,
  currentPlan: null,
  previousView: 'dashboard',
  wizard: { step: 0, data: {} }
};

// ── INICIALIZACIÓN ────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  setupNav();
  await checkApiKey();
  await loadClients();
  showView('dashboard');
});

// ── CHECK API KEY ─────────────────────────────────────────────────────────────
async function checkApiKey() {
  try {
    const res = await fetch('/api/config');
    const data = await res.json();
    if (!data.hasApiKey) {
      showView('settings');
    } else {
      updateApiKeyStatus(data.apiKeyPreview);
    }
  } catch (e) {
    console.error('Error verificando config:', e);
  }
}

function updateApiKeyStatus(preview) {
  const badge = document.getElementById('api-key-badge');
  if (badge) badge.textContent = preview || '••••';
}

// ── NAVEGACIÓN ────────────────────────────────────────────────────────────────
function setupNav() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const view = item.dataset.view;
      showView(view);
    });
  });
}

function showView(viewName) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const view = document.getElementById(`view-${viewName}`);
  if (view) view.classList.add('active');

  document.querySelectorAll('.nav-item').forEach(n => {
    n.classList.toggle('active', n.dataset.view === viewName);
  });

  if (viewName === 'dashboard') renderDashboard();
  if (viewName === 'clients')   renderClientsList();
}

function goBack()           { showView(state.previousView || 'dashboard'); }
function goBackToClient()   { showView('client-detail'); renderClientDetail(state.currentClient); }

// ── CLIENTES: API ─────────────────────────────────────────────────────────────
async function loadClients() {
  try {
    const res = await fetch('/api/clients');
    state.clients = await res.json();
  } catch (e) {
    showToast('Error cargando clientes', 'error');
  }
}

async function saveClient(clientData) {
  const res = await fetch('/api/clients', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(clientData)
  });
  return res.json();
}

// ── DASHBOARD ─────────────────────────────────────────────────────────────────
function renderDashboard() {
  const totalPlanes = state.clients.reduce((s, c) => s + (c.planes?.length || 0), 0);
  const totalPosts  = state.clients.reduce((s, c) =>
    s + (c.planes?.reduce((ps, p) => ps + (p.publicaciones?.length || 0), 0) || 0), 0);

  document.getElementById('stat-clients').textContent = state.clients.length;
  document.getElementById('stat-plans').textContent   = totalPlanes;
  document.getElementById('stat-posts').textContent   = totalPosts;

  const container = document.getElementById('dashboard-clients');
  if (state.clients.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">✦</div>
        <p>Todavía no hay clientes.<br>Agregá el primero para empezar.</p>
        <button class="btn-secondary" onclick="showNewClientWizard()">Agregar cliente</button>
      </div>`;
    return;
  }
  const recent = [...state.clients].reverse().slice(0, 4);
  container.innerHTML = recent.map(clientCardHTML).join('');
}

function renderClientsList() {
  const container = document.getElementById('clients-list');
  if (state.clients.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">✦</div>
        <p>Todavía no hay clientes.</p>
        <button class="btn-secondary" onclick="showNewClientWizard()">Agregar cliente</button>
      </div>`;
    return;
  }
  container.innerHTML = state.clients.map(clientCardHTML).join('');
}

function clientCardHTML(client) {
  const planes = client.planes?.length || 0;
  return `
    <div class="client-card" onclick="openClient('${client.id}')">
      <div class="client-card-type">${client.tipoNegocio || 'Negocio'}</div>
      <div class="client-card-name">${client.nombre}</div>
      <div class="client-card-location">${[client.localidad, client.provincia].filter(Boolean).join(', ')}</div>
      <div class="client-card-footer">
        <span class="client-card-plans">${planes} ${planes === 1 ? 'plan' : 'planes'} generados</span>
        <span class="client-card-arrow">→</span>
      </div>
    </div>`;
}

function openClient(clientId) {
  state.currentClient = state.clients.find(c => c.id === clientId);
  state.previousView = document.querySelector('.view.active')?.id?.replace('view-', '') || 'dashboard';
  renderClientDetail(state.currentClient);
  showView('client-detail');
}

// ── DETALLE DE CLIENTE ────────────────────────────────────────────────────────
function renderClientDetail(client) {
  if (!client) return;
  const profile = client.perfilGenerado || {};
  const ejes = profile.ejesComunicacion || client.ejesComunicacion || [];

  document.getElementById('client-detail-content').innerHTML = `
    <div class="client-detail-header">
      <div class="client-detail-type">${client.tipoNegocio || 'Negocio'}</div>
      <div class="client-detail-name">${client.nombre}</div>
      <div class="client-detail-location">
        ${[client.localidad, client.departamento, client.provincia].filter(Boolean).join(', ')}
      </div>
      ${profile.resumen ? `<div class="client-detail-summary">${profile.resumen}</div>` : ''}
    </div>

    <div class="detail-grid">
      ${profile.diferencial ? `
      <div class="detail-card">
        <div class="detail-card-title">Diferencial</div>
        <p style="font-size:14px;line-height:1.7;color:var(--carbon)">${profile.diferencial}</p>
      </div>` : ''}

      ${profile.tono ? `
      <div class="detail-card">
        <div class="detail-card-title">Tono de comunicación</div>
        <p style="font-size:14px;line-height:1.7;color:var(--carbon)">${profile.tono}</p>
      </div>` : ''}

      ${ejes.length > 0 ? `
      <div class="detail-card">
        <div class="detail-card-title">Ejes de comunicación</div>
        ${ejes.map(e => `<div class="eje-item"><span class="eje-dot"></span>${e}</div>`).join('')}
      </div>` : ''}

      ${profile.publicoObjetivo ? `
      <div class="detail-card">
        <div class="detail-card-title">Público objetivo</div>
        <p style="font-size:14px;line-height:1.7;color:var(--carbon);margin-bottom:12px">${profile.publicoObjetivo.descripcion || ''}</p>
        <div class="tag-list">
          ${(profile.publicoObjetivo.motivaciones || []).map(m => `<span class="tag-item">${m}</span>`).join('')}
        </div>
      </div>` : ''}
    </div>

    ${client.planes?.length > 0 ? `
    <div class="section-title-row"><h2>Planes generados</h2></div>
    <div class="clients-grid">
      ${client.planes.map(plan => `
        <div class="client-card" onclick="viewPlan('${client.id}', '${plan.id}')">
          <div class="client-card-type">Plan mensual</div>
          <div class="client-card-name">${plan.mes}</div>
          <div class="client-card-location">${plan.publicaciones?.length || 0} publicaciones</div>
          <div class="client-card-footer">
            <span class="client-card-plans">Generado el ${new Date(plan.generadoEn).toLocaleDateString('es-AR')}</span>
            <span class="client-card-arrow">→</span>
          </div>
        </div>`).join('')}
    </div>` : ''}
  `;
}

function viewPlan(clientId, planId) {
  const client = state.clients.find(c => c.id === clientId);
  const plan = client?.planes?.find(p => p.id === planId);
  if (!plan) return;
  state.currentPlan = plan;
  renderPlan(plan, client);
  showView('plan');
}

// ── GENERAR PLAN ──────────────────────────────────────────────────────────────
async function generatePlan() {
  if (!state.currentClient) return;
  const now   = new Date();
  const month = now.getMonth() + 2 > 12 ? 1 : now.getMonth() + 2;
  const year  = month === 1 ? now.getFullYear() + 1 : now.getFullYear();

  showLoading('Generando plan mensual con IA...');
  try {
    const res = await fetch('/api/generate-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: state.currentClient.id, month, year })
    });
    const plan = await res.json();
    if (plan.error) throw new Error(plan.error);

    await loadClients();
    state.currentClient = state.clients.find(c => c.id === state.currentClient.id);
    state.currentPlan = plan;

    hideLoading();
    renderPlan(plan, state.currentClient);
    showView('plan');
    showToast('Plan generado con éxito', 'success');
  } catch (e) {
    hideLoading();
    showToast('Error: ' + e.message, 'error');
  }
}

function renderPlan(plan, client) {
  const semanas = {};
  (plan.publicaciones || []).forEach(pub => {
    const s = pub.semana || 1;
    if (!semanas[s]) semanas[s] = [];
    semanas[s].push(pub);
  });
  const tareasMap = {};
  (plan.tareasCliente || []).forEach(t => { tareasMap[t.semana] = t.tareas || []; });

  document.getElementById('plan-content').innerHTML = `
    <div class="plan-header">
      <div class="plan-header-title">Plan de contenidos</div>
      <div class="plan-header-name">${client?.nombre || ''}</div>
      <div class="plan-header-month">${plan.mes}</div>
    </div>
    ${Object.entries(semanas).map(([semana, pubs]) => `
      <div class="semana-section">
        <div class="semana-title">Semana ${semana}</div>
        ${tareasMap[semana] ? `
        <div style="background:var(--verde);color:white;border-radius:var(--radius-sm);padding:16px 20px;margin-bottom:20px">
          <div style="font-size:11px;font-weight:500;text-transform:uppercase;letter-spacing:0.06em;opacity:0.7;margin-bottom:8px">Tareas para el cliente</div>
          ${tareasMap[semana].map(t => `<div style="font-size:14px;margin-bottom:6px;display:flex;gap:8px"><span>→</span><span>${t}</span></div>`).join('')}
        </div>` : ''}
        ${pubs.map(pub => publicacionCardHTML(pub)).join('')}
      </div>`).join('')}
    ${plan.observaciones ? `
    <div class="plan-observaciones">
      <div class="plan-observaciones-title">Observaciones del mes</div>
      <p>${plan.observaciones}</p>
    </div>` : ''}`;
}

function publicacionCardHTML(pub) {
  return `
    <div class="publicacion-card">
      <div class="pub-header">
        <div class="pub-badge-row">
          <span class="pub-badge ${pub.tipo === 'historia' ? 'tipo-historia' : 'tipo-publicacion'}">${pub.tipo || 'publicación'}</span>
          <span class="pub-badge formato">${pub.formato || ''}</span>
          <span class="pub-badge eje">${pub.eje || ''}</span>
        </div>
        <span class="pub-date">${pub.fecha || ''}</span>
      </div>
      <div class="pub-titulo">${pub.titulo || ''}</div>
      <div class="pub-section-label">Copy listo para publicar</div>
      <div class="pub-copy" onclick="copyText(this)">
        ${pub.copy || ''}
        <button class="copy-btn">Copiar</button>
      </div>
      ${pub.insumoVisual ? `
      <div class="pub-section-label">Insumo visual necesario</div>
      <div class="pub-insumo">${pub.insumoVisual}</div>` : ''}
      ${pub.indicacionesParaCliente ? `
      <div class="pub-indicacion">💡 Para el cliente: ${pub.indicacionesParaCliente}</div>` : ''}
    </div>`;
}

function copyText(element) {
  const text = element.innerText.replace('Copiar', '').trim();
  navigator.clipboard.writeText(text).then(() => showToast('Copy copiado', 'success'));
}

async function exportPlanPDF() {
  if (!state.currentPlan) return showToast('No hay plan para exportar', 'error');

  showLoading('Generando PDF...');
  try {
    const res = await fetch('/api/export-plan-html', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        plan: state.currentPlan,
        clientName: state.currentClient?.nombre || ''
      })
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    const clientName = state.currentClient?.nombre || 'cliente';
    const mes = (state.currentPlan?.mes || 'plan').replace('/', '-');
    const filename = 'Plan ' + clientName + ' ' + mes + '.pdf';

    const result = await window.electronAPI.savePDF(data.html, filename);

    hideLoading();
    if (result.success) {
      showToast('PDF guardado correctamente', 'success');
    } else if (result.reason !== 'canceled') {
      showToast('Error al guardar: ' + result.reason, 'error');
    }
  } catch (e) {
    hideLoading();
    showToast('Error exportando: ' + e.message, 'error');
  }
}

async function saveApiKey() {
  const apiKey = document.getElementById('settings-api-key').value.trim();
  if (!apiKey) return showToast('Ingresá tu API key', 'error');

  showLoading('Guardando...');
  try {
    const res = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey })
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    hideLoading();
    showToast('API key guardada correctamente', 'success');
    document.getElementById('settings-api-key').value = '';
    await checkApiKey();
    showView('dashboard');
  } catch (e) {
    hideLoading();
    showToast('Error: ' + e.message, 'error');
  }
}

// ── WIZARD ────────────────────────────────────────────────────────────────────
const WIZARD_STEPS = [
  {
    eyebrow: 'Bloque 1 de 6', title: 'Identidad del cliente',
    description: '¿Con quién estamos trabajando? Contanos lo básico para armar el perfil.',
    render: () => `
      <div class="form-group">
        <label class="form-label">Nombre del cliente o proyecto</label>
        <input class="form-input" id="w-nombre" placeholder="Ej: Saberes de la Quebrada" value="${getWD('nombre')}">
      </div>
      <div class="form-group">
        <label class="form-label">¿Qué tipo de negocio o proyecto es?</label>
        <div class="options-grid">
          ${[
            { value: 'Turismo rural',        desc: 'Experiencias, hospedajes, guiaturas' },
            { value: 'Turismo urbano',        desc: 'Hoteles, tours, gastronomía urbana' },
            { value: 'Gastronomía',           desc: 'Restaurantes, catering, productos' },
            { value: 'Artesanía / Productos', desc: 'Productos físicos, artesanía' },
            { value: 'Institución pública',   desc: 'Municipios, secretarías, organismos' },
            { value: 'Servicio profesional',  desc: 'Salud, legal, consultoría, etc' },
            { value: 'Comercio',              desc: 'Tienda física u online' },
            { value: 'Otro',                  desc: 'Otro tipo de negocio' }
          ].map(opt => `
            <div class="option-card ${getWD('tipoNegocio') === opt.value ? 'selected' : ''}" onclick="selectOption(this, 'tipoNegocio', '${opt.value}')">
              <div class="option-card-label">${opt.value}</div>
              <div class="option-card-desc">${opt.desc}</div>
            </div>`).join('')}
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px">
        <div class="form-group">
          <label class="form-label">Localidad</label>
          <input class="form-input" id="w-localidad" placeholder="Ej: Tilcara" value="${getWD('localidad')}">
        </div>
        <div class="form-group">
          <label class="form-label">Departamento</label>
          <input class="form-input" id="w-departamento" placeholder="Ej: Tilcara" value="${getWD('departamento')}">
        </div>
        <div class="form-group">
          <label class="form-label">Provincia</label>
          <input class="form-input" id="w-provincia" placeholder="Ej: Jujuy" value="${getWD('provincia')}">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">¿Es una red, asociación o tiene múltiples emprendimientos?</label>
        <div style="display:flex;gap:12px">
          <div class="option-card ${getWD('esRed') === 'si' ? 'selected' : ''}" style="flex:1" onclick="selectOption(this, 'esRed', 'si')">
            <div class="option-card-label">Sí</div>
            <div class="option-card-desc">Tiene miembros o emprendimientos internos</div>
          </div>
          <div class="option-card ${getWD('esRed') === 'no' ? 'selected' : ''}" style="flex:1" onclick="selectOption(this, 'esRed', 'no')">
            <div class="option-card-label">No</div>
            <div class="option-card-desc">Es un negocio individual</div>
          </div>
        </div>
      </div>
      ${getWD('esRed') === 'si' ? `
      <div class="form-group">
        <label class="form-label">¿Cuántos miembros la integran? <span class="optional">(aprox)</span></label>
        <input class="form-input" id="w-cantMiembros" type="number" placeholder="Ej: 15" value="${getWD('cantMiembros')}">
      </div>` : ''}`,
    save: () => ({ nombre: val('w-nombre'), localidad: val('w-localidad'), departamento: val('w-departamento'), provincia: val('w-provincia'), cantMiembros: val('w-cantMiembros') })
  },
  {
    eyebrow: 'Bloque 2 de 6', title: 'Oferta y diferencial',
    description: '¿Qué ofrecen y qué los hace únicos? Esto es la base de toda la comunicación.',
    render: () => `
      <div class="form-group">
        <label class="form-label">¿Qué productos o servicios ofrecen?</label>
        <textarea class="form-textarea" id="w-oferta" placeholder="Ej: Gastronomía regional, hospedajes rurales, cabalgatas...">${getWD('oferta')}</textarea>
      </div>
      <div class="form-group">
        <label class="form-label">¿Qué los hace únicos o difíciles de encontrar en otro lado?</label>
        <textarea class="form-textarea" id="w-diferencial" placeholder="Ej: El intercambio genuino con comunidades indígenas...">${getWD('diferencial')}</textarea>
      </div>
      <div class="form-group">
        <label class="form-label">¿Cómo se accede?</label>
        <div class="options-grid">
          ${['Presencialmente','Online','Mixto','Con envío'].map(opt => `
            <div class="option-card ${getWD('acceso') === opt ? 'selected' : ''}" onclick="selectOption(this, 'acceso', '${opt}')">
              <div class="option-card-label">${opt}</div>
            </div>`).join('')}
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">¿Hay algo que NO quieren mostrar? <span class="optional">(opcional)</span></label>
        <textarea class="form-textarea" id="w-restricciones" placeholder="Ej: Sitios sagrados, rituales específicos..." style="min-height:80px">${getWD('restricciones')}</textarea>
      </div>`,
    save: () => ({ oferta: val('w-oferta'), diferencial: val('w-diferencial'), restricciones: val('w-restricciones') })
  },
  {
    eyebrow: 'Bloque 3 de 6', title: 'Público objetivo',
    description: '¿A quién le hablan? Cuanto mejor entendamos a esa persona, mejor el contenido.',
    render: () => `
      <div class="form-group">
        <label class="form-label">¿A quién le hablan hoy?</label>
        <textarea class="form-textarea" id="w-publicoActual" placeholder="Ej: Turistas nacionales de clase media-alta, mayores de 30 años...">${getWD('publicoActual')}</textarea>
      </div>
      <div class="form-group">
        <label class="form-label">¿A quién les gustaría llegar?</label>
        <textarea class="form-textarea" id="w-publicoDeseado" placeholder="Ej: También turistas extranjeros europeos...">${getWD('publicoDeseado')}</textarea>
      </div>
      <div class="form-group">
        <label class="form-label">¿Qué motiva a ese público?</label>
        <textarea class="form-textarea" id="w-motivaciones" placeholder="Ej: Buscan conexión genuina, naturaleza, autenticidad...">${getWD('motivaciones')}</textarea>
      </div>
      <div class="form-group">
        <label class="form-label">¿Cómo viaja o consume ese público?</label>
        <div class="options-grid">
          ${['Solo/a','En pareja','En familia','En grupo'].map(opt => `
            <div class="option-card ${(getWD('formaViaje') || []).includes(opt) ? 'selected' : ''}" onclick="toggleMultiOption(this, 'formaViaje', '${opt}')">
              <div class="option-card-label">${opt}</div>
            </div>`).join('')}
        </div>
        <p class="form-hint">Podés seleccionar más de una</p>
      </div>`,
    save: () => ({ publicoActual: val('w-publicoActual'), publicoDeseado: val('w-publicoDeseado'), motivaciones: val('w-motivaciones') })
  },
  {
    eyebrow: 'Bloque 4 de 6', title: 'Voz y estilo',
    description: '¿Cómo quieren que la gente los perciba? El tono lo es todo.',
    render: () => `
      <div class="form-group">
        <label class="form-label">¿Cómo quieren que la gente los perciba?</label>
        <textarea class="form-textarea" id="w-percepcion" placeholder="Ej: Auténticos, cálidos, hospitalarios, conectados a la tierra..." style="min-height:80px">${getWD('percepcion')}</textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Tres palabras que describen el tono</label>
        <div class="tags-container" id="tags-palabrasTono" onclick="document.getElementById('input-palabrasTono').focus()">
          ${(getWD('palabrasTono') || []).map(t => `<span class="tag">${t}<span class="tag-remove" onclick="removeTag('palabrasTono','${t}')">×</span></span>`).join('')}
          <input class="tags-input" id="input-palabrasTono" placeholder="Escribí y presioná Enter..." onkeydown="handleTagInput(event, 'palabrasTono')">
        </div>
        <p class="form-hint">Ej: Cercano, auténtico, respetuoso</p>
      </div>
      <div class="form-group">
        <label class="form-label">¿El tono es más formal o informal?</label>
        <div style="display:flex;gap:12px">
          ${['Muy informal','Informal','Equilibrado','Formal'].map(opt => `
            <div class="option-card ${getWD('nivelFormalidad') === opt ? 'selected' : ''}" style="flex:1;text-align:center" onclick="selectOption(this, 'nivelFormalidad', '${opt}')">
              <div class="option-card-label" style="font-size:13px">${opt}</div>
            </div>`).join('')}
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Cuentas de referencia <span class="optional">(opcional)</span></label>
        <input class="form-input" id="w-referencias" placeholder="Ej: @turismohumahuaca, @visitargentina..." value="${getWD('referencias')}">
      </div>`,
    save: () => ({ percepcion: val('w-percepcion'), referencias: val('w-referencias') })
  },
  {
    eyebrow: 'Bloque 5 de 6', title: 'Ejes de comunicación',
    description: 'Los temas sobre los que van a hablar. Confirmá, ajustá o agregá los que quieras.',
    render: () => {
      const tipo = state.wizard.data.tipoNegocio || '';
      const sugeridos = suggestEjes(tipo);
      const current = getWD('ejesComunicacion') || sugeridos;
      if (!state.wizard.data.ejesComunicacion) state.wizard.data.ejesComunicacion = current;
      return `
        <div class="form-group">
          <label class="form-label">Ejes de comunicación sugeridos</label>
          <p class="form-hint" style="margin-bottom:16px">Clic para quitar. Escribí abajo para agregar.</p>
          <div class="tags-container" id="tags-ejesComunicacion" onclick="document.getElementById('input-ejesComunicacion').focus()">
            ${current.map(t => `<span class="tag">${t}<span class="tag-remove" onclick="removeTag('ejesComunicacion','${t}')">×</span></span>`).join('')}
            <input class="tags-input" id="input-ejesComunicacion" placeholder="Agregar eje..." onkeydown="handleTagInput(event, 'ejesComunicacion')">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Objetivos principales en redes</label>
          <textarea class="form-textarea" id="w-objetivos" placeholder="Ej: Aumentar visibilidad, atraer turistas, difundir la cultura..." style="min-height:80px">${getWD('objetivos')}</textarea>
        </div>`;
    },
    save: () => ({ objetivos: val('w-objetivos') })
  },
  {
    eyebrow: 'Bloque 6 de 6', title: 'Operativa de contenido',
    description: '¿Con qué recursos cuentan para generar contenido?',
    render: () => `
      <div class="form-group">
        <label class="form-label">¿Con qué frecuencia publican?</label>
        <div style="display:flex;gap:12px">
          ${['1 vez por semana','2 veces por semana','3 veces por semana','Todos los días'].map(opt => `
            <div class="option-card ${getWD('frecuenciaPublicacion') === opt ? 'selected' : ''}" style="flex:1;text-align:center" onclick="selectOption(this, 'frecuenciaPublicacion', '${opt}')">
              <div class="option-card-label" style="font-size:12px">${opt}</div>
            </div>`).join('')}
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">¿Qué días prefieren publicar?</label>
        <div class="dias-grid">
          ${['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'].map(dia => `
            <button class="dia-btn ${(getWD('diasPublicacion') || []).includes(dia) ? 'selected' : ''}" onclick="toggleDia(this, '${dia}')">${dia}</button>`).join('')}
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">¿Quién genera las fotos y videos?</label>
        <div class="options-grid">
          ${['Yo (community manager)','El cliente','Ambos','Fotógrafo profesional'].map(opt => `
            <div class="option-card ${getWD('generadorContenido') === opt ? 'selected' : ''}" onclick="selectOption(this, 'generadorContenido', '${opt}')">
              <div class="option-card-label">${opt}</div>
            </div>`).join('')}
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">¿Tienen material disponible hoy?</label>
        <div style="display:flex;gap:12px">
          ${['Sí, bastante','Algo','Poco','No, hay que generarlo'].map(opt => `
            <div class="option-card ${getWD('materialDisponible') === opt ? 'selected' : ''}" style="flex:1;text-align:center" onclick="selectOption(this, 'materialDisponible', '${opt}')">
              <div class="option-card-label" style="font-size:12px">${opt}</div>
            </div>`).join('')}
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Restricciones de contenido <span class="optional">(opcional)</span></label>
        <textarea class="form-textarea" id="w-restriccionesContenido" style="min-height:80px">${getWD('restriccionesContenido')}</textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Notas adicionales <span class="optional">(opcional)</span></label>
        <textarea class="form-textarea" id="w-notas" style="min-height:80px">${getWD('notas')}</textarea>
      </div>`,
    save: () => ({ restriccionesContenido: val('w-restriccionesContenido'), notas: val('w-notas') })
  }
];

function showNewClientWizard() {
  state.wizard = { step: 0, data: {} };
  renderWizardStep();
  showView('wizard');
}

function cancelWizard() { showView(state.previousView || 'dashboard'); }

function renderWizardStep() {
  const step = WIZARD_STEPS[state.wizard.step];
  const total = WIZARD_STEPS.length;
  const current = state.wizard.step + 1;
  document.getElementById('progress-fill').style.width = `${(current / total) * 100}%`;
  document.getElementById('progress-text').textContent = `Paso ${current} de ${total}`;
  document.getElementById('btn-prev').style.visibility = current === 1 ? 'hidden' : 'visible';
  document.getElementById('btn-next').textContent = current === total ? 'Guardar cliente' : 'Siguiente';
  document.getElementById('wizard-step').innerHTML = `
    <div class="wizard-step">
      <div class="step-eyebrow">${step.eyebrow}</div>
      <h2 class="step-title">${step.title}</h2>
      <p class="step-description">${step.description}</p>
      ${step.render()}
    </div>`;
}

function wizardNext() {
  const step = WIZARD_STEPS[state.wizard.step];
  Object.assign(state.wizard.data, step.save());
  if (state.wizard.step === 0 && (!state.wizard.data.nombre || !state.wizard.data.tipoNegocio)) {
    return showToast('Completá al menos el nombre y el tipo de negocio', 'error');
  }
  if (state.wizard.step < WIZARD_STEPS.length - 1) {
    state.wizard.step++;
    renderWizardStep();
    window.scrollTo(0, 0);
  } else {
    finishWizard();
  }
}

function wizardPrev() {
  Object.assign(state.wizard.data, WIZARD_STEPS[state.wizard.step].save());
  if (state.wizard.step > 0) { state.wizard.step--; renderWizardStep(); window.scrollTo(0, 0); }
}

async function finishWizard() {
  showLoading('Generando perfil del cliente con IA...');
  try {
    const res = await fetch('/api/generate-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientData: state.wizard.data })
    });
    const profile = await res.json();
    if (profile.error) throw new Error(profile.error);

    const clientData = {
      ...state.wizard.data,
      perfilGenerado: profile,
      ejesComunicacion: profile.ejesComunicacion || state.wizard.data.ejesComunicacion || [],
      operativa: {
        frecuenciaPublicacion: state.wizard.data.frecuenciaPublicacion,
        diasPublicacion: state.wizard.data.diasPublicacion || [],
        generadorContenido: state.wizard.data.generadorContenido,
        materialDisponible: state.wizard.data.materialDisponible,
        publicacionesPorSemana: parseInt(state.wizard.data.frecuenciaPublicacion) || 2
      }
    };

    const newClient = await saveClient(clientData);
    state.clients.push(newClient);
    state.currentClient = newClient;
    hideLoading();
    showToast('Cliente creado con éxito', 'success');
    renderClientDetail(newClient);
    showView('client-detail');
  } catch (e) {
    hideLoading();
    showToast('Error: ' + e.message, 'error');
  }
}

// ── WIZARD HELPERS ────────────────────────────────────────────────────────────
function getWD(key) { return state.wizard.data[key] || ''; }
function val(id) { const el = document.getElementById(id); return el ? el.value : ''; }

function selectOption(el, key, value) {
  el.parentElement.querySelectorAll('.option-card').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  state.wizard.data[key] = value;
  if (key === 'tipoNegocio' || key === 'esRed') {
    const step = WIZARD_STEPS[state.wizard.step];
    Object.assign(state.wizard.data, step.save());
    document.getElementById('wizard-step').innerHTML = `
      <div class="wizard-step">
        <div class="step-eyebrow">${step.eyebrow}</div>
        <h2 class="step-title">${step.title}</h2>
        <p class="step-description">${step.description}</p>
        ${step.render()}
      </div>`;
  }
}

function toggleMultiOption(el, key, value) {
  let arr = state.wizard.data[key] || [];
  if (arr.includes(value)) { arr = arr.filter(v => v !== value); el.classList.remove('selected'); }
  else { arr.push(value); el.classList.add('selected'); }
  state.wizard.data[key] = arr;
}

function toggleDia(el, dia) {
  let dias = state.wizard.data.diasPublicacion || [];
  if (dias.includes(dia)) { dias = dias.filter(d => d !== dia); el.classList.remove('selected'); }
  else { dias.push(dia); el.classList.add('selected'); }
  state.wizard.data.diasPublicacion = dias;
}

function handleTagInput(event, key) {
  if (event.key === 'Enter' || event.key === ',') {
    event.preventDefault();
    const value = event.target.value.trim().replace(',', '');
    if (!value) return;
    const arr = state.wizard.data[key] || [];
    if (!arr.includes(value)) arr.push(value);
    state.wizard.data[key] = arr;
    event.target.value = '';
    refreshTags(key);
  }
}

function removeTag(key, value) {
  state.wizard.data[key] = (state.wizard.data[key] || []).filter(t => t !== value);
  refreshTags(key);
}

function refreshTags(key) {
  const container = document.getElementById(`tags-${key}`);
  const input = document.getElementById(`input-${key}`);
  if (!container || !input) return;
  container.innerHTML = (state.wizard.data[key] || []).map(t =>
    `<span class="tag">${t}<span class="tag-remove" onclick="removeTag('${key}','${t}')">×</span></span>`).join('') +
    `<input class="tags-input" id="input-${key}" placeholder="${input.placeholder}" onkeydown="handleTagInput(event, '${key}')">`;
  document.getElementById(`input-${key}`).focus();
}

function suggestEjes(tipo) {
  const map = {
    'Turismo rural':        ['Naturaleza y territorio','Cultura e identidad local','Experiencias vivenciales','Gastronomía regional','Historias de familias y comunidades','Turismo responsable'],
    'Turismo urbano':       ['Atractivos y actividades','Gastronomía y vida nocturna','Historia y cultura','Tips y recomendaciones','Testimonios de visitantes','Eventos'],
    'Gastronomía':          ['Platos y menús','Proceso de elaboración','Origen de ingredientes','Historia del lugar','Detrás de escena','Eventos y temporadas'],
    'Artesanía / Productos':['Proceso artesanal','Historia del producto','Materiales e ingredientes','Detrás de escena','Historia de quien lo hace','Cómo usar el producto'],
    'Institución pública':  ['Novedades y actividades','Patrimonio local','Servicios disponibles','Historia y cultura','Eventos importantes','Comunidad y territorio'],
  };
  return map[tipo] || ['Identidad y valores','Productos y servicios','Detrás de escena','Testimonios','Novedades','Tips'];
}

// ── LOADING & TOAST ───────────────────────────────────────────────────────────
function showLoading(text = 'Procesando...') {
  document.getElementById('loading-text').textContent = text;
  document.getElementById('loading-overlay').classList.add('active');
}
function hideLoading() { document.getElementById('loading-overlay').classList.remove('active'); }

function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}