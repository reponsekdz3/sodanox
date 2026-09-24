/**
 * Aura Browser Notification System
 * High-performance Web Notifications API integration with:
 * - Native desktop & browser popups (via Service Worker showNotification & Notification constructor)
 * - Real Web Audio API notification chimes
 * - In-app floating toast dispatch
 * - Deep linking to chats, calls, and posts on click
 */

export interface BrowserNotificationOptions {
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: any;
  silent?: boolean;
  renotify?: boolean;
  requireInteraction?: boolean;
  onClick?: () => void;
}

export interface InAppToast {
  id: string;
  title: string;
  body: string;
  avatar?: string;
  type?: 'message' | 'call' | 'like' | 'comment' | 'system' | 'follow';
  actionLabel?: string;
  onAction?: () => void;
  timestamp: number;
}

type ToastListener = (toasts: InAppToast[]) => void;
const toastListeners = new Set<ToastListener>();
let activeToasts: InAppToast[] = [];

function notifyToastListeners() {
  toastListeners.forEach((listener) => listener([...activeToasts]));
}

export function subscribeToInAppToasts(listener: ToastListener): () => void {
  toastListeners.add(listener);
  listener([...activeToasts]);
  return () => {
    toastListeners.delete(listener);
  };
}

export function dismissInAppToast(id: string) {
  activeToasts = activeToasts.filter((t) => t.id !== id);
  notifyToastListeners();
}

export function showInAppToast(toast: Omit<InAppToast, 'id' | 'timestamp'>) {
  const newToast: InAppToast = {
    ...toast,
    id: `toast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: Date.now(),
  };

  activeToasts = [newToast, ...activeToasts].slice(0, 4);
  notifyToastListeners();

  // Auto dismiss after 6 seconds
  setTimeout(() => {
    dismissInAppToast(newToast.id);
  }, 6000);
}

/**
 * Play a high-clarity harmonic notification chime via Web Audio API
 */
export function playNotificationChime(pitch: 'high' | 'gentle' | 'call' = 'high') {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    const baseFreq = pitch === 'high' ? 880 : pitch === 'call' ? 587.33 : 659.25;

    // Harmonic multi-tone chime (major third / fifth interval)
    const tones = pitch === 'call' ? [587.33, 880, 1174.66] : [baseFreq, baseFreq * 1.25];

    tones.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.1);

      gain.gain.setValueAtTime(0, now + idx * 0.1);
      gain.gain.linearRampToValueAtTime(0.14, now + idx * 0.1 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.1 + 0.45);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + idx * 0.1);
      osc.stop(now + idx * 0.1 + 0.5);
    });

    setTimeout(() => {
      if (ctx.state !== 'closed') ctx.close().catch(() => {});
    }, 1200);
  } catch {
    // Ignore audio context errors in restricted environments
  }
}

/**
 * Checks if Web Notifications API is supported
 */
export function isBrowserNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/**
 * Gets current notification permission
 */
export function getBrowserNotificationPermission(): NotificationPermission {
  if (!isBrowserNotificationSupported()) return 'denied';
  return Notification.permission;
}

/**
 * Requests native browser permission
 */
export async function requestBrowserNotificationPermission(): Promise<NotificationPermission> {
  if (!isBrowserNotificationSupported()) return 'denied';
  try {
    const result = await Notification.requestPermission();
    if (result === 'granted') {
      playNotificationChime('gentle');
      // Show confirmation
      await sendBrowserNotification('Notifications Enabled 🎉', {
        body: 'You will now receive instant desktop notifications for messages, calls, and updates on Aura.',
        tag: 'aura-welcome',
      });
    }
    return result;
  } catch (err) {
    console.error('Error requesting notification permission:', err);
    return Notification.permission;
  }
}

/**
 * Global map for notification click callbacks
 */
const notificationCallbacks = new Map<string, () => void>();

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'NOTIFICATION_CLICK' && event.data.tag) {
      const cb = notificationCallbacks.get(event.data.tag);
      if (cb) {
        cb();
        notificationCallbacks.delete(event.data.tag);
      }
    }
  });
}

/**
 * Send a browser desktop notification with in-app toast fallback
 */
export async function sendBrowserNotification(
  title: string,
  options: BrowserNotificationOptions
) {
  // Always play chime if not silent
  if (!options.silent) {
    playNotificationChime();
  }

  // Always show in-app toast for immediate rich UI responsiveness
  showInAppToast({
    title,
    body: options.body,
    avatar: options.icon,
    actionLabel: options.onClick ? 'View' : undefined,
    onAction: options.onClick,
  });

  // If native Notification API is supported and granted, launch native desktop popup
  if (isBrowserNotificationSupported() && Notification.permission === 'granted') {
    const defaultIcon = '/pwa-192x192.png';
    const tag = options.tag || `aura_${Date.now()}`;

    if (options.onClick) {
      notificationCallbacks.set(tag, options.onClick);
    }

    let shownViaServiceWorker = false;

    // Prefer Service Worker registration for persistent OS popups on Desktop & Android PWA
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration && 'showNotification' in registration) {
          const swOptions = {
            body: options.body,
            icon: options.icon || defaultIcon,
            badge: options.badge || defaultIcon,
            tag,
            data: options.data,
            renotify: options.renotify ?? true,
            requireInteraction: options.requireInteraction ?? false,
          } as NotificationOptions;
          await registration.showNotification(title, swOptions);
          shownViaServiceWorker = true;
        }
      } catch (swErr) {
        console.warn('SW showNotification fallback:', swErr);
      }
    }

    // Fallback to standard Notification constructor
    if (!shownViaServiceWorker) {
      try {
        const standardOptions = {
          body: options.body,
          icon: options.icon || defaultIcon,
          badge: options.badge || defaultIcon,
          tag,
          data: options.data,
          renotify: options.renotify ?? true,
          requireInteraction: options.requireInteraction ?? false,
        } as NotificationOptions;
        const notification = new Notification(title, standardOptions);

        notification.onclick = (e) => {
          e.preventDefault();
          window.focus();
          if (options.onClick) {
            options.onClick();
          }
          notification.close();
        };
      } catch (err) {
        console.warn('Native notification spawn failed:', err);
      }
    }
  }
}

/**
 * Quick trigger to test notifications directly from the UI
 */
export function triggerTestNotification() {
  sendBrowserNotification('Aura Social Desktop Alert', {
    body: 'Real-time notifications are active and ready! You will be alerted when creators message or call you.',
    icon: '/pwa-192x192.png',
    tag: 'test-notification',
    onClick: () => {
      window.focus();
    },
  });
}
