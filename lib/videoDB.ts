/**
 * 動画 Blob を IndexedDB に保存・取得するユーティリティ
 *
 * オフライン PWA 環境ではページナビゲーション時にフルリロードが発生し、
 * SessionContext の blob URL が失われることがある。
 * IndexedDB に Blob 自体を保存しておくことで、リロード後も復元できる。
 */

const DB_NAME = 'rehaScope_videos'
const STORE_NAME = 'blobs'
const DB_VERSION = 1

async function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

/** Blob を指定キーで IndexedDB に保存する */
export async function saveVideoBlob(key: string, blob: Blob): Promise<void> {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(blob, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

/** 指定キーの Blob を取得して blob URL を返す。存在しなければ null */
export async function getVideoBlobUrl(key: string): Promise<string | null> {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE_NAME).objectStore(STORE_NAME).get(key)
    req.onsuccess = () => {
      resolve(req.result instanceof Blob ? URL.createObjectURL(req.result) : null)
    }
    req.onerror = () => reject(req.error)
  })
}
