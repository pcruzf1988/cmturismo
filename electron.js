const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

// ── RUTAS DE DATOS ────────────────────────────────────────────────────────────
const USER_DATA    = app.getPath('userData');
const CONFIG_FILE  = path.join(USER_DATA, 'config.json');
const CLIENTS_FILE = path.join(USER_DATA, 'clients.json');

if (!fs.existsSync(CONFIG_FILE))  fs.writeFileSync(CONFIG_FILE,  JSON.stringify({ apiKey: '' }));
if (!fs.existsSync(CLIENTS_FILE)) fs.writeFileSync(CLIENTS_FILE, JSON.stringify([]));

process.env.CONFIG_FILE  = CONFIG_FILE;
process.env.CLIENTS_FILE = CLIENTS_FILE;

require('./server.js');

// ── VENTANA PRINCIPAL ─────────────────────────────────────────────────────────
let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'assets', process.platform === 'win32' ? 'icon.ico' : 'icon.png'),
    show: false
  });

  setTimeout(() => {
    mainWindow.loadURL('http://localhost:3001');
    mainWindow.show();
  }, 800);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

// ── GENERAR Y GUARDAR PDF ─────────────────────────────────────────────────────
ipcMain.handle('save-pdf', async (event, { html, filename }) => {
  try {
    // Diálogo para elegir dónde guardar
    const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
      title: 'Guardar plan como PDF',
      defaultPath: path.join(app.getPath('downloads'), filename || 'plan-contenidos.pdf'),
      filters: [{ name: 'PDF', extensions: ['pdf'] }]
    });

    if (canceled || !filePath) return { success: false, reason: 'canceled' };

    // Ventana oculta para renderizar el HTML y exportar a PDF
    const pdfWindow = new BrowserWindow({
      width: 900,
      height: 1200,
      show: false,
      webPreferences: { nodeIntegration: false, contextIsolation: true }
    });

    await pdfWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));

    // Esperar que carguen las fuentes
    await new Promise(resolve => setTimeout(resolve, 1500));

    const pdfBuffer = await pdfWindow.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4',
      margins: { top: 0, bottom: 0, left: 0, right: 0 }
    });

    pdfWindow.close();

    fs.writeFileSync(filePath, pdfBuffer);

    // Abrir el PDF con la app por defecto del sistema
    shell.openPath(filePath);

    return { success: true, filePath };
  } catch (e) {
    console.error('Error generando PDF:', e);
    return { success: false, reason: e.message };
  }
});

// ── CICLO DE VIDA ─────────────────────────────────────────────────────────────
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});