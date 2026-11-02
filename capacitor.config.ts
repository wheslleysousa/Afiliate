import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.lkrm.app',
  appName: 'afiliate',
  webDir: 'dist',
  plugins: {
    SplashScreen: {
      backgroundColor: '#0a0a0a',
      launchShowDuration: 0
    }
  }
};

export default config;
