import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.unexpectedgame.unxpected',
  appName: 'Unxpected',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  android: {
    webContentsDebuggingEnabled: false
  }
};

export default config;
