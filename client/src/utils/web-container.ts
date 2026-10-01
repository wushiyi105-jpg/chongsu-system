export type WebContainer = 'browser' | 'iframe' | 'capacitor';

export function detectWebContainer(): WebContainer {
  if (typeof window === 'undefined') return 'browser';

  if (
    typeof (window as unknown as { Capacitor?: { isNative?: boolean } }).Capacitor !== 'undefined' &&
    (window as unknown as { Capacitor?: { isNative?: boolean } }).Capacitor?.isNative
  ) {
    return 'capacitor';
  }

  if (window.self !== window.top) {
    return 'iframe';
  }

  const ua = navigator.userAgent || '';
  if (
    /; wv\)/.test(ua) ||
    /Android.*WebView/i.test(ua) ||
    /Capacitor/i.test(ua)
  ) {
    return 'capacitor';
  }

  if (
    typeof (navigator as unknown as { standalone?: boolean }).standalone === 'boolean' &&
    (navigator as unknown as { standalone: boolean }).standalone
  ) {
    return 'browser';
  }

  return 'browser';
}

let cachedContainer: WebContainer | null = null;

export function getWebContainer(): WebContainer {
  if (cachedContainer === null) {
    cachedContainer = detectWebContainer();
  }
  return cachedContainer;
}
