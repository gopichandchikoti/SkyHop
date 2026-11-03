import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.portfolio.skyhop',
  appName: 'SkyHop',
  webDir: 'dist',
  // Matches the sky behind the menu, so the WebView never flashes white while the page loads.
  backgroundColor: '#7cc4ff',
  server: {
    androidScheme: 'https'
  }
};

export default config;
