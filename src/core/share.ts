import type { SaveData } from '../data/types';
export function publicUrl(): string {
  const configured = import.meta.env?.VITE_PUBLIC_URL;
  const url = new URL(configured || window.location.href);
  url.hash = ''; url.search = '';
  if (!url.pathname.endsWith('/') && !url.pathname.endsWith('.html')) url.pathname += '/';
  return url.href;
}
export function shareUrl(save: SaveData): string {
  const n = save.discoveredEventIds.length;
  const text = n === 173 ? 'SECRET START：全173演出を発見してコンプリート！ #SecretStart'
    : `SECRET START：${n}/173（${Math.floor(n / 173 * 100)}%）発見！ あなたは何個見つけた？ #SecretStart`;
  const url = new URL('https://twitter.com/intent/tweet');
  url.searchParams.set('text', text); url.searchParams.set('url', publicUrl());
  return url.href;
}
