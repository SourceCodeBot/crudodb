import {IndexedKey, StoreSchema} from "./store-schema";
import {isDeleted, isOnlineSupport} from "./utils";
import {CrudApi} from "./crud-api";

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

	/**
	 *
	 */
	public get store(): IDBDatabase | undefined {
		return this._store;
	}

	/**
	 *
	 * @param db
	 */
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
			request.onupgradeneeded = (evt) => this.onUpgradeNeeded(evt, this.schema)
				.then(() => resolve(request.result));
			if (request.transaction) {
				request.transaction.oncomplete = () => {
					resolve(request.result);
				};
			} else {
				request.onsuccess = () => resolve(request.result);
				request.onerror = () => reject();
			}
		});
	}

	public sync(): Promise<void> {
		type K = T & {flag?: string};
		return new Promise(async (done, _) => {
			const {_store: store, schema} = this;
			const action = runAction<K[]>({
				store,
				schema,
				mode: 'readonly',
				routine: (_store: IDBObjectStore) => new Promise<K[]>((resolve, reject) => {
					const req = _store.index('flag').getAll();
					req.onsuccess = () => resolve(req.result as K[]);
					req.onerror = () => reject();
				})
			});
			const actions = (await action).map((item: K): Promise<any> => {
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
			});
			await Promise.all(actions);
			const isOnline = isOnlineSupport(this.api) ? await this.api.isOnline() : undefined;
			if (this.api && (isOnline === undefined || isOnline)) {
				await this.api.getAll()
					.then((fromRemote) => this.updateLocalStorage(fromRemote))
					.catch((err) => console.error(`${this.key} sync failed with api`, err));
			}
			done();
		});
	}

	/**
	 *
	 * @param id
	 */
	public get(id: IndexedKey): Promise<T | undefined> {
		const {_store: store, schema} = this;
		return runAction<T | undefined>({
			store,
			schema,
			mode: 'readonly',
			routine: (_store) => new Promise((resolve, reject) => {
				const request = _store.index('flag').get(id);
				request.onerror = (err) => reject(err);
				request.onsuccess = () => resolve(isDeleted(request.result) ? undefined : request.result as T);
			})
		});
	}

	public getAll(): Promise<T[]> {
		const {_store: store, schema} = this;
		return runAction<T[]>({
			store,
			schema,
			mode: 'readonly',
			routine: (store) => new Promise<T[]>((resolve) => {
				const req = store.getAll();
				req.onsuccess = () => {
					if (req.transaction) {
						req.transaction.oncomplete = () => resolve(req.result.filter((item) => !isDeleted(item)) as T[]);
					} else {
						resolve(req.result.filter((item) => !isDeleted(item)) as T[]);
					}
				};
			})
		});
	}

	/**
	 * create entity in storage
	 * @param item
	 */
	public create(item: T): Promise<T | undefined> {
		return this.createLocal(item)
			.then(() => this.createRemote(item));
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
				objectStore.transaction.onerror = () => reject();
				objectStore.transaction.onabort = () => reject();
			})).then(() => db.close());
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
		const {_store: store, schema} = this;
		return runAction<T | undefined>({
			store,
			schema,
			mode: 'readwrite',
			routine: (_store) =>
				usingDatabase(store, () => handleRequest(_store.add(localItem), localItem))
		});
	}

	private async createRemote(item: T): Promise<T | undefined> {
		if (!this.api) {
			return item;
		}
		const isOnline = isOnlineSupport(this.api) ? await this.api.isOnline() : undefined;
		if (isOnline === undefined || isOnline) {
			return await this.api.create(item).then(async (result: T | undefined) => {
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
		const {_store: store, schema} = this;
		return runAction<T | undefined>({
			store,
			schema,
			mode: 'readwrite',
			routine: (_store) =>
				usingDatabase(store, () => handleRequest(_store.put(localItem), localItem))
		});
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
		const {_store: store, schema} = this;
		if (!addFlag) {
			return runAction({
				schema,
				store,
				mode: 'readwrite',
				routine: (_store) =>
					usingDatabase(store, () => handleRequest(_store.delete(id), item)
							.then(() => true)
							.catch(() => false))
			});
		}
		const localItem: T & { flag?: string } = {...item, flag: 'D'};
		return runAction<boolean>({
			store,
			schema,
			mode: 'readwrite',
			routine: (_store) => handleRequest(_store.put(localItem), true)
				.then(((res) => res === undefined ? true : res))
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
	return new Promise((resolve, reject) => {
		try {
			let result: T | undefined = undefined;
			request.onsuccess = () => (result = item);
			request.onerror = evt => console.error('can not handle operation', {evt, item});
			request.transaction!.oncomplete = () => resolve(result);
		} catch (error) {
			console.error('can not handle request', {
				item,
				error
			});
			reject(error);
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

function runAction<T>({store, schema, mode, routine}: {
	store: IDBDatabase | undefined,
	schema: StoreSchema,
	mode: 'readonly' | 'readwrite',
	routine: (objectStore: IDBObjectStore) => Promise<T>
}): Promise<T> {
	if (!store) {
		console.trace({
			store, schema, mode, routine
		});
		return Promise.reject('no database');
	}
	const {store: s} = schema;
	const objectStore = store
		.transaction([s], mode)
		.objectStore(s);
	return routine(objectStore)
		.finally(() => store.close());
}

function usingDatabase<T>(store: IDBDatabase | undefined, call: () => Promise<T>): Promise<T> {
	return call().finally(() => store?.close());
}
