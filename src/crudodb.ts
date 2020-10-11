import { InternalStoreEntry, StoreSchema } from './store-schema';
import { Database } from './database';
import { CrudApi } from './crud-api';
import {
  execDatabase,
  generateTempKey,
  getSchemaStatusInDatabase,
  initGeneralDb,
  reduceDbNameToVersion
} from './utils';

interface RegisterSchemaArgs<T> {
  schema: StoreSchema;
  api?: CrudApi<T>;
  schemaKey?: string;
}

export class CrudoDb {
  static async setup(debug: boolean): Promise<CrudoDb> {
    const rest = new CrudoDb(debug);
    if (debug) {
      console.time('CrudoDb initialized');
    }
    return rest
      .setup()
      .then(() => rest)
      .finally(() => debug && console.timeEnd('CrudoDb initialized'));
  }

  private databaseSchemas: Record<string, StoreSchema> = {};

  /**
   * schemaKey -> Database instance
   */
  private databases: Record<string, Database<unknown>> = {};

  private general: Database<InternalStoreEntry> = this.databases
    .general as Database<InternalStoreEntry>;

  /**
   * dbName -> IndexedDb instance
   */
  // private idbDatabases: Record<string, IDBDatabase> = {};

  /**
   * schemaKey -> Store instance
   */
  private idbObjectStores: Record<string, IDBObjectStore> = {};

  private constructor(private debug: boolean = false) {}

  public async get<T, K extends keyof T>(
    schemaKey: string,
    id: T[K]
  ): Promise<T | undefined> {
    return execDatabase(
      schemaKey,
      this.databases[schemaKey],
      (db: Database<T>) => db.get(id)
    );
  }

  public getAll<T>(schemaKey: string): Promise<T[]> {
    return execDatabase(
      schemaKey,
      this.databases[schemaKey],
      (db: Database<T>) => db.getAll()
    );
  }

  public create<T>(schemaKey: string, item: T): Promise<T | undefined> {
    return execDatabase(
      schemaKey,
      this.databases[schemaKey],
      (db: Database<T>) => db.create(item)
    );
  }

  public update<T>(schemaKey: string, item: T): Promise<T | undefined> {
    return execDatabase(
      schemaKey,
      this.databases[schemaKey],
      (db: Database<T>) => db.update(item)
    );
  }

  public delete<T>(schemaKey: string, item: T): Promise<boolean> {
    return execDatabase(
      schemaKey,
      this.databases[schemaKey],
      (db: Database<T>) => db.delete(item)
    );
  }

  public async registerSchema<T>(args: RegisterSchemaArgs<T>): Promise<string> {
    const { schema, schemaKey } = args;
    // schemaKey evaluation
    const key = schemaKey || generateTempKey(schema);
    // check existing schema
    const indexedSchema = await this.general.get(key);
    const usedSchema = await this.indexNewSchemaInGeneral(
      schema,
      key,
      indexedSchema
    );
    if (!usedSchema) {
      return key;
    }
    // check if schema effect other schemas
    if (getSchemaStatusInDatabase(schema, indexedSchema) !== 'ready') {
      await this.updateGeneral(usedSchema);
    }
    // close transactions of updated databases
    // open necessary transactions
    // update database instances
    // determine if dbVersion have to increase by all stores in dbName or if could hold (new->increase, schema change->increase, reregister same -> left same)
    return key;
  }

  private async updateGeneral(usedSchema: InternalStoreEntry): Promise<void> {
    const { dbName, dbVersion } = usedSchema;
    const updateNecessary = Object.entries(this.databaseSchemas).filter(
      ([_, { dbName: dbNameItem }]) => dbNameItem === dbName
    );

    const schemas = await Promise.all(
      updateNecessary.map(([key, _]) => this.general.get(key))
    );

    const readyToSave = schemas.reduce(
      (acc, schema) => (schema ? [...acc, { ...schema, dbVersion }] : acc),
      [] as InternalStoreEntry[]
    );

    await Promise.all(
      readyToSave.map(async schema => this.general.update(schema))
    );
  }

  private async indexNewSchemaInGeneral(
    schema: StoreSchema,
    schemaKey: string,
    indexedSchema?: InternalStoreEntry
  ): Promise<InternalStoreEntry | undefined> {
    if (indexedSchema) {
      return indexedSchema;
    }
    const start = +new Date();
    const { dbName, dbVersion: indexedIn } = schema;
    const dbVersion =
      reduceDbNameToVersion(Object.values(this.databaseSchemas))[dbName] ?? 1;
    return await this.general
      .create({
        ...schema,
        indexedIn,
        dbVersion,
        id: schemaKey
      })
      .finally(
        () =>
          this.debug &&
          console.debug('built schema', {
            schemaKey,
            took: +new Date() - start
          })
      );
  }

  private async setup(): Promise<void> {
    const start = +new Date();
    // setup internal database
    const general = await initGeneralDb()
    this.databases.general = general as Database<unknown>;
    if (this.debug) {
      console.debug('synced databases', {
        took: +new Date() - start,
        stores: Object.values(this.idbObjectStores)
          .map(({ name }) => name)
          .join(',')
      });
    }
  }
}
