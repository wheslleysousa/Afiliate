import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.lkrm.app',
  appName: 'Afiliate',
  webDir: 'dist',
  plugins: {
    SplashScreen: {
      backgroundColor: '#0a0a0a',
      launchShowDuration: 0
    }
  }
};

export default config;
