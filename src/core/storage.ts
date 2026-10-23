import { createEmptySave, normalizeSave } from './state';
import type { SaveData } from '../data/types';

export const SAVE_KEY = 'secret-start.save';
export const RECOVERY_KEY = `${SAVE_KEY}.recovery`;
export interface StorageLike { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void }
export function browserStorage(): StorageLike | undefined {
  try { return window.localStorage; } catch { return undefined; }
}
export function loadSave(storage?: StorageLike): { data: SaveData; warning: string | null; migrated: boolean } {
  try {
    if (!storage) throw new Error('unavailable');
    const stored = storage.getItem(SAVE_KEY);
    if (!stored) return { data: createEmptySave(), warning: null, migrated: false };
    const raw = JSON.parse(stored);
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('invalid');
    if (raw.schemaVersion !== undefined && raw.schemaVersion !== 1 && raw.schemaVersion !== 2)
      return { data: createEmptySave(), warning: 'この保存データは新しい形式です。元のデータは保持しています。', migrated: false };
    const data = normalizeSave(raw);
    return { data, warning: null, migrated: raw.schemaVersion !== 2 };
  } catch {
    return { data: createEmptySave(), warning: '保存データを読み込めませんでした。この画面では遊べます。設定から記録を書き出せます。', migrated: false };
  }
}
export function persistSave(storage: StorageLike | undefined, data: SaveData): { ok: boolean; warning: string | null } {
  try {
    if (!storage) throw new Error('unavailable');
    const previous=storage.getItem(SAVE_KEY);
    if(previous){
      let needsRecovery=false;
      try {
        const raw=JSON.parse(previous);
        needsRecovery=!raw||typeof raw!=='object'||Array.isArray(raw)||(raw.schemaVersion!==undefined&&raw.schemaVersion!==1&&raw.schemaVersion!==2);
      }catch{needsRecovery=true;}
      // Preserve unreadable/future-format originals before replacing the active save.
      // If recovery storage is full, the outer catch preserves the original instead.
      if(needsRecovery)storage.setItem(RECOVERY_KEY,previous);
    }
    storage.setItem(SAVE_KEY, JSON.stringify(normalizeSave(data)));
    return { ok: true, warning: null };
  } catch {
    return { ok: false, warning: '端末に保存できません。記録はこの画面に残っています。設定から書き出して保管してください。' };
  }
}
