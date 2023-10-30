import { electronAPI } from '@electron-toolkit/preload';
import costflow from 'costflow';
import { contextBridge, ipcRenderer } from 'electron';

const fs = require('fs');
const http = require('http');
// const bot = new Telegraf(process.env.BOT_TOKEN)

// Custom APIs for renderer
const api = {
  fs,
  http,
  costflow,
  getStoreValue: async (key) => {
    const result = await ipcRenderer.invoke('getStoreValue', key);
    return result;
  },
  getCostflowConfig: async () => {
    const result = await ipcRenderer.invoke('getCostflowConfig');
    return result;
  },
  getParsedTargetPath: async () => {
    const result = await ipcRenderer.invoke('getParsedTargetPath');
    return result;
  },
  resetConfig: async () => {
    const result = await ipcRenderer.invoke('resetConfig');
    return result;
  },
  send: (channel, cmd, data) => {
    // whitelist channels
    let validChannels = ['toMain'];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, cmd, data);
    }
  },
  receive: (channel, func) => {
    let validChannels = ['fromMain'];
    if (validChannels.includes(channel)) {
      // Deliberately strip event as it includes `sender`
      ipcRenderer.on(channel, (event, ...args) => func(...args));
    }
  }
};

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI);
    contextBridge.exposeInMainWorld('api', api);
  } catch (error) {
    console.error(error);
  }
} else {
  window.electron = electronAPI;
}
