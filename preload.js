const { contextBridge, ipcRenderer } = require('electron');

// Exponemos solo lo necesario al frontend de forma segura
contextBridge.exposeInMainWorld('electronAPI', {
  savePDF: (html, filename) => ipcRenderer.invoke('save-pdf', { html, filename })
});