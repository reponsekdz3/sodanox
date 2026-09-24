import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export type DevicePlatform = 'windows' | 'mac' | 'linux' | 'chromeos' | 'ios' | 'android' | 'other';

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [platform, setPlatform] = useState<DevicePlatform>('other');
  const [isPC, setIsPC] = useState(false);

  useEffect(() => {
    // 1. Detect standalone mode (already installed on PC or mobile)
    const isStandalone =
      typeof window !== 'undefined' &&
      (window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true);
    setIsInstalled(isStandalone);

    // 2. Detect User Agent / OS Platform
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent.toLowerCase() : '';
    let detectedPlatform: DevicePlatform = 'other';
    let isDesktopPC = false;

    if (/iphone|ipad|ipod/.test(ua)) {
      detectedPlatform = 'ios';
    } else if (/android/.test(ua)) {
      detectedPlatform = 'android';
    } else if (/win/.test(ua)) {
      detectedPlatform = 'windows';
      isDesktopPC = true;
    } else if (/macintosh|mac os x/.test(ua)) {
      detectedPlatform = 'mac';
      isDesktopPC = true;
    } else if (/cros/.test(ua)) {
      detectedPlatform = 'chromeos';
      isDesktopPC = true;
    } else if (/linux/.test(ua)) {
      detectedPlatform = 'linux';
      isDesktopPC = true;
    }

    setPlatform(detectedPlatform);
    setIsPC(isDesktopPC);

    // 3. Listen to beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = async (): Promise<boolean> => {
    if (!deferredPrompt) return false;
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
        setDeferredPrompt(null);
        return true;
      }
      return false;
    } catch (err) {
      console.error('PWA install error:', err);
      return false;
    }
  };

  return {
    isInstallable: !!deferredPrompt,
    isInstalled,
    isPC,
    platform,
    install,
    deferredPrompt,
  };
}

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}
