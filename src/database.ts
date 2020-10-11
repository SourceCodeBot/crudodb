import { IndexedKey, StoreIndex, StoreSchema } from './store-schema';
import { isDeleted, isOnlineSupport } from './utils';
import { CrudApi } from './crud-api';

function schemaConform<T, K extends keyof T>(
  item: T,
  indices: StoreIndex[]
): T {
  const keys: K[] = indices.map(({ name }) => name as K);
  const entries: [K, T[K]][] = keys.map(key => [key, item[key as K]]);
  return Object.fromEntries(entries) as unknown as T;
}

type WithFlag<T> = T & { flag?: string };

export class Database<T> {

  constructor(
    private objectStore: IDBObjectStore,
    private key: string,
    private schema: StoreSchema,
    private api?: CrudApi<T>,
    private debug: boolean = false
  ) {}


  public sync(): Promise<void> {
    type K = WithFlag<T>;
    return new Promise(async (done, _) => {
      const action = new Promise<K[]>((resolve, reject) => {
        this.prepareTransaction();
        const req = this.objectStore.index('flag').getAll();
        req.onsuccess = () => resolve(req.result as K[]);
        req.onerror = () => reject();
      });
      const actions = (await action).map(
        (item: K): Promise<unknown> => {
          switch (item.flag) {
            case 'D':
              return this.getId(item, (id: IndexedKey) =>
                this.deleteRemote(id, item)
              );
            case 'C':
              return this.createRemote(item);
            case 'U':
              return this.updateRemote(item);
            default:
              return Promise.resolve();
          }
        }
      );
      await Promise.all(actions);
      const isOnline = isOnlineSupport(this.api)
        ? await this.api.isOnline()
        : undefined;
      if (this.api && (isOnline === undefined || isOnline)) {
        await this.api
          .getAll()
          .then(fromRemote => this.updateLocalStorage(fromRemote))
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
    return new Promise((resolve, reject) => {
      this.prepareTransaction();
      const request = this.objectStore.get(id);
      request.onerror = err => reject(err);
      request.onsuccess = () =>
        resolve(!request.result || isDeleted(request.result)
            ? undefined
            : (request.result as T)
        );
    });
  }

  public getAll(): Promise<T[]> {
    return new Promise<T[]>(resolve => {
      this.prepareTransaction();
      const req = this.objectStore.getAll();
      req.onsuccess = () => {
        if (req.transaction) {
          req.transaction.oncomplete = () =>
            resolve(req.result.filter(item => !isDeleted(item)) as T[]);
        } else {
          resolve(req.result.filter(item => !isDeleted(item)) as T[]);
        }
      };
    });
  }

  /**
   * create entity in storage
   * @param item
   */
  public create(item: T): Promise<T | undefined> {
    return this.createLocal(item)
      .catch((error) => {
        if (this.debug) {
          console.error({error});
        }
        return undefined;
      })
      .then((entity) => entity && this.createRemote(item).catch((error) => {
        if (this.debug) {
          console.error({error});
        }
        return entity;
    }));
  }

  /**
   * update existing entity in storage
   * @param item
   */
  public update(item: T): Promise<T | undefined> {
    return this.updateLocal(item).then(() => this.updateRemote(item));
  }

  /**
   * delete given entity in local and optional remote storage
   * @param item
   */
  public delete(item: T): Promise<boolean> {
    return this.getId(item, (id: IndexedKey) =>
      this.deleteLocal(id, item)
        .then((result) => result && this.deleteRemote(id, item))
    ).catch((e) => {
      if (this.debug) {
        console.error('error occurred on deletion', {e});
      }
      return false;
    });
  }

  /*****************************
   *                           *
   *     INTERNAL SECTION      *
   *                           *
   *****************************/

  private async updateLocalStorage(fromRemote: T[]): Promise<void> {
    const fromLocal = await this.getAll();
    const { keyPath = 'id' } = this.schema;

    const localIds = extractIdsList(fromLocal, keyPath);
    const remoteIds = extractIdsList(fromRemote, keyPath);

    const createLocal = fromRemote.filter(
      item => !localIds.includes(getValue(item, keyPath as keyof T))
    );
    const deleteLocal = fromLocal.filter(
      item => !remoteIds.includes(getValue(item, keyPath as keyof T))
    );
    const updateLocal = fromLocal.filter(item => !deleteLocal.includes(item));

    createLocal.forEach(item =>
      this.createLocal(item, false).catch(err => logInfo(item, err))
    );
    deleteLocal.forEach(item =>
      this.getId(item, id => this.deleteLocal(id, item, false)).catch(err =>
        logInfo(item, err)
      )
    );
    updateLocal.forEach(item =>
      this.updateLocal(item, false).catch(err => logInfo(item, err))
    );
  }

  private async createLocal(
    item: T,
    addFlag: boolean = true
  ): Promise<T | undefined> {
    const localItem: T & { flag: string } = {
      ...schemaConform(item, this.schema.indices),
      flag: addFlag ? 'C' : ''
    };
    this.prepareTransaction();
    return handleRequest(this.objectStore.add(localItem), localItem);
  }

  private async createRemote(item: T): Promise<T | undefined> {
    if (!this.api) {
      return item;
    }
    const isOnline = isOnlineSupport(this.api)
      ? await this.api.isOnline()
      : undefined;
    if (isOnline === undefined || isOnline) {
      return await this.api
        .create(item)
        .then(async (result: T | undefined) => {
          const deleted = await this.getId(item, (id: IndexedKey) =>
            this.deleteLocal(id, item, false)
          ).catch(() => false);
          return deleted && result
            ? this.createLocal(result, false)
            : undefined;
        })
        .catch(err => {
          console.error(
            `can't call create of api ${buildEntityIdent(this.schema)}`,
            err
          );
          return item;
        });
    }
    return item;
  }

  private async updateLocal(
    item: T,
    addFlag: boolean = true
  ): Promise<T | undefined> {
    const localItem: T & { flag: string } = {
      ...schemaConform(item, this.schema.indices),
      flag: addFlag ? 'U' : ''
    };
    this.prepareTransaction();
    return handleRequest(this.objectStore.put(localItem), localItem);
  }

  private async updateRemote(item: T): Promise<T | undefined> {
    if (!this.api) {
      return item;
    }
    const isOnline = isOnlineSupport(this.api)
      ? await this.api.isOnline()
      : undefined;
    if (isOnline === undefined || isOnline) {
      return this.api
        .update(item)
        .then(async (result: T | undefined) => {
          const deleted = await this.getId(item, (id: IndexedKey) =>
            this.deleteLocal(id, item)
          ).catch(() => false);
          return deleted && result
            ? this.createLocal(result, false)
            : undefined;
        })
        .catch(err => {
          console.error(
            `can't call update of api ${buildEntityIdent(this.schema)}`,
            err
          );
          return item;
        });
    }
    return item;
  }

  private async deleteLocal(
    id: IndexedKey,
    item: T,
    addFlag: boolean = true
  ): Promise<boolean> {
    this.prepareTransaction();
    if (!addFlag) {
      return handleRequest(this.objectStore.delete(id), item)
        .then(() => true)
        .catch((error) => {
          if (this.debug) {
            console.error({error});
          }
          return false;
        });
    }

    return this.get(id)
      .then((entity) => entity && handleRequest(this.objectStore.put({
        ...entity,
        flag: 'D'
      }), true)
    )
      .then((res) => res === undefined ? false : res);
  }

  private async deleteRemote(id: IndexedKey, item: T): Promise<boolean> {
    if (!this.api) {
      return true;
    }
    const isOnline = isOnlineSupport(this.api)
      ? await this.api.isOnline()
      : undefined;
    if (isOnline === undefined || isOnline) {
      return this.api
        .delete(item)
        .then(async (deleted: boolean) => {
          return deleted && (await this.deleteLocal(id, item, false));
        })
        .catch(err => {
          console.error(
            `can't call delete of api ${buildEntityIdent(this.schema)}`,
            err
          );
          return false;
        });
    }
    return true;
  }

  private getId<S>(
    item: T,
    callback: (id: IndexedKey) => Promise<S>
  ): Promise<S> {
    const { keyPath = 'id' } = this.schema;
    if (!(item as any).hasOwnProperty(keyPath)) {
      return Promise.reject();
    }
    const id: IndexedKey = getValue(item, keyPath as keyof T) as any;
    return callback(id);
  }

  public updateStore(objectStore: IDBObjectStore): void {
    this.objectStore = objectStore;
  }

  private prepareTransaction(): void {
    this.updateStore(renewStore(this.objectStore));
  }
}

function buildEntityIdent({
  dbName,
  store
}: {
  dbName: string;
  store: string;
}): string {
  return `${dbName}:${store}`;
}

function handleRequest<T, S>(
  request: IDBRequest<S>,
  item: T
): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    try {
      let result: T | undefined = undefined;
      request.onsuccess = () => (result = item);
      request.onerror = evt => console.error('can not handle operation', { evt, item });
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
  return list
    .map(item => getValue(item, key as K) as T[K])
    .filter(id => id != null);
}

function logInfo<T>(item: T, error: unknown): void {
  console.debug(`error while sync`, { item, error });
}

function getValue<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}

function renewStore(objectStore: IDBObjectStore): IDBObjectStore {
  const db = objectStore.transaction.db;
  return db.transaction(objectStore.name, 'readwrite')
    .objectStore(objectStore.name);
}
