import { Observable, Subject } from "rxjs";
import { shareReplay, take } from "rxjs/operators";
import { IndexedKey, StoreSchema } from "./models";
import { CrudApi, Database } from "./database";

interface InternalStoreEntry extends StoreSchema {
  id: string;
  // version of database for StoreSchema#dbVersion
  indexedIn: number;
}

const SCHEMA: StoreSchema = {
  indices: [
    { name: 'id' },
    { name: 'dbVersion' },
    { name: 'indexedVersion' }
  ],
  dbVersion: 1,
  dbName: 'internal',
  store: 'stores'
};

/**
 *
 * TODO: avoid onupgradeneeded, if the version is changed caused by minimum version of database
 * - minimum version as x = sum(schemas in database)
 */
class RestfulDB {

	static InternalEvent = {
		CHANGED: 'dataChanged',
		STORAGE_KEY: '_dataChangedTimestamp'
	};

	private readyTrigger: Subject<void> = new Subject<void>();

  /**
   * subscribe me to get notification about setup completeness.
   * use me like `await DB.onReady$.pipe(take(1)).toPromise();`
   */
	public onReady$: Observable<void> = this.readyTrigger.asObservable().pipe(shareReplay(1));

	private databases: Record<string, Database<unknown>> = {};

	constructor(sync?: boolean) {
	  this.setup(sync);
  }

  public awaitInitialized(): Promise<void> {
	  return this.onReady$.pipe(take(1)).toPromise();
  }

  private setup(syncAfterInit?: boolean): void {
	  // setup internal database
    initGeneralDb()
      .then((db) => (this.databases.general = db))
      .then(() => this.readyTrigger.next());
    // trigger syncs ?
    if (syncAfterInit) {
      Promise.all(Object.values(this.databases).map((db) => db.sync()))
        .then(() => console.debug('synced all databases'))
        .catch((err) => console.error('error occurred while sync', err));
    }
  }

	public async get<T>(schemaKey: string, id: IndexedKey): Promise<T | undefined> {
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

  public update<T>(schemaKey: string, item: T): Promise<T> {
	  return execDatabase(
	    schemaKey,
      this.databases[schemaKey],
      (db: Database<T>) => db.update(item)
    );
  }

  public registerDatabase<T>(schema: StoreSchema, schemaKey?: string, api?: CrudApi<T>): string {
    const key = schemaKey || generateTempKey(schema);
    const schemas = Object.values(this.databases).map((db) => db.schema);
    const schemaMap = groupVersions([...schemas, schema]);
    const dbVersion = schemaMap[schema.dbName] + 1;
    const modifiedSchema = {
      ...schema,
      dbVersion
    };
	  this.databases[key] = new Database<T>(key, modifiedSchema, api);
    this.updateGeneral(this.databases[key], schema.dbVersion);
	  Object.values(this.databases).filter((db) => db.schema.dbName === schema.dbName).forEach((db) => {
	    db.schema = {
	      ...db.schema,
        dbVersion
      }
    });
	  return key;
  }


  private updateGeneral(database: Database<unknown>, dbVersion: number): void {
    const general = this.databases.general as Database<InternalStoreEntry>;

  }

  public isDatabaseReady(schemaKey: string): Promise<boolean> {
	  return execDatabase(
	    schemaKey,
      this.databases[schemaKey],
      (db: Database<unknown>) => db.awaitInitialized()
    )
  }

	private async onGoingOnline(): Promise<void> {
		if (Object.values(this.databases).length < 1) {
		  return;
    }
		await Promise.all(Object.values(this.databases).map((db: Database<unknown>) => db.sync()));
	}

}

function onDataChanged(): void {
  const timestamp = (+new Date()).toString();
  window.dispatchEvent(
    new CustomEvent(RestfulDB.InternalEvent.CHANGED, { detail: timestamp })
  );
  localStorage.setItem(
    RestfulDB.InternalEvent.STORAGE_KEY,
    timestamp
  );
}

async function initGeneralDb(): Promise<Database<unknown>> {
  const general = new Database<InternalStoreEntry>('__general__', SCHEMA);
  return general.awaitInitialized().then(() => general);
}

function execDatabase<T, S>(schemaKey: string, database: Database<unknown> | undefined, callback: (db: Database<T>) => Promise<S>): Promise<S> {
  return database ? callback(database as Database<T>) : Promise.reject(`${schemaKey} does not exists`);
}

function generateTempKey(schema: StoreSchema): string {
  return `custom_schema:${schema.dbName}:${schema.store}`;
}

function groupVersions(databases: StoreSchema[]): Record<string, number> {
  return databases.reduce((acc, schema) => {
    const {dbName, dbVersion} = schema;
    if (acc[dbName]) {
      acc[dbName] = Math.max(acc[dbName], dbVersion);
    } else {
      acc[dbName] = dbVersion;
    }
    return acc;
  }, {});
}
