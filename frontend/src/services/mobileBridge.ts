import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

type HapticFeedbackType = 'light' | 'medium' | 'heavy' | 'selection' | 'success' | 'warning' | 'error';

// Custom back-handler stack for modal dismissals on Android hardware back button
const backActionStack: Array<() => boolean> = [];

export const registerBackAction = (handler: () => boolean): (() => void) => {
  backActionStack.push(handler);
  return () => {
    const idx = backActionStack.lastIndexOf(handler);
    if (idx !== -1) {
      backActionStack.splice(idx, 1);
    }
  };
};

export const MobileBridge = {
  isNative: (): boolean => Capacitor.isNativePlatform(),
  getPlatform: (): string => Capacitor.getPlatform(),
  isStandalone: (): boolean => {
    if (typeof window === 'undefined') return false;
    return (
      Capacitor.isNativePlatform() ||
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true
    );
  },

  // Initialize native device features
  initNativeApp: async () => {
    if (typeof window === 'undefined') return;

    if (Capacitor.isNativePlatform()) {
      try {
        await StatusBar.setStyle({ style: Style.Dark });
        if (Capacitor.getPlatform() === 'android') {
          await StatusBar.setBackgroundColor({ color: '#07080D' });
          await StatusBar.setOverlaysWebView({ overlay: false });
        }
      } catch (err) {
        console.debug('[MobileBridge] Status bar init notice:', err);
      }

      try {
        await SplashScreen.hide({ fadeOutDuration: 300 });
      } catch (err) {
        console.debug('[MobileBridge] Splash screen notice:', err);
      }

      // Android hardware back button integration
      try {
        CapApp.addListener('backButton', ({ canGoBack }) => {
          // 1. Check if any modal or drawer is active in stack
          for (let i = backActionStack.length - 1; i >= 0; i--) {
            const handled = backActionStack[i]();
            if (handled) return;
          }

          // 2. Check browser history
          if (canGoBack && window.location.pathname !== '/' && window.location.pathname !== '/dashboard') {
            window.history.back();
          } else {
            // Exit app if on root / dashboard
            CapApp.exitApp();
          }
        });
      } catch (err) {
        console.debug('[MobileBridge] Back button listener notice:', err);
      }
    }
  },

  // Tactile Haptics (works on native Android/iOS and mobile web browsers)
  vibrate: async (type: HapticFeedbackType = 'light') => {
    if (typeof window === 'undefined') return;

    if (Capacitor.isNativePlatform()) {
      try {
        if (type === 'light') {
          await Haptics.impact({ style: ImpactStyle.Light });
        } else if (type === 'medium') {
          await Haptics.impact({ style: ImpactStyle.Medium });
        } else if (type === 'heavy') {
          await Haptics.impact({ style: ImpactStyle.Heavy });
        } else if (type === 'selection') {
          await Haptics.selectionChanged();
        } else if (type === 'success') {
          await Haptics.notification({ type: NotificationType.Success });
        } else if (type === 'warning') {
          await Haptics.notification({ type: NotificationType.Warning });
        } else if (type === 'error') {
          await Haptics.notification({ type: NotificationType.Error });
        }
        return;
      } catch {
        // Fall back to web vibration
      }
    }

    // Web vibration fallback for Chrome/Firefox on Android
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        if (type === 'light' || type === 'selection') {
          navigator.vibrate(12);
        } else if (type === 'medium') {
          navigator.vibrate(25);
        } else if (type === 'heavy') {
          navigator.vibrate(40);
        } else if (type === 'success') {
          navigator.vibrate([15, 60, 25]);
        } else if (type === 'warning' || type === 'error') {
          navigator.vibrate([30, 50, 30]);
        }
      } catch {}
    }
  },
};

// Global PWA Install Prompt Handler
let deferredPrompt: any = null;
const installListeners: Array<(canInstall: boolean) => void> = [];

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    deferredPrompt = e;
    installListeners.forEach((fn) => fn(true));
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    installListeners.forEach((fn) => fn(false));
  });
}

export const usePWAInstallPrompt = () => {
  return {
    canInstall: Boolean(deferredPrompt),
    promptInstall: async (): Promise<boolean> => {
      if (!deferredPrompt) return false;
      try {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          deferredPrompt = null;
          return true;
        }
      } catch (err) {
        console.warn('PWA install prompt error:', err);
      }
      return false;
    },
    subscribeInstallState: (cb: (canInstall: boolean) => void) => {
      cb(Boolean(deferredPrompt));
      installListeners.push(cb);
      return () => {
        const idx = installListeners.indexOf(cb);
        if (idx !== -1) installListeners.splice(idx, 1);
      };
    },
  };
};
