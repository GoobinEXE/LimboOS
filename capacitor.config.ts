import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Shell nativo (iOS/Android) do LimboOS.
 *
 * O appId reaproveita os apps já registrados no projeto Firebase hub-rpg-5f3e2
 * (os mesmos do app Flutter legado em mobile/), então GoogleService-Info.plist
 * e google-services.json existentes servem sem novo registro.
 * Os dois arquivos ficam fora do git (.gitignore).
 */
const config: CapacitorConfig = {
  appId: 'com.limboos.limboOs',
  appName: 'LimboOS',
  webDir: 'backend/dist',
  // Mesma cor da abertura (#090A0C): o WebView não mostra um quadro vazio
  // de outra cor entre a tela nativa e a logo web.
  backgroundColor: '#090A0C',
  ios: {
    contentInset: 'never',
    backgroundColor: '#090A0C',
  },
  android: {
    backgroundColor: '#090A0C',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 4000,
      launchAutoHide: false,
      backgroundColor: '#090A0C',
      showSpinner: false,
    },
    StatusBar: {
      // DARK = texto claro, para o fundo escuro do app; o conteúdo usa safe-area-inset-*.
      overlaysWebView: true,
      style: 'DARK',
    },
    SystemBars: {
      // index.html já declara viewport-fit=cover; evita salto de layout no Android.
      initialViewportFitValueHint: 'cover',
    },
    FirebaseMessaging: {
      // Lista vazia: com o app aberto o aviso vira toast do jogo, sem banner do sistema.
      presentationOptions: [],
    },
    FirebaseAuthentication: {
      // O SDK web continua sendo a fonte da sessão; o plugin só obtém a credencial.
      skipNativeAuth: true,
      providers: ['google.com', 'apple.com'],
    },
  },
  experimental: {
    ios: {
      spm: {
        swiftToolsVersion: '6.1',
        // Só o SDK do Google Sign-In; o do Facebook fica fora do binário.
        packageTraits: {
          '@capacitor-firebase/authentication': ['Google'],
        },
        // Evita colisão de identidade de pacote SwiftPM (capawesome-team/capacitor-firebase#959).
        packageOptions: {
          '@capacitor-firebase/authentication': { symlink: true },
          '@capacitor-firebase/messaging': { symlink: true },
          '@capacitor-firebase/app-check': { symlink: true },
        },
      },
    },
  },
};

export default config;
