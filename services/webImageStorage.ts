/**
 * Web-compatible persistent image storage using browser IndexedDB.
 * Used on Web platforms where native FileSystem.documentDirectory is unavailable.
 */

const DB_NAME = 'bunalens_offline_db';
const DB_VERSION = 1;
const STORE_NAME = 'queued_images';

interface StoredWebImage {
  id: string;
  blob: Blob;
  mimeType: string;
  createdAt: number;
}

let dbPromise: Promise<IDBDatabase | null> | null = null;

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
}

function getDB(): Promise<IDBDatabase | null> {
  if (!isBrowser()) return Promise.resolve(null);
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        console.warn('IndexedDB could not be opened; falling back gracefully.');
        resolve(null);
      };
    } catch (err) {
      console.warn('IndexedDB initialization failed:', err);
      resolve(null);
    }
  });

  return dbPromise;
}

/** Converts a base64 string or data/blob URI into a Blob */
async function toBlob(uriOrBase64: string, fallbackMime = 'image/jpeg'): Promise<Blob> {
  if (uriOrBase64.startsWith('data:') || uriOrBase64.startsWith('blob:')) {
    const res = await fetch(uriOrBase64);
    return res.blob();
  }

  // Raw base64 string without data prefix
  const cleanBase64 = uriOrBase64.replace(/\s/g, '');
  const byteChars = atob(cleanBase64);
  const byteArrays: Uint8Array[] = [];

  for (let offset = 0; offset < byteChars.length; offset += 512) {
    const slice = byteChars.slice(offset, offset + 512);
    const byteNumbers = new Array(slice.length);
    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i);
    }
    byteArrays.push(new Uint8Array(byteNumbers));
  }

  return new Blob(byteArrays as BlobPart[], { type: fallbackMime });
}

/** Saves an image Blob into IndexedDB */
export async function saveWebImage(id: string, uriOrBase64: string, mimeType = 'image/jpeg'): Promise<string> {
  if (!isBrowser()) return uriOrBase64;

  try {
    const db = await getDB();
    if (!db) return uriOrBase64;

    const blob = await toBlob(uriOrBase64, mimeType);

    return new Promise((resolve) => {
      try {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const record: StoredWebImage = {
          id,
          blob,
          mimeType,
          createdAt: Date.now(),
        };

        const putRequest = store.put(record);

        putRequest.onsuccess = () => {
          // Return a stable synthetic URI indicating IndexedDB persistence
          resolve('idb://' + id);
        };

        putRequest.onerror = (e) => {
          console.warn('IndexedDB put failed, falling back to original URI:', e);
          resolve(uriOrBase64);
        };
      } catch (err) {
        console.warn('IndexedDB transaction error:', err);
        resolve(uriOrBase64);
      }
    });
  } catch (err) {
    console.warn('saveWebImage error:', err);
    return uriOrBase64;
  }
}

/** Retrieves an image from IndexedDB as a clean base64 string (no header prefix) */
export async function getWebImageBase64(id: string): Promise<string | null> {
  if (!isBrowser()) return null;

  try {
    const db = await getDB();
    if (!db) return null;

    return new Promise((resolve) => {
      try {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(id);

        request.onsuccess = () => {
          const record = request.result as StoredWebImage | undefined;
          if (!record || !record.blob) {
            resolve(null);
            return;
          }

          const reader = new FileReader();
          reader.onloadend = () => {
            const dataUrl = reader.result as string;
            // Strip data:image/...;base64,
            const base64 = dataUrl.replace(/^data:[a-z0-9.+-]+;base64,/i, '').replace(/\s/g, '');
            resolve(base64);
          };
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(record.blob);
        };

        request.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  } catch {
    return null;
  }
}

/** Retrieves an image from IndexedDB as a displayable Data URL */
export async function getWebImageDataUrl(id: string): Promise<string | null> {
  if (!isBrowser()) return null;

  try {
    const db = await getDB();
    if (!db) return null;

    return new Promise((resolve) => {
      try {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(id);

        request.onsuccess = () => {
          const record = request.result as StoredWebImage | undefined;
          if (!record || !record.blob) {
            resolve(null);
            return;
          }

          const reader = new FileReader();
          reader.onloadend = () => {
            resolve(reader.result as string);
          };
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(record.blob);
        };

        request.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  } catch {
    return null;
  }
}

/** Deletes an image from IndexedDB after successful synchronization */
export async function deleteWebImage(id: string): Promise<void> {
  if (!isBrowser()) return;

  try {
    const db = await getDB();
    if (!db) return;

    await new Promise<void>((resolve) => {
      try {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  } catch {
    // Ignore cleanup error
  }
}
