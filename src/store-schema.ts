export type IndexedKey =
  | string
  | number
  | Date
  | ArrayBufferView
  | ArrayBuffer
  | IDBArrayKey
  | IDBKeyRange;

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
  onUpgradeNeeded?: (
    db: IDBDatabase,
    event: IDBVersionChangeEvent,
    objectStore?: IDBObjectStore
  ) => Promise<boolean>;
}

export interface InternalStoreEntry
  extends Omit<StoreSchema, 'onUpgradeNeeded'> {
  id: string;
  // version of database for StoreSchema#dbVersion
  indexedIn: number;
}

export const SCHEMA: StoreSchema = {
  indices: [
    { name: 'id' },
    { name: 'dbVersion' },
    { name: 'indexedIn' },
    { name: 'indices' },
    { name: 'dbName' },
    { name: 'store' },
    { name: 'keyPath' }
  ],
  dbVersion: 1, // over database collected
  dbName: 'crudodb',
  store: 'stores'
};

export const FLAG_INDEX: StoreIndex = {
  name: 'flag'
};
