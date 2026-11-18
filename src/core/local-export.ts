/**
 * local-export.ts - 本地文件夹持久化与 CSV 文件写入工具
 *
 * 支持两种本地导出通道：
 * 1. File System Access API（通过扩展辅助页授权一次本地文件夹句柄，支持任意磁盘绝对路径直接写入）；
 * 2. chrome.downloads 下载通道（支持相对浏览器下载目录的子文件夹直接静默覆盖写入，或 saveAs 另存为）。
 */

const IDB_NAME = 'smartedu_local_export_db';
const IDB_VERSION = 1;
const IDB_STORE = 'handles';
const IDB_DIR_KEY = 'export_dir';
const PENDING_EXPORT_KEY = 'SMARTEDU_PENDING_LOCAL_EXPORT';

export interface PendingLocalExportPayload {
  filename: string;
  csvContent: string;
  recordCount: number;
  studiedCount?: number;
  textbookCount?: number;
  accountName: string;
  userId: string;
  targetDir: string;
  createdAt: number;
}

/**
 * 判断输入路径是否为系统绝对路径（Windows 盘符 / UNC / Unix 根路径）
 */
export function isAbsoluteFsPath(rawPath: string): boolean {
  const s = String(rawPath || '').trim();
  if (!s) return false;
  return /^[a-zA-Z]:([\\/]|$)/.test(s) || /^\\\\/.test(s) || s.startsWith('/');
}

/**
 * 提取路径末级目录名称（兼容 \ 与 /）
 */
export function getPathBasename(rawPath: string): string {
  const cleaned = String(rawPath || '').trim().replace(/[\\/]+$/, '');
  if (!cleaned) return '';
  const parts = cleaned.split(/[\\/]+/).filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : '';
}

/**
 * 规范化 chrome.downloads 相对子目录路径（剔除非法字符与 .. 越级）
 */
export function normalizeRelativeDownloadDir(rawPath: string, fallback = 'smartedu-records'): string {
  const s = String(rawPath || '').trim().replace(/\\/g, '/');
  if (!s) return fallback;
  const parts = s
    .split('/')
    .map((seg) => seg.replace(/[<>:"|?*\x00-\x1f]/g, '_').trim())
    .filter((seg) => seg && seg !== '.' && seg !== '..');
  return parts.length > 0 ? parts.join('/') : fallback;
}

/**
 * 判断当前配置的目录输入是否与已授权目录句柄匹配
 */
export function doesDirMatchBoundHandle(configuredDir: string, boundName?: string): boolean {
  const bound = String(boundName || '').trim();
  if (!bound) return false;
  const cfg = String(configuredDir || '').trim();
  if (!cfg) return true;
  return getPathBasename(cfg) === bound;
}

export function supportsDirectoryPicker(): boolean {
  return typeof window !== 'undefined' && typeof (window as any).showDirectoryPicker === 'function';
}

function openHandleDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('当前环境不支持 IndexedDB'));
      return;
    }
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('打开目录句柄存储失败'));
  });
}

export async function saveDirectoryHandle(handle: any): Promise<void> {
  const db = await openHandleDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(handle, IDB_DIR_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('保存目录句柄失败'));
    });
  } finally {
    db.close();
  }
}

export async function loadDirectoryHandle(): Promise<any | null> {
  try {
    const db = await openHandleDb();
    try {
      return await new Promise<any | null>((resolve) => {
        const tx = db.transaction(IDB_STORE, 'readonly');
        const req = tx.objectStore(IDB_STORE).get(IDB_DIR_KEY);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
    } finally {
      db.close();
    }
  } catch {
    return null;
  }
}

export async function clearDirectoryHandle(): Promise<void> {
  try {
    const db = await openHandleDb();
    try {
      await new Promise<void>((resolve) => {
        const tx = db.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).delete(IDB_DIR_KEY);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
    } finally {
      db.close();
    }
  } catch {}
}

export async function queryDirectoryWritePermission(handle: any): Promise<'granted' | 'prompt' | 'denied'> {
  try {
    if (!handle || typeof handle.queryPermission !== 'function') return 'denied';
    const state = await handle.queryPermission({ mode: 'readwrite' });
    return state === 'granted' ? 'granted' : state === 'prompt' ? 'prompt' : 'denied';
  } catch {
    return 'denied';
  }
}

export async function requestDirectoryWritePermission(handle: any): Promise<boolean> {
  try {
    if (!handle || typeof handle.requestPermission !== 'function') return false;
    const state = await handle.requestPermission({ mode: 'readwrite' });
    return state === 'granted';
  } catch {
    return false;
  }
}

export async function writeFileToDirectoryHandle(handle: any, filename: string, content: string): Promise<void> {
  const fileHandle = await handle.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();
  try {
    await writable.write(content);
  } finally {
    await writable.close();
  }
}

export async function setPendingLocalExport(payload: PendingLocalExportPayload): Promise<void> {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    await chrome.storage.local.set({ [PENDING_EXPORT_KEY]: payload });
  }
}

export async function getPendingLocalExport(): Promise<PendingLocalExportPayload | null> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return null;
  const res = await chrome.storage.local.get([PENDING_EXPORT_KEY]);
  return (res?.[PENDING_EXPORT_KEY] as PendingLocalExportPayload) || null;
}

export async function clearPendingLocalExport(): Promise<void> {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    await chrome.storage.local.remove([PENDING_EXPORT_KEY]);
  }
}

export function downloadCsvViaBackground(opts: {
  filename: string;
  csvContent: string;
  relativeDir?: string;
  saveAs?: boolean;
}): Promise<{ ok: boolean; filename?: string; error?: string }> {
  return new Promise((resolve) => {
    try {
      if (typeof chrome === 'undefined' || !chrome.runtime?.id) {
        resolve({ ok: false, error: '扩展上下文不可用' });
        return;
      }
      chrome.runtime.sendMessage(
        {
          type: 'DOWNLOAD_LOCAL_CSV',
          filename: opts.filename,
          csvContent: opts.csvContent,
          relativeDir: opts.relativeDir || '',
          saveAs: Boolean(opts.saveAs)
        },
        (res) => {
          if (chrome.runtime.lastError) {
            resolve({ ok: false, error: chrome.runtime.lastError.message || '下载通信失败' });
            return;
          }
          resolve(res || { ok: false, error: '未收到下载响应' });
        }
      );
    } catch (e: any) {
      resolve({ ok: false, error: e?.message || '下载异常' });
    }
  });
}
