const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3001;

app.use(express.json());

// ── RUTAS DE DATOS ────────────────────────────────────────────────────────────
const CONFIG_FILE  = process.env.CONFIG_FILE  || path.join(__dirname, 'data', 'config.json');
const CLIENTS_FILE = process.env.CLIENTS_FILE || path.join(__dirname, 'data', 'clients.json');

const DATA_DIR = path.dirname(CONFIG_FILE);
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(CONFIG_FILE))  fs.writeFileSync(CONFIG_FILE,  JSON.stringify({ apiKey: '' }));
if (!fs.existsSync(CLIENTS_FILE)) fs.writeFileSync(CLIENTS_FILE, JSON.stringify([]));

// ── HELPERS ───────────────────────────────────────────────────────────────────
function readConfig()    { return JSON.parse(fs.readFileSync(CONFIG_FILE,  'utf-8')); }
function writeConfig(c)  { fs.writeFileSync(CONFIG_FILE,  JSON.stringify(c, null, 2)); }
function readClients()   { return JSON.parse(fs.readFileSync(CLIENTS_FILE, 'utf-8')); }
function writeClients(c) { fs.writeFileSync(CLIENTS_FILE, JSON.stringify(c, null, 2)); }
function generateId()    { return Date.now().toString(36) + Math.random().toString(36).substr(2); }

function getAnthropic() {
  const config = readConfig();
  if (!config.apiKey) throw new Error('API key no configurada. Andá a Ajustes y guardá tu API key.');
  return new Anthropic({ apiKey: config.apiKey });
}

function parseJSON(text) {
  try { return JSON.parse(text); } catch {}
  const match = text.match(/\{[\s\S]*\}/);
  if (match) { try { return JSON.parse(match[0]); } catch {} }
  const attempts = [text + ']}', text + ']}]}', text + '"]}]}', text + '"}]}]}'];
  for (const attempt of attempts) {
    const m = attempt.match(/\{[\s\S]*\}/);
    if (m) try { return JSON.parse(m[0]); } catch {}
  }
  throw new Error('No se pudo parsear la respuesta de la IA. Intentá de nuevo.');
}

// ── CONFIG API KEY ────────────────────────────────────────────────────────────
app.get('/api/config', (req, res) => {
  const config = readConfig();
  res.json({
    hasApiKey: !!config.apiKey,
    apiKeyPreview: config.apiKey ? '••••' + config.apiKey.slice(-4) : ''
  });
});

app.post('/api/config', (req, res) => {
  const { apiKey } = req.body;
  if (!apiKey || !apiKey.startsWith('sk-')) {
    return res.status(400).json({ error: 'API key inválida. Debe comenzar con sk-' });
  }
  writeConfig({ apiKey });
  res.json({ success: true });
});

// ── CLIENTES ──────────────────────────────────────────────────────────────────
app.get('/api/clients', (req, res) => res.json(readClients()));

app.get('/api/clients/:id', (req, res) => {
  const client = readClients().find(c => c.id === req.params.id);
  if (!client) return res.status(404).json({ error: 'No encontrado' });
  res.json(client);
});

app.post('/api/clients', (req, res) => {
  const clients = readClients();
  const newClient = {
    id: generateId(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...req.body
  };
  clients.push(newClient);
  writeClients(clients);
  res.json(newClient);
});

app.put('/api/clients/:id', (req, res) => {
  const clients = readClients();
  const i = clients.findIndex(c => c.id === req.params.id);
  if (i === -1) return res.status(404).json({ error: 'No encontrado' });
  clients[i] = { ...clients[i], ...req.body, id: req.params.id, updatedAt: new Date().toISOString() };
  writeClients(clients);
  res.json(clients[i]);
});

app.delete('/api/clients/:id', (req, res) => {
  writeClients(readClients().filter(c => c.id !== req.params.id));
  res.json({ success: true });
});

// ── GENERAR PERFIL ────────────────────────────────────────────────────────────
app.post('/api/generate-profile', async (req, res) => {
  const { clientData } = req.body;
  try {
    const anthropic = getAnthropic();
    const prompt = `Sos un experto en marketing digital y community management.
Con la siguiente información generá un perfil consolidado en JSON con esta estructura exacta:
{
  "resumen": "2-3 oraciones que capturen la esencia del cliente",
  "diferencial": "qué los hace únicos, en 1-2 oraciones",
  "publicoObjetivo": {
    "descripcion": "descripción del público",
    "motivaciones": ["motivación 1", "motivación 2", "motivación 3"],
    "caracteristicas": ["característica 1", "característica 2"]
  },
  "ejesComunicacion": ["eje 1", "eje 2", "eje 3", "eje 4", "eje 5"],
  "tono": "descripción del tono de comunicación",
  "restricciones": ["restricción si hay"],
  "recomendacionesContenido": ["recomendación 1", "recomendación 2", "recomendación 3"]
}
DATOS: ${JSON.stringify(clientData, null, 2)}
Respondé SOLO con el JSON, sin texto adicional, sin bloques de código.`;

    const message = await anthropic.messages.create({
      model: 'claude-opus-4-5', max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }]
    });
    res.json(parseJSON(message.content[0].text));
  } catch (e) {
    console.error('Error generate-profile:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── GENERAR PLAN MENSUAL ──────────────────────────────────────────────────────
app.post('/api/generate-plan', async (req, res) => {
  const { clientId, month, year } = req.body;
  const clients = readClients();
  const client = clients.find(c => c.id === clientId);
  if (!client) return res.status(404).json({ error: 'Cliente no encontrado' });

  const dias = client.operativa?.diasPublicacion?.join(', ') || 'lunes y jueves';
  const freq = client.operativa?.publicacionesPorSemana || 2;

  // ── MEMORIA DE PLANES ANTERIORES ──────────────────────────────────────────
  let historialStr = '';
  if (client.planes && client.planes.length > 0) {
    const ultimosPlanesResumidos = client.planes.slice(-3).map(p => {
      const temas = (p.publicaciones || []).map(pub => pub.eje + ': ' + pub.titulo).join(' | ');
      return `${p.mes}: ${temas}`;
    });
    historialStr = `
HISTORIAL DE CONTENIDO ANTERIOR (no repetir estos temas, complementarlos):
${ultimosPlanesResumidos.join('\n')}
`;
  }

  const perfilResumido = {
    nombre: client.nombre,
    tipo: client.tipoNegocio,
    ubicacion: [client.localidad, client.provincia].filter(Boolean).join(', '),
    oferta: client.oferta,
    diferencial: client.diferencial,
    tono: client.perfilGenerado?.tono || client.percepcion,
    ejes: client.ejesComunicacion || client.perfilGenerado?.ejesComunicacion,
    publico: client.perfilGenerado?.publicoObjetivo?.descripcion || client.publicoActual,
    restricciones: client.restricciones || client.restriccionesContenido,
    palabrasClave: client.palabrasTono
  };

  try {
    const anthropic = getAnthropic();
    const prompt = `Sos un experto community manager. Generá un plan de contenidos para ${month}/${year}.

CLIENTE: ${JSON.stringify(perfilResumido, null, 2)}
${historialStr}
FRECUENCIA: ${freq} publicaciones por semana los días ${dias}, más 2 historias por semana.

Generá exactamente 4 semanas de contenido variado y que complemente el historial anterior.
Devolvé ÚNICAMENTE este JSON sin texto extra ni bloques de código:

{
  "mes": "${month}/${year}",
  "cliente": "${client.nombre}",
  "publicaciones": [
    {
      "semana": 1,
      "fecha": "lunes DD/MM",
      "tipo": "publicación",
      "formato": "foto",
      "eje": "nombre del eje",
      "titulo": "título corto interno",
      "copy": "texto completo listo para publicar con emojis y hashtags",
      "insumoVisual": "descripción de qué foto o video se necesita",
      "indicacionesParaCliente": "instrucción simple en lenguaje llano"
    }
  ],
  "tareasCliente": [
    { "semana": 1, "tareas": ["tarea concreta 1", "tarea concreta 2"] }
  ],
  "observaciones": "recomendaciones generales para el mes"
}

Incluí ${freq * 4} publicaciones y ${2 * 4} historias en total (distribuidas en 4 semanas).`;

    const message = await anthropic.messages.create({
      model: 'claude-opus-4-5', max_tokens: 8000,
      messages: [{ role: 'user', content: prompt }]
    });

    const plan = parseJSON(message.content[0].text);

    const i = clients.findIndex(c => c.id === clientId);
    if (!clients[i].planes) clients[i].planes = [];
    clients[i].planes.push({ id: generateId(), generadoEn: new Date().toISOString(), ...plan });
    writeClients(clients);

    res.json(plan);
  } catch (e) {
    console.error('Error generate-plan:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── EXPORTAR PDF DEL PLAN ────────────────────────────────────────────────────
// Devuelve HTML listo para imprimir como PDF
app.post('/api/export-plan-html', (req, res) => {
  const { plan, clientName } = req.body;
  if (!plan) return res.status(400).json({ error: 'Plan no encontrado' });

  // Agrupar por semana
  const semanas = {};
  (plan.publicaciones || []).forEach(pub => {
    const s = pub.semana || 1;
    if (!semanas[s]) semanas[s] = [];
    semanas[s].push(pub);
  });
  const tareasMap = {};
  (plan.tareasCliente || []).forEach(t => { tareasMap[t.semana] = t.tareas || []; });

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Plan ${plan.mes} — ${clientName}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=DM+Sans:wght@300;400;500&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'DM Sans', sans-serif; color: #1E1A16; background: white; padding: 40px; font-size: 13px; }
  
  .portada { margin-bottom: 40px; padding-bottom: 24px; border-bottom: 3px solid #C4622D; }
  .portada-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: #6B6157; margin-bottom: 8px; }
  .portada-titulo { font-family: 'Playfair Display', serif; font-size: 36px; font-weight: 700; color: #1E1A16; margin-bottom: 4px; }
  .portada-mes { font-size: 16px; color: #6B6157; }
  
  .semana { margin-bottom: 36px; page-break-inside: avoid; }
  .semana-titulo { font-family: 'Playfair Display', serif; font-size: 18px; font-weight: 700; color: #C4622D; margin-bottom: 12px; padding-bottom: 6px; border-bottom: 1px solid #E2DAD0; }
  
  .tareas-box { background: #3D5A3E; color: white; border-radius: 8px; padding: 14px 18px; margin-bottom: 16px; }
  .tareas-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; opacity: 0.7; margin-bottom: 8px; }
  .tarea { font-size: 13px; margin-bottom: 4px; display: flex; gap: 8px; }
  
  .pub { border: 1px solid #E2DAD0; border-radius: 8px; padding: 16px; margin-bottom: 12px; page-break-inside: avoid; }
  .pub-header { display: flex; gap: 8px; margin-bottom: 10px; flex-wrap: wrap; align-items: center; justify-content: space-between; }
  .badge { font-size: 10px; font-weight: 500; padding: 2px 8px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.05em; }
  .badge-tipo { background: #F5EDE0; color: #C4622D; }
  .badge-formato { background: #E2DAD0; color: #6B6157; }
  .badge-eje { background: #F0EBE3; color: #1E1A16; }
  .pub-fecha { font-size: 11px; color: #6B6157; }
  .pub-titulo { font-family: 'Playfair Display', serif; font-size: 15px; font-weight: 700; margin-bottom: 10px; }
  .pub-label { font-size: 10px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.06em; color: #6B6157; margin-top: 10px; margin-bottom: 4px; }
  .pub-copy { font-size: 13px; line-height: 1.7; background: #FAF7F2; border: 1px solid #E2DAD0; border-radius: 6px; padding: 10px 12px; white-space: pre-wrap; }
  .pub-insumo { font-size: 13px; line-height: 1.6; background: #FFF8F0; border: 1px solid #E8D5B7; border-radius: 6px; padding: 10px 12px; }
  .pub-indicacion { font-size: 12px; color: #3D5A3E; font-style: italic; padding: 8px 12px; background: #F0F5F0; border-radius: 6px; border-left: 3px solid #6B8F6C; margin-top: 8px; }
  
  .observaciones { background: #1E1A16; color: white; border-radius: 8px; padding: 20px 24px; margin-top: 32px; }
  .obs-titulo { font-family: 'Playfair Display', serif; font-size: 16px; margin-bottom: 8px; opacity: 0.8; }
  .obs-texto { font-size: 13px; line-height: 1.7; opacity: 0.7; }
  
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #E2DAD0; font-size: 11px; color: #6B6157; display: flex; justify-content: space-between; }

  @media print {
    body { padding: 20px; }
    .semana { page-break-inside: avoid; }
    .pub { page-break-inside: avoid; }
  }
</style>
</head>
<body>

<div class="portada">
  <div class="portada-label">Plan de contenidos</div>
  <div class="portada-titulo">${clientName}</div>
  <div class="portada-mes">${plan.mes}</div>
</div>

${Object.entries(semanas).map(([semana, pubs]) => `
<div class="semana">
  <div class="semana-titulo">Semana ${semana}</div>

  ${tareasMap[semana] ? `
  <div class="tareas-box">
    <div class="tareas-label">📋 Tareas para el cliente esta semana</div>
    ${tareasMap[semana].map(t => `<div class="tarea"><span>→</span><span>${t}</span></div>`).join('')}
  </div>` : ''}

  ${pubs.map(pub => `
  <div class="pub">
    <div class="pub-header">
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <span class="badge badge-tipo">${pub.tipo || 'publicación'}</span>
        <span class="badge badge-formato">${pub.formato || ''}</span>
        <span class="badge badge-eje">${pub.eje || ''}</span>
      </div>
      <span class="pub-fecha">${pub.fecha || ''}</span>
    </div>
    <div class="pub-titulo">${pub.titulo || ''}</div>
    
    <div class="pub-label">Copy para publicar</div>
    <div class="pub-copy">${pub.copy || ''}</div>
    
    ${pub.insumoVisual ? `
    <div class="pub-label">📸 Insumo visual necesario</div>
    <div class="pub-insumo">${pub.insumoVisual}</div>` : ''}
    
    ${pub.indicacionesParaCliente ? `
    <div class="pub-indicacion">💡 ${pub.indicacionesParaCliente}</div>` : ''}
  </div>`).join('')}
</div>`).join('')}

${plan.observaciones ? `
<div class="observaciones">
  <div class="obs-titulo">Observaciones del mes</div>
  <div class="obs-texto">${plan.observaciones}</div>
</div>` : ''}

<div class="footer">
  <span>Generado con Planificador de Redes sociales de Rutas Digitales</span>
  <span>${new Date().toLocaleDateString('es-AR', { day:'numeric', month:'long', year:'numeric' })}</span>
</div>

</body>
</html>`;

  res.json({ html });
});

// ── ESTÁTICOS ─────────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => console.log(`CM Tool en http://localhost:${PORT}`));