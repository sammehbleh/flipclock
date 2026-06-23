const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('flipClock', {
  platform: process.platform
});
