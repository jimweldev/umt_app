import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {
  restartApp: () => ipcRenderer.send('restart-app'),
  minimizeApp: () => ipcRenderer.send('minimize-app'),
};

if (process.contextIsolated) {
  try {
    let bridge = {
      appInfo: (callback) => ipcRenderer.on('appInfo', callback),
      osInfo: (callback) => ipcRenderer.on('osInfo', callback),
      machineInfo: (callback) => ipcRenderer.on('machineInfo', callback),
      restartApp: api.restartApp,
      minimizeApp: api.minimizeApp,
    }

    contextBridge.exposeInMainWorld('bridge', bridge)
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  window.electron = electronAPI
  window.api = api
}
