import {IndexedKey, StoreSchema} from "./models";
import {isNotDeleted, isOnlineSupport} from "./utils";

export interface CrudApi<T> {
	/**
	 * that function should be able to persist an new entity and return it.
	 * otherwise undefined.
	 * @note do not throw errors! there is no error handler. separation of concern!
	 * @param obj
	 */
	create(obj: T): Promise<T | undefined>;

	/**
	 * that function should be able to update an existing entity and return it.
	 * otherwise undefined.
	 * @note do not throw errors! there is no error handler. separation of concern!
	 * @param obj
	 */
	update(obj: T): Promise<T | undefined>;

	/**
	 * that function should be able to remove an existing entity and return successfully or not.
	 * @note do not throw errors! there is no error handler. separation of concern!
	 * @param obj
	 */
	delete(obj: T): Promise<boolean>;

	/**
	 * that function should be able to find and return an existing entity or undefined.
	 * @note do not throw errors! there is no error handler. separation of concern!
	 * @param id
	 */
	get(id: IndexedKey): Promise<T | undefined>;

	/**
	 * that function should be able to return a list of all existing entities or an empty array of that type.
	 * @note do not throw errors! there is no error handler. separation of concern!
	 */
	gets(): Promise<T[]>;
}

export interface CheckApiOnline {
	isOnline: () => Promise<boolean>;
}

/**
 * TODO: await running transactions
 * TODO: close connection
 * TODO: open if necessary
 */
export class Database<T> {

	private readonly initialized$: Promise<boolean>;

	constructor(
		public key: string,
		public schema: StoreSchema,
		private api?: CrudApi<T>,
	) {
		this.initialized$ = this.setup();
	}

	private _store: IDBDatabase | undefined;

	public get store(): IDBDatabase | undefined {
		return this._store;
	}

	public set store(db: IDBDatabase | undefined) {
		this._store = db;
	}

	public awaitInitialized(): Promise<boolean> {
		return this.initialized$;
	}

	public init(): Promise<IDBDatabase> {
		return new Promise<IDBDatabase>((resolve, reject) => {
			const {dbName, dbVersion} = this.schema;
			const request = indexedDB.open(dbName, dbVersion);
			request.onsuccess = () => resolve(request.result);

			request.onerror = () => reject(request.result);

			request.onupgradeneeded = (evt) => this.onUpgradeNeeded(evt, this.schema)
				.then(() => resolve(request.result));
		});
	}

	public sync(): Promise<void> {
		return new Promise((resolve, reject) => {
			const db = this.store;
			if (!db) {
				reject('no database connection');
				return;
			}
			const {store} = this.schema;
			const request = db
				.transaction(store, 'readwrite')
				.objectStore(store)
				.index('flag')
				.getAll();

			request.onerror = reject;
			request.onsuccess = async () => {
				await Promise.all(request.result.map((item: T & { flag: string }): Promise<any> => {
					switch (item.flag) {
						case 'D':
							return this.getId(item, (id: IndexedKey) => this.deleteRemote(id, item));
						case 'C':
							return this.createRemote(item);
						case 'U':
							return this.updateRemote(item);
						default:
							console.warn('undefined flag', item.flag);
							return Promise.resolve();
					}
				}));
				const isOnline = isOnlineSupport(this.api) ? await this.api.isOnline() : undefined;
				if (this.api && (isOnline === undefined || isOnline)) {
					await this.api.gets()
						.then((fromRemote) => this.updateLocalStorage(fromRemote))
						.catch((err) => console.error(`${this.key} sync failed with api`, err));
				}
				resolve();
			};
		});
	}

	public get(id: IndexedKey): Promise<T | undefined> {
		if (!this.store) {
			return Promise.reject('no database connection');
		}
		const {store} = this.schema;
		const request = this.store
			.transaction(store, 'readonly')
			.objectStore(store)
			.index('flag')
			.get(id);
		return new Promise((resolve, reject) => {
			request.onerror = (err) => reject(err);
			request.onsuccess = () => resolve(isNotDeleted(request.result) ? request.result as T : undefined);
		});
	}

	public getAll(): Promise<T[]> {
		if (!this.store) {
			return Promise.reject('no database connection');
		}
		const {store} = this.schema;
		const request = this.store
			.transaction([store], 'readonly')
			.objectStore(store)
			.getAll();
		return new Promise((resolve, reject) => {
			request.onsuccess = () => resolve(request.result.filter(isNotDeleted) as T[]);
			request.onerror = (err) => reject(err);
		});
	}

	/**
	 * create entity in storage
	 * @param item
	 */
	public create(item: T): Promise<T | undefined> {
		return this.createLocal(item).then(() => {
			return this.createRemote(item);
		});
	}

	/**
	 * update existing entity in storage
	 * @param item
	 */
	public update(item: T): Promise<T | undefined> {
		return this.updateLocal(item)
			.then(() => this.updateRemote(item));
	}

	/**
	 * delete given entity in local and optional remote storage
	 * @param item
	 */
	public delete(item: T): Promise<boolean> {
		return this.getId(item, (id: IndexedKey) => this.deleteLocal(id, item)
			.then(() => this.deleteRemote(id, item)))
			.catch(() => false);
	}

	private async setup(): Promise<boolean> {
		try {
			this.store = await this.init();
			return this.store != null;
		} catch (err) {
			console.error('error occurred while init database', err);
		}
		return false;
	}

	private async onUpgradeNeeded(evt: IDBVersionChangeEvent, schema: StoreSchema): Promise<void> {
		const {store, keyPath = 'id', indices, dbVersion} = schema;
		const db = evt.target && isIDBOpenRequest(evt.target) ? evt.target.result : this.store;
		if (!db) {
			return;
		}
		if (evt.oldVersion < dbVersion) {
			const objectStore = db.createObjectStore(store, {keyPath});

			indices.forEach(({name, keyPath = name, unique = false}) =>
				objectStore.createIndex(name, keyPath, {unique})
			);

			objectStore.createIndex('flag', 'flag', {unique: false});
			await new Promise(((resolve, reject) => {
				objectStore.transaction.oncomplete = () => resolve();
				objectStore.transaction.onerror = reject;
				objectStore.transaction.onabort = reject;
			}));
		} else if (schema.onUpgradeNeeded) {
			await schema.onUpgradeNeeded(db, evt);
		}
	}

	/*****************************
	 *                           *
	 *     INTERNAL SECTION      *
	 *                           *
	 *****************************/


	private async updateLocalStorage(fromRemote: T[]): Promise<void> {
		const fromLocal = await this.getAll();
		const {keyPath = 'id'} = this.schema;

		const localIds = extractIdsList(fromLocal, keyPath);
		const remoteIds = extractIdsList(fromRemote, keyPath);

		const createLocal = fromRemote.filter((item) => !localIds.includes(getValue(item, keyPath as keyof T)));
		const deleteLocal = fromLocal.filter((item) => !remoteIds.includes(getValue(item, keyPath as keyof T)));
		const updateLocal = fromLocal.filter((item) => !deleteLocal.includes(item));

		createLocal.forEach((item) => this.createLocal(item, false)
			.catch((err) => logInfo(item, err)));
		deleteLocal.forEach((item) => this.getId(item,
			(id) => this.deleteLocal(id, item, false)
		).catch((err) => logInfo(item, err)));
		updateLocal.forEach((item) => this.updateLocal(item, false)
			.catch((err) => logInfo(item, err)));
	}

	private async createLocal(item: T, addFlag: boolean = true): Promise<T | undefined> {
		const localItem: T & { flag?: string } = {...item, flag: addFlag ? 'C' : undefined};
		return this.updateInternalEntry(localItem, 'create', (store) => store.add(localItem));
	}

	private async createRemote(item: T): Promise<T | undefined> {
		if (!this.api) {
			return item;
		}
		const isOnline = isOnlineSupport(this.api) ? await this.api.isOnline() : undefined;
		if (isOnline === undefined || isOnline) {
			return this.api.create(item).then(async (result: T | undefined) => {
				const deleted = await this.getId(item, (id: IndexedKey) => this.deleteLocal(id, item)).catch(() => false);
				return deleted && result ? this.createLocal(result, false) : undefined;
			}).catch((err) => {
				console.error(`can't call create of api ${buildEntityIdent(this.schema)}`, err);
				return item;
			});
		}
		return item;
	}

	private updateLocal(item: T, addFlag: boolean = true): Promise<T | undefined> {
		const localItem: T & { flag?: string } = {...item, flag: addFlag ? 'U' : undefined};
		return this.updateInternalEntry(localItem, 'update', (store) => store.put(item));
	}

	private async updateRemote(item: T): Promise<T | undefined> {
		if (!this.api) {
			return item;
		}
		const isOnline = isOnlineSupport(this.api) ? await this.api.isOnline() : undefined;
		if (isOnline === undefined || isOnline) {
			return this.api.update(item).then(async (result: T | undefined) => {
				const deleted = await this.getId(item, (id: IndexedKey) => this.deleteLocal(id, item)).catch(() => false);
				return deleted && result ?  this.createLocal(result, false) : undefined;
			}).catch((err) => {
				console.error(`can't call update of api ${buildEntityIdent(this.schema)}`, err);
				return item;
			});
		}
		return item;
	}

	private deleteLocal(id: IndexedKey, item: T, addFlag: boolean = true): Promise<boolean> {
		if (!addFlag) {
			return this.updateInternalEntry(item, 'delete', (store) => store.delete(id))
				.then(() => true)
				.catch(() => false);
		}
		const localItem: T & { flag?: string } = {...item, flag: 'D'};

		return this.updateInternalEntry(localItem, 'delete', (store) => store.put(localItem))
			.then((result) => result === undefined);
	}

	private updateInternalEntry<S>(
		localItem: T & { flag?: string },
		routine: string,
		storeRoutine: (store: IDBObjectStore) => IDBRequest<S>
	): Promise<T | undefined> {
		if (!this.store) {
			return Promise.reject('no database');
		}
		const {store} = this.schema;
		const request = storeRoutine(
			this.store
				.transaction([store], 'readwrite')
				.objectStore(store)
		);
		return handleRequest(request, localItem)
			.catch((err) => {
				console.error(`cant ${routine} local entry`, err);
				return localItem;
			});
	}

	private async deleteRemote(id: IndexedKey, item: T): Promise<boolean> {
		if (!this.api) {
			return false;
		}
		const isOnline = isOnlineSupport(this.api) ? await this.api.isOnline() : undefined;
		if (isOnline === undefined || isOnline) {
			return this.api.delete(item).then(async (deleted: boolean) => {
				return deleted && await this.deleteLocal(id, item, false);
			}).catch((err) => {
				console.error(`can't call delete of api ${buildEntityIdent(this.schema)}`, err);
				return false;
			});
		}
		return true;
	}

	private getId<S>(item: T, callback: (id: IndexedKey) => Promise<S>): Promise<S> {
		const {keyPath = 'id'} = this.schema;
		if (!(item as any).hasOwnProperty(keyPath)) {
			return Promise.reject();
		}
		const id: IndexedKey = getValue(item, keyPath as keyof T) as any;
		return callback(id);
	}
}

function buildEntityIdent({dbName, store}: { dbName: string, store: string }): string {
	return `${dbName}:${store}`;
}

function handleRequest<T, S>(request: IDBRequest<S>, item: T): Promise<T | undefined> {
	return new Promise(resolve => {
		try {
			request.onsuccess = () => {
				resolve(item);
			};
			request.onerror = evt => {
				console.error('can not handle operation', {
					evt,
					item
				});
				resolve(undefined);
			};
		} catch (error) {
			console.error('can not handle request', {
				item,
				error
			});
		}
	});
}

function extractIdsList<T, K extends keyof T>(list: T[], key: string): T[K][] {
	return list.map((item) => getValue(item, key as K) as T[K]).filter((id) => id != null);
}

function logInfo<T>(item: T, error: unknown): void {
	console.debug(`error while sync`, {item, error});
}

function isIDBOpenRequest(object: any): object is IDBOpenDBRequest {
	return object.hasOwnProperty('onupgradeneeded');
}

function getValue<T, K extends keyof T>(obj: T, key: K): T[K] {
	return obj[key];
}
