import { electronApp, is, optimizer } from '@electron-toolkit/utils';
import costflow from 'costflow';
import { app, BrowserWindow, shell } from 'electron';
import { ipcMain, Menu } from 'electron';
import contextMenu from 'electron-context-menu';
import log from 'electron-log';
import Store from 'electron-store';
import { autoUpdater } from 'electron-updater';
import { join } from 'path';
import { Telegraf } from 'telegraf';
import { message } from 'telegraf/filters';

import icon from '../../resources/icon.png?asset';
import { appendToLedger, parseDatePath } from '../utils/file.js';
contextMenu({});

autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';
log.info('App starting...');

let mainWindow;

const name = 'Costflow';
const appVersion = app.getVersion();
let bot;
let botStatus = 'stopped';
let store = new Store();
let config;
let costflowConfig;
let parsedLedgerPath;
const isMac = process.platform === 'darwin';

// Menu template
let template = [];
template.unshift({
  label: name,
  submenu: [
    {
      label: 'About ' + name,
      role: 'about'
    },
    {
      label: 'Syntax',
      click: async () => {
        const { shell } = require('electron');
        await shell.openExternal('https://www.costflow.io/docs/syntax/');
      }
    },
    {
      label: 'Donate',
      click: async () => {
        const { shell } = require('electron');
        await shell.openExternal('https://www.costflow.io/docs/donate/');
      }
    },
    isMac
      ? {
          label: 'Quit',
          accelerator: 'Command+Q',
          click() {
            app.quit();
          }
        }
      : {
          label: 'Quit',
          click() {
            app.quit();
          }
        }
  ]
});

function loadConfig() {
  config = store.get('config');
  console.log(config);
  if (config?.telegramToken) {
    bot = new Telegraf(config.telegramToken);
  }
  if (config?.configPath) {
    // read config file
    try {
      costflowConfig = require(config.configPath);
      console.log(costflowConfig);
    } catch (error) {
      console.log(error);
    }
  }
  if (config?.targetPath) {
    parsedLedgerPath = parseDatePath(config.targetPath);
    console.log(parsedLedgerPath);
    // todo: if path includes variable, need to update it automatically
  }
}

function createWindow() {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 700,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  });

  mainWindow.on('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: 'deny' };
  });

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
  // Open the DevTools.
  mainWindow.webContents.openDevTools();
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);

  // Set app user model id for windows
  electronApp.setAppUserModelId('io.costflow.app');

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  loadConfig();

  createWindow();

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
app.on('ready', () => {
  autoUpdater.checkForUpdatesAndNotify();
});

// In this file you can include the rest of your app"s specific main process
// code. You can also put them in separate files and require them here.

async function startTelegramBot() {
  // if config is not set, choose config path
  if (!costflowConfig) {
    // alert
    return;
  }
  bot.start((ctx) => ctx.reply('Welcome'));
  bot.help((ctx) => ctx.reply('Send me a sticker'));
  bot.on(message('text'), async (ctx) => {
    console.log(ctx.message.text);
    let result;
    try {
      result = await costflow(ctx.message.text, costflowConfig);
      console.log(result);
    } catch (error) {
      console.log(error);
    }
    insertNewEntryFromBot(result.output);
    await ctx.replyWithMarkdownV2(`\`\`\`${result.output}\`\`\``);
  });
  bot.launch();
  botStatus = 'running';
  sendStatusToWindow('botStatus', botStatus);
  return 'ok';
}
async function stopTelegramBot() {
  bot.stop();
  botStatus = 'stopped';
  sendStatusToWindow('botStatus', botStatus);
  return 'ok';
}
function sendStatusToWindow(cmd, data) {
  log.info(cmd, data);
  mainWindow.webContents.send('fromMain', cmd, data);
}

async function updateSettings(settingObj) {
  Object.entries(settingObj).forEach(([key, value]) => {
    // todo: validate: path exists and config should be a json file
    console.log(key);
    console.log(value);
    store.set(`config.${key}`, value || '');
    loadConfig();
  });
}
async function insertNewEntry(raw) {
  console.log(raw);
  // insert the raw data to the target file
  if (!costflowConfig) {
    alert('Please set config first');
    return;
  }
  if (!parsedLedgerPath) {
    alert('Please set target path first');
    return;
  }

  const parsed = await costflow(raw, costflowConfig);
  let entry = parsed.output;
  // save to target file
  await appendToLedger(parsedLedgerPath, entry, config?.indexPath);
  sendStatusToWindow('entryInserted', entry);
}

async function insertNewEntryFromBot(parsed) {
  if (!parsed) {
    return;
  }
  // insert the raw data to the target file
  if (!costflowConfig) {
    return 'NO_CONFIG';
  }
  if (!parsedLedgerPath) {
    return 'NO_TARGET_PATH';
  }

  // save to target file
  let res = await appendToLedger(parsedLedgerPath, parsed, config?.indexPath);
  console.log(res);
}

ipcMain.handle('getStoreValue', (event, key) => {
  return store.get(key);
});
ipcMain.handle('resetConfig', (event, key) => {
  return store.set('config', {});
});

ipcMain.handle('getCostflowConfig', () => {
  return costflowConfig;
});
ipcMain.handle('getParsedTargetPath', () => {
  return parsedLedgerPath;
});

ipcMain.on('toMain', async (event, cmd, data) => {
  console.log(cmd);
  console.log(data);
  switch (cmd) {
    case 'getAppVersion':
      sendStatusToWindow('appVersion', appVersion);
      break;
    case 'getBotStatus':
      sendStatusToWindow('botStatus', botStatus);
      break;
    case 'startTelegramBot':
      startTelegramBot();
      break;
    case 'stopTelegramBot':
      stopTelegramBot();
      break;
    case 'updateSettings':
      updateSettings(data);
      break;
    case 'insertNewEntry':
      insertNewEntry(data);
      break;
    case 'reloadConfig':
      loadConfig();
      break;
    case 'relaunch':
      app.relaunch();
      app.exit();
      break;
    default:
      break;
  }
});

autoUpdater.on('checking-for-update', () => {
  sendStatusToWindow('autoUpdater', 'checking');
});
autoUpdater.on('update-available', (info) => {
  sendStatusToWindow('autoUpdater', 'available');
});
autoUpdater.on('update-not-available', (info) => {
  sendStatusToWindow('autoUpdater', 'notAvailable');
});
autoUpdater.on('error', (err) => {
  sendStatusToWindow('autoUpdater', 'error');
  log.error('Error in auto-updater. ' + err);
});
autoUpdater.on('download-progress', (progressObj) => {
  // let log_message = 'Download speed: ' + progressObj.bytesPerSecond;
  // log_message = log_message + ' - Downloaded ' + progressObj.percent + '%';
  // log_message = log_message + ' (' + progressObj.transferred + '/' + progressObj.total + ')';
  // sendStatusToWindow('autoUpdater', log_message);
});
autoUpdater.on('update-downloaded', (info) => {
  sendStatusToWindow('autoUpdater', 'downloaded');
});
