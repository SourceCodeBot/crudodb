import { InternalStoreEntry, StoreSchema } from './store-schema';
import { Database } from './database';
import { CrudApi } from './crud-api';
import {
  evaluateDbVersion,
  generateTempKey,
  initGeneralDb,
  prepareStoreWithDatabase
} from './utils';

interface RegisterSchemaArgs<T> {
  schema: StoreSchema;
  api?: CrudApi<T>;
  schemaKey?: string;
}

export class CrudoDb {

  static async setup(debug: boolean = false): Promise<CrudoDb> {
    const instance = new CrudoDb(debug);
    if (debug) {
      console.time('CrudoDb initialized');
    }
    try {
      await instance.setup();
      return instance;
    } finally {
      if (debug) {
        console.timeEnd('CrudoDb initialized');
      }
    }
  }

  private databaseSchemas: Record<string, StoreSchema> = {};

  private databases: Record<string, Database<unknown>> = {};

  private get general(): Database<InternalStoreEntry> {
    return this.databases.general as Database<InternalStoreEntry>;
  }

  private idbDatabases: Record<string, IDBDatabase> = {};

  private constructor(private debug: boolean = false) {}

  public close(): void {
    Object.values(this.idbDatabases).forEach((db) => db.close());
  }

  public async get<T>(
    schemaKey: string,
    id: T[keyof T]
  ): Promise<T | undefined> {
    this.validateSchemaKey(schemaKey);
    return (this.databases[schemaKey] as Database<T>).get(id);
  }

  public getAll<T>(schemaKey: string): Promise<T[]> {
    this.validateSchemaKey(schemaKey);
    return (this.databases[schemaKey] as Database<T>).getAll();
  }

  public create<T>(schemaKey: string, item: T): Promise<T | undefined> {
    this.validateSchemaKey(schemaKey);
    return (this.databases[schemaKey] as Database<T>).create(item);
  }

  public update<T>(schemaKey: string, item: T): Promise<T | undefined> {
    this.validateSchemaKey(schemaKey);
    return (this.databases[schemaKey] as Database<T>).update(item);
  }

  public delete<T>(schemaKey: string, item: T): Promise<boolean> {
    this.validateSchemaKey(schemaKey);
    return this.databases[schemaKey].delete(item);
  }

  private validateSchemaKey(key: string): Promise<void> | void {
    if (!this.databases[key]) {
      throw new Error(`${key} does not exists`);
    }
  }

  public async registerSchema<T>(args: RegisterSchemaArgs<T>): Promise<string | undefined> {
    const { schema, schemaKey } = args;
    const key = schemaKey ?? generateTempKey(schema);
    const indexedSchema = await this.general.get(key);

    if (indexedSchema) {
       if (indexedSchema.indexedIn === schema.dbVersion) {
         if (!this.databases[key]) {
           const db = await prepareStoreWithDatabase(indexedSchema, this.idbDatabases[schema.dbName]);
           this.databases[key] = new Database<unknown>(
             db.transaction(schema.store, 'readwrite')
               .objectStore(schema.store),
             key,
             schema,
             args.api
           );
         }
         return key;
       }
       const db = await upgradeExistingSchema(
         this.general,
         {
           ...indexedSchema,
           ...schema,
           indexedIn: schema.dbVersion
         },
         this.idbDatabases[indexedSchema.dbName]
       );
       this.idbDatabases[indexedSchema.dbName] = db;
       this.databases[key] = new Database<unknown>(
         db.transaction(schema.store, 'readwrite')
           .objectStore(schema.store),
         key,
         schema,
         args.api
       );
       return key;
    }

    const items = await this.general.getAll();
    const itemsToUpdate = items.filter(({ dbName}) => dbName === schema.dbName);
    const currentVersion = evaluateDbVersion(itemsToUpdate, schema.dbName);
    const version = currentVersion + schema.dbVersion;

    const db = await prepareStoreWithDatabase({
      ...schema,
      dbVersion: version
    }, this.idbDatabases[schema.dbName]);
    this.idbDatabases[schema.dbName] = db;

    const indexedEntry = await this.general.create({
      ...schema,
      dbVersion: version,
      indexedIn: schema.dbVersion,
      id: key
    });
    if (!indexedEntry) {
      return;
    }
    this.databaseSchemas[key] = indexedEntry;
    this.databases[key] = new Database<unknown>(
      db.transaction(schema.store, 'readwrite')
        .objectStore(schema.store),
      key,
      schema,
      args.api
    );

    await Promise.all(
      itemsToUpdate.map((item) => ({
        ...item,
        dbVersion: version
      })).map((item) => this.general.update(item))
    );

    return key;
  }

  private async setup(): Promise<void> {
    const start = +new Date();
    const { db, database } = await initGeneralDb();
    this.databases.general = database as Database<unknown>;
    this.idbDatabases['__GENERAL__'] = db;
    if (this.debug) {
      console.debug('synced databases', {
        took: +new Date() - start
      });
    }
  }

  public async sync(schemaKey?: string[]): Promise<void> {
    const toUpdate = schemaKey ? Object.entries(this.databases).filter(([key, _]) => schemaKey.includes(key)) : Object.entries(this.databases);
    await Promise.all(
      toUpdate.map(([key, db]) => db.sync().catch((err) =>
        console.warn(`db with key ${key} failed to sync`, err)
      ))
    );
  }
}

async function upgradeExistingSchema(
  general: Database<InternalStoreEntry>,
  indexedSchema: InternalStoreEntry,
  openDatabase?: IDBDatabase
): Promise<IDBDatabase> {
  const databases = await general.getAll();
  const internals = databases.filter(({ dbName }) => dbName === indexedSchema.dbName);
  const version = evaluateDbVersion(internals, indexedSchema.dbName);
  const withNewVersion = internals.map((item) => ({
    ...item,
    dbVersion: version
  }));
  const db = await prepareStoreWithDatabase(indexedSchema, openDatabase);
  await Promise.all(withNewVersion.map((item) => general.update(item)));
  await general.update(indexedSchema);
  return db;
}
