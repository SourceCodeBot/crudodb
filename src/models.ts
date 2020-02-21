
export type IndexedKey = string | number | Date | ArrayBufferView | ArrayBuffer | IDBArrayKey | IDBKeyRange;

/**
 * defines all necessary keys to build the schema of keys in object store
 */
export interface StoreIndex {
  name: string;
  keyPath?: string;
  unique?: boolean;
}

/**
 * simple schema to build an object store in indexedDb.
 */
export interface StoreSchema {
  dbName: string;
  dbVersion: number;
  store: string;
  keyPath?: string;
  indices: StoreIndex[];
  /**
   * callback which will triggered, if database version is not initialization version
   * @param db
   */
  onUpgradeNeeded?: (db: IDBDatabase, event: IDBVersionChangeEvent) => Promise<boolean>;
}
