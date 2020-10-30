import {
  FLAG_INDEX,
  InternalStoreEntry,
  SCHEMA,
  StoreIndex,
  StoreSchema
} from './store-schema';
import { CheckApi } from './check-api';
import { Database } from './database';

export function isDeleted<T>({ flag }: T & { flag?: string }): boolean {
  return flag === 'D';
}

export function isOnlineSupport(object: any): object is CheckApi {
  return object.hasOwnProperty('isOnline');
}

export function generateTempKey({ dbName, store }: StoreSchema): string {
  return `custom_schema:${dbName}:${store}`;
}

export function prepareStoreWithDatabase(
  schema: StoreSchema,
  openDatabase?: IDBDatabase
): Promise<IDBDatabase> {
  const { dbName, dbVersion, store, indices, keyPath = 'id' } = schema;
  if (openDatabase && openDatabase.version === dbVersion) {
    return Promise.resolve(openDatabase);
  }
  return new Promise<IDBDatabase>((resolve, reject) => {
    openDatabase?.close();
    const req = indexedDB.open(dbName, dbVersion);
    req.onsuccess = () => resolve(req.result);
    req.onblocked = err => reject(err);
    req.onerror = err => reject(err);
    req.onupgradeneeded = async (evt: IDBVersionChangeEvent) => {
      const db: IDBDatabase = req.result;
      if (evt.oldVersion < 1 || !db.objectStoreNames.contains(store)) {
        const idbObjectStore = db.createObjectStore(store, { keyPath });
        [FLAG_INDEX, ...indices].forEach(({ name, keyPath = name, unique }) =>
          idbObjectStore.createIndex(name, keyPath, { unique })
        );
      } else if (schema.onUpgradeNeeded) {
        try {
          const migrated = await schema.onUpgradeNeeded(
            db,
            evt,
            req.transaction?.objectStore(store)
          );
          if (migrated) {
            console.info(`${dbName}:${store} migrated to ${dbVersion}`);
          } else {
            console.info(`${dbName}:${store} migration failed`);
          }
        } catch (err) {
          console.error(`error while migration of ${dbName}:${store}`, err);
          reject('migration failed');
        }
      } else if (req.transaction) {
        const idbObjectStore = req.transaction.objectStore(store);
        const { toAdd, toRemove } = evaluateNewAndRemovedIndices(
          getCurrentIndices(idbObjectStore),
          schema.indices
        );
        toAdd.forEach(({ name, keyPath = name, unique }) =>
          idbObjectStore.createIndex(name, keyPath, { unique })
        );
        toRemove.forEach(indexName => idbObjectStore.deleteIndex(indexName));
      } else {
        reject('illegal state');
      }
    };
  });
}

export async function initGeneralDb(): Promise<{
  database: Database<InternalStoreEntry>;
  db: IDBDatabase;
}> {
  const db = await prepareStoreWithDatabase(SCHEMA);
  return {
    db,
    database: new Database<InternalStoreEntry>(
      db.transaction(SCHEMA.store, 'readwrite').objectStore(SCHEMA.store),
      '__GENERAL__',
      SCHEMA
    )
  };
}

export function evaluateDbVersion(
  schemas: InternalStoreEntry[],
  dbName: string
): number {
  return schemas.reduce(
    (version, schema) =>
      schema.dbName === dbName ? version + schema.indexedIn : version,
    0
  );
}

function getCurrentIndices(idbObjectStore: IDBObjectStore): string[] {
  const indices: string[] = [];
  for (let i = 0; i < idbObjectStore.indexNames.length; i++) {
    const index = idbObjectStore.indexNames.item(i);
    if (index != null) {
      indices.push(index);
    }
  }
  return indices;
}

function evaluateNewAndRemovedIndices(
  currentIndices: string[],
  schemaIndices: StoreIndex[]
): { toAdd: StoreIndex[]; toRemove: string[] } {
  const shouldKnownIndices = schemaIndices.map(({ name }) => name);
  return {
    toAdd: schemaIndices.filter(({ name }) => !currentIndices.includes(name)),
    toRemove: currentIndices.filter(
      index => !shouldKnownIndices.includes(index)
    )
  };
}
