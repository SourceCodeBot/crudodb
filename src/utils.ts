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

export function detectVersionForDatabase(
  schemas: StoreSchema[],
  dbName: string
): number {
  const dbSchemas = schemas.filter(schema => schema.dbName === dbName);
  return dbSchemas.length < 1
    ? 1
    : Math.max(...dbSchemas.map(({ dbVersion }) => dbVersion));
}

export function isOnlineSupport(object: any): object is CheckApi {
  return !!object.isOnline;
}

export function execDatabase<T, S>(
  schemaKey: string,
  database: Database<unknown> | undefined,
  callback: (db: Database<T>) => Promise<S>
): Promise<S> {
  return database
    ? callback(database as Database<T>)
    : Promise.reject(`${schemaKey} does not exists`);
}

export function generateTempKey({ dbName, store }: StoreSchema): string {
  return `custom_schema:${dbName}:${store}`;
}

export function createMapOfDbNameAndVersion(
  databases: StoreSchema[]
): Record<string, number> {
  const dbNames = new Set(databases.map(({ dbName }) => dbName));
  return Array.from(dbNames).reduce(
    (acc, dbName) => ({
      ...acc,
      [dbName]: detectVersionForDatabase(databases, dbName)
    }),
    {}
  );
}

export async function prepareStoreAndOpenTransactionWithDatabase(
  schema: StoreSchema,
  openDatabase?: IDBDatabase
): Promise<IDBDatabase> {
  const { dbName, dbVersion, store, indices, keyPath = 'id' } = schema;
  if (openDatabase && openDatabase.version === dbVersion) {
    return openDatabase;
  }
  return await new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(dbName, dbVersion);
    req.onsuccess = () => resolve(req.result);
    req.onblocked = () => {};
    req.onerror = err => reject(err);
    req.onupgradeneeded = async (evt: IDBVersionChangeEvent) => {
      const db: IDBDatabase = req.result;
      if (evt.oldVersion < 1) {
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
        reject('illegal state');
      }
    };
  });
}

export async function initGeneralDb(): Promise<Database<InternalStoreEntry>> {
  const db = await prepareStoreAndOpenTransactionWithDatabase(SCHEMA);
  return new Database<InternalStoreEntry>(
    db.transaction(SCHEMA.store,'readwrite').objectStore(SCHEMA.store),
    '__GENERAL__',
    SCHEMA
  );
}

export function getSchemaStatusInDatabase(
  schema: StoreSchema,
  indexedSchema?: StoreSchema
): 'ready' | 'upgrade' | 'initial' {
  if (!indexedSchema) {
    // is not indexed
    return 'initial';
  }
  if (schema.dbVersion !== indexedSchema.dbVersion) {
    // versions not equally
    return 'upgrade';
  }
  // ready to use
  return 'ready';
}

export function reduceDbNameToVersion(
  schemas: StoreSchema[]
): Record<string, number> {
  return schemas.reduce((acc, schema) => {
    if (acc[schema.dbName]) {
      acc[schema.dbName] = Math.max(acc[schema.dbName], schema.dbVersion);
    } else {
      acc[schema.dbName] = schema.dbVersion;
    }
    return acc;
  }, {} as Record<string, number>);
}
