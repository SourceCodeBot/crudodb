import {
  flagIndex,
  InternalStoreEntry,
  SCHEMA,
  StoreSchema
} from './store-schema';
import { CheckApi } from './check-api';
import { Database } from './database';

export function isDeleted<T>({ flag }: T & { flag?: string }): boolean {
  return flag === 'D';
}

export function isOnlineSupport(object: any): object is CheckApi {
  return !!object.isOnline;
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
    req.onblocked = (err) => reject(err);
    req.onerror = (err) => reject(err);
    req.onupgradeneeded = async (evt: IDBVersionChangeEvent) => {
      const db: IDBDatabase = req.result;
      if (evt.oldVersion < 1 || !db.objectStoreNames.contains(store)) {
        const idbObjectStore = db.createObjectStore(store, { keyPath });
        [flagIndex, ...indices].forEach(({ name, keyPath = name, unique }) =>
          idbObjectStore.createIndex(name, keyPath, { unique })
        );
      } else if (
        schema.onUpgradeNeeded &&
        (await schema.onUpgradeNeeded(db, evt))
      ) {
        resolve(db);
      } else {
        console.log({schema});
        reject('illegal state');
      }
    };
  });
}

export async function initGeneralDb(): Promise<{
  database: Database<InternalStoreEntry>,
  db: IDBDatabase
}> {
  const db = await prepareStoreWithDatabase(SCHEMA);
  return {
    db,
    database: new Database<InternalStoreEntry>(
      db.transaction(SCHEMA.store,'readwrite').objectStore(SCHEMA.store),
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
    (version, schema) => schema.dbName === dbName ? version + schema.indexedIn : version,
    0
  );
}
