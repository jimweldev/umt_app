import { app, shell, BrowserWindow, Tray, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { autoUpdater } from 'electron-updater'
import { exec, spawn } from 'child_process'
import AutoLaunch from 'auto-launch'
import axios from 'axios'
import os from 'os'
import icon from '../../resources/icon.ico?asset'

let myWindow = null

const additionalData = { myKey: 'myValues' }
const gotTheLock = app.requestSingleInstanceLock(additionalData)

process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true'

const getCpuUsage = () => {
  const cpus = os.cpus()
  let idle = 0
  let total = 0
  for (const cpu of cpus) {
    for (const type in cpu.times) {
      total += cpu.times[type]
    }
    idle += cpu.times.idle
  }
  return { idle: idle / cpus.length, total: total / cpus.length }
}

function getActiveOrDisc(input) {
  input = input.replace(/\s+/g, ' ')

  const userMatch = input.match(/>[^\s]+/)
  const activeUser = userMatch ? userMatch[0].slice(1) : null

  const words = input.split(' ')

  let isUserFound = false
  let status = ''

  words.forEach((word) => {
    if (word === '>' + activeUser) {
      isUserFound = true
    }

    if (isUserFound && (word === 'Active' || word === 'Disc') && status === '') {
      status = word
    }
  })

  return status
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    skipTaskbar: true,
    frame: false,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.maximize()
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  const tray = new Tray(icon)
  tray.setToolTip('Uptime Monitoring Tool')
  tray.on('click', () => {
    // mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show()
    mainWindow.maximize()
    mainWindow.show()
  })

  let upn = os.userInfo().username
  let computerName = os.hostname()

  if (process.platform === 'win32') {
    exec('C:\\Windows\\System32\\whoami.exe /UPN', (error, stdout, stderr) => {
      if (stdout.includes('connextglobal.com')) {
        upn = stdout.replace('\r\n', '')
      }
    })
  }

  function checkForUpdates() {
    let gitHubCreds = null

    gitHubCreds = {
      provider: 'github',
      owner: 'jimweldev',
      repo: 'umt_app',
    }

    autoUpdater.setFeedURL(gitHubCreds)

    // AutoUpdater Configuration
    autoUpdater.autoDownload = false
    autoUpdater.checkForUpdatesAndNotify()
  }

  checkForUpdates()

  setInterval(() => {
    checkForUpdates()

    mainWindow.webContents.send('appInfo', {
      message: 'Checking for updates.',
      version: app.getVersion()
    })
  // }, 3 * 60 * 60 * 1000) // 3hrs
  }, 5 * 60 * 1000) // 5 mins

  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.send('appInfo', {
      message: 'Checking for updates.',
      version: app.getVersion()
    })

    mainWindow.webContents.send('osInfo', {
      upn,
      computerName
    })
  })

  autoUpdater.on('update-available', () => {
    // Start downloading the update
    autoUpdater.downloadUpdate()

    // Handle update available
    mainWindow.webContents.send('appInfo', {
      message: 'Update available. Downloading...',
      version: app.getVersion()
    })
  })

  autoUpdater.on('update-not-available', () => {
    // Handle no update available
    mainWindow.webContents.send('appInfo', {
      message: 'No updates available.',
      version: app.getVersion()
    })
  })

  autoUpdater.on('download-progress', (progressObj) => {
    const message = `Downloaded ${progressObj.percent.toFixed(0)}%`
    mainWindow.webContents.send('appInfo', {
      message,
      version: app.getVersion()
    })
  })

  autoUpdater.on('update-downloaded', () => {
    // Handle update downloaded
    autoUpdater.quitAndInstall()
  })

  autoUpdater.on('error', (error) => {
    // Handle update error
    let data = null

    // ! Change to true if testing
    if (false) {
      data = {
        message: `Update error: ${error.message}`,
        version: app.getVersion()
      }
    } else {
      data = {
        message: `Update error`,
        version: app.getVersion()
      }
    }

    mainWindow.webContents.send('appInfo', data)
  })

  const { idle: prevIdle, total: prevTotal } = getCpuUsage()

  setTimeout(() => {
    const { idle: currIdle, total: currTotal } = getCpuUsage()
    const idleDifference = currIdle - prevIdle
    const totalDifference = currTotal - prevTotal
    const usage = 1 - idleDifference / totalDifference

    const cpuUsage = `${(usage * 100).toFixed(2)}%`
    const computerUptime = Math.trunc(os.uptime())

    if (process.platform === 'win32') {
      const queryUser = spawn('query', ['user'])

      queryUser.stdout.on('data', (data) => {
        const query = data.toString().trim()

        const userStatus = getActiveOrDisc(query)

        mainWindow.webContents.send('machineInfo', {
          cpuUsage,
          computerUptime,
          userStatus,
          query
        })
      })
    }

    upn = os.userInfo().username
    computerName = os.hostname()

    if (process.platform === 'win32') {
      exec('C:\\Windows\\System32\\whoami.exe /UPN', (error, stdout, stderr) => {
        if (stdout.includes('connextglobal.com')) {
          upn = stdout.replace('\r\n', '')
        }
      })
    }

    mainWindow.webContents.send('osInfo', {
      upn,
      computerName
    })
  }, 1000);

  setInterval(() => {
    const { idle: currIdle, total: currTotal } = getCpuUsage()
    const idleDifference = currIdle - prevIdle
    const totalDifference = currTotal - prevTotal
    const usage = 1 - idleDifference / totalDifference

    const cpuUsage = `${(usage * 100).toFixed(2)}%`
    const computerUptime = Math.trunc(os.uptime())

    if (process.platform === 'win32') {
      const queryUser = spawn('query', ['user'])

      queryUser.stdout.on('data', (data) => {
        const query = data.toString().trim()

        const userStatus = getActiveOrDisc(query)

        mainWindow.webContents.send('machineInfo', {
          cpuUsage,
          computerUptime,
          userStatus,
          query
        })
      })
    }

    upn = os.userInfo().username
    computerName = os.hostname()

    if (process.platform === 'win32') {
      exec('C:\\Windows\\System32\\whoami.exe /UPN', (error, stdout, stderr) => {
        if (stdout.includes('connextglobal.com')) {
          upn = stdout.replace('\r\n', '')
        }
      })
    }

    mainWindow.webContents.send('osInfo', {
      upn,
      computerName
    })
  }, 15 * 60 * 1000)

  ipcMain.on('restart-app', () => {
    app.relaunch(); // Relaunch the app
    app.exit(0); // Exit the current instance
  })

  ipcMain.on('minimize-app', () => {
    // Check if mainWindow exists and is not destroyed
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.minimize()
    }
  })
}

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', (event, commandLine, workingDirectory, additionalData) => {
    if (myWindow) {
      if (myWindow.isMinimized()) myWindow.restore()
      myWindow.focus()
    }
  })

  app.whenReady().then(() => {
    electronApp.setAppUserModelId('com.electron')

    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window)
    })

    myWindow = createWindow()

    app.on('activate', function () {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

var autoLauncher = new AutoLaunch({
  name: 'Uptime Monitoring Tool',
  path: app.getPath('exe')
})

autoLauncher
  .isEnabled()
  .then(function (isEnabled) {
    if (isEnabled) return
    autoLauncher.enable()
  })
  .catch(function (err) {
    throw err
  })