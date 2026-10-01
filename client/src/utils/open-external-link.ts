import { logger } from '@lark-apaas/client-toolkit/logger';
import { getWebContainer } from './web-container';

export function isExternalUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

export async function openExternalLink(url: string): Promise<void> {
  if (!url) return;

  const container = getWebContainer();

  if (container === 'capacitor') {
    try {
      const { Browser } = await import('@capacitor/browser');
      await Browser.open({ url });
      return;
    } catch (error) {
      logger.warn('Capacitor Browser.open failed, fallback to window.open', error);
    }
  }

  if (typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}
