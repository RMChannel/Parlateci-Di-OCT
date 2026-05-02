import { app, BrowserWindow, ipcMain, protocol, net } from 'electron';
import path from 'path';
import fs from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import isDev from 'electron-is-dev';
import Store from 'electron-store';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const store = new Store();

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const url = isDev
    ? 'http://localhost:5173'
    : `file://${path.join(__dirname, '../dist/index.html')}`;

  win.loadURL(url);

  if (isDev) {
    win.webContents.openDevTools();
  }
}

// Register protocol privileges
protocol.registerSchemesAsPrivileged([
  { scheme: 'app-photos', privileges: { standard: true, secure: true, supportFetchAPI: true } }
]);

function registerPhotoProtocol() {
    protocol.handle('app-photos', (request) => {
        const url = new URL(request.url);
        // Su Windows app-photos://1.jpg mette '1.jpg' in hostname.
        // Se si usa app-photos:///1.jpg (3 slash) finisce in pathname.
        // Li controlliamo entrambi per sicurezza.
        let photoName = decodeURIComponent(url.hostname || url.pathname);
        if (photoName.startsWith('/')) photoName = photoName.slice(1);
        
        const photoPath = path.join(app.getAppPath(), 'foto', photoName);
        
        if (!fs.existsSync(photoPath)) {
            console.error(`Foto non trovata: ${photoPath}`);
            return new Response('Not Found', { status: 404 });
        }

        return net.fetch(pathToFileURL(photoPath).toString());
    });
}

app.whenReady().then(() => {
  registerPhotoProtocol();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handlers
ipcMain.handle('get-photos', async () => {
  const photoDir = path.join(app.getAppPath(), 'foto');
  
  if (!fs.existsSync(photoDir)) {
    return [];
  }

  const files = fs.readdirSync(photoDir);
  const photoExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.JPG'];
  const photoFiles = files.filter(file => 
    photoExtensions.includes(path.extname(file).toLowerCase()) || photoExtensions.includes(path.extname(file))
  );

  const savedPhotos = store.get('photos') || {};
  const updatedPhotos = [];

  photoFiles.forEach(file => {
    if (savedPhotos[file] !== undefined) {
      updatedPhotos.push({ name: file, active: savedPhotos[file] });
    } else {
      // New photo: set to active: true
      updatedPhotos.push({ name: file, active: true });
      savedPhotos[file] = true;
    }
  });

  // Cleanup photos that no longer exist
  Object.keys(savedPhotos).forEach(file => {
    if (!photoFiles.includes(file)) {
      delete savedPhotos[file];
    }
  });

  store.set('photos', savedPhotos);
  return updatedPhotos;
});

ipcMain.on('save-photos', (event, photos) => {
  const photoData = {};
  photos.forEach(photo => {
    photoData[photo.name] = photo.active;
  });
  store.set('photos', photoData);
});

ipcMain.handle('get-photo-path', (event, photoName) => {
    return path.join(app.getAppPath(), 'foto', photoName);
});
