const { app, BrowserWindow } = require('electron');
const createWindow = () => {
  const win = new BrowserWindow({ width: 1280, height: 820, minWidth: 800, minHeight: 600, backgroundColor: '#101116' });
  win.loadURL(process.env.KENTY_WEB_URL || 'http://localhost:5173');
};
app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
