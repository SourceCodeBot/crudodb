import {StoreSchema} from "../src";

export function unload(dbName: string, secondRun: boolean = false): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(dbName);
    request.onblocked = () => reject(`blocked ${dbName}`);
    request.onupgradeneeded = () => reject('upgradeneeded');
    request.onsuccess = () => resolve();
    request.onerror = () => reject('error');
  })
    .then(() => true)
    .catch(async (err) => {
      console.error('unload failed', err);
      if (secondRun) {
        return false;
      }
      return await unload(dbName, true);
    });
}

export function randomString(): string {
  return (Math.random() * 1_000_000).toString(16);
}

export const BASE_SCHEMA: StoreSchema = {
  indices: [{ name: 'id', unique: true }, { name: 'key' }, { name: 'value' }],
  store: 'jest',
  dbName: 'CHANGE',
  dbVersion: 1
};
