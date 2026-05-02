const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getPhotos: () => ipcRenderer.invoke('get-photos'),
  savePhotos: (photos) => ipcRenderer.send('save-photos', photos),
  getPhotoPath: (name) => ipcRenderer.invoke('get-photo-path', name)
});
