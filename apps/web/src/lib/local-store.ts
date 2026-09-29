"use client";

/**
 * 기기 저장소 (IndexedDB). public/offline.html도 같은 DB·스토어 이름을 읽는다.
 * - queue: 서버 전송을 기다리는 현장 이벤트 (clientEventId 키)
 * - vouchers: 확정 예약증 오프라인 사본 (orderId 키, 개인정보 제외)
 * - jobs: 기사 배정 작업 최소 정보 (jobId 키)
 * 로그아웃·배정 해제 때 지운다.
 */
export const DB_NAME = "luggage-local";
export const STORES = ["queue", "vouchers", "jobs"] as const;
export type StoreName = (typeof STORES)[number];

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      for (const name of STORES) if (!request.result.objectStoreNames.contains(name)) request.result.createObjectStore(name);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(store: StoreName, mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(store, mode);
      const request = run(tx.objectStore(store));
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export function putItem<T>(store: StoreName, key: string, value: T): Promise<IDBValidKey> {
  return withStore(store, "readwrite", (s) => s.put(value, key));
}

export function getAll<T>(store: StoreName): Promise<T[]> {
  return withStore(store, "readonly", (s) => s.getAll() as IDBRequest<T[]>);
}

export function deleteItem(store: StoreName, key: string): Promise<undefined> {
  return withStore(store, "readwrite", (s) => s.delete(key) as IDBRequest<undefined>);
}

export function clearStore(store: StoreName): Promise<undefined> {
  return withStore(store, "readwrite", (s) => s.clear() as IDBRequest<undefined>);
}

export async function clearAll(): Promise<void> {
  await Promise.all(STORES.map((store) => clearStore(store).catch(() => undefined)));
}
