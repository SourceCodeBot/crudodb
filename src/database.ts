import { IndexedKey, StoreIndex, StoreSchema } from './store-schema';
import { assertNotNull, isDeleted, isOnlineSupport } from './utils';
import { CrudApi } from './crud-api';

type WithFlag<T> = T & { flag?: string };

export class Database<T> {
  constructor(
    private objectStore: IDBObjectStore,
    private key: string,
    private schema: StoreSchema,
    private api?: CrudApi<T>
  ) {}

  /**
   * push local transactions to remote and try to fetch updates from remote
   */
  public async sync(): Promise<void> {
    type F = WithFlag<T>;
    const isOnline =
      this.api && isOnlineSupport(this.api) ? await this.api.isOnline() : true;
    if (!isOnline) {
      return;
    }
    const localItems = await new Promise<F[]>((resolve, reject) => {
      this.prepareTransaction();
      const req = this.objectStore.index('flag').getAll();
      req.onsuccess = () => resolve(req.result as F[]);
      req.onerror = () => reject();
    });

    const actions = localItems.map(
      (item: F): Promise<unknown> => {
        switch (item.flag) {
          case 'D':
            return this.getId(item, (id: T[keyof T]) =>
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
    if (this.api && isOnline) {
      try {
        const fromRemote = await this.api.getAll();
        await this.updateLocalStorage(fromRemote);
      } catch (error) {
        console.error(`${this.key} sync failed with api`, error);
      }
    }
  }

  public get(id: T[keyof T]): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
      this.prepareTransaction();
      const request = this.objectStore.get((id as unknown) as IndexedKey);
      request.onerror = err => reject(err);
      request.onsuccess = async () => {
        const result = request.result;
        if (!result && this.api) {
          const isOnline = isOnlineSupport(this.api)
            ? await this.api.isOnline()
            : true;
          if (isOnline) {
            try {
              const response = await this.api.get(id);
              resolve(response);
            } catch (error) {
              reject(error);
            }
            return;
          }
        }
        resolve(!result || isDeleted(result) ? undefined : (result as T));
      };
    });
  }

  public getAll(): Promise<T[]> {
    return new Promise<T[]>((resolve, reject) => {
      this.prepareTransaction();
      const request = this.objectStore.getAll();
      request.onsuccess = async () => {
        const result = request.result;
        if (result?.length < 1 && this.api) {
          const isOnline = isOnlineSupport(this.api)
            ? await this.api.isOnline()
            : true;
          if (isOnline) {
            try {
              const response = await this.api.getAll();
              resolve(response);
            } catch (error) {
              reject(error);
            }
            return;
          }
        }
        resolve(request.result.filter(item => !isDeleted(item)) as T[]);
      };
    });
  }

  /**
   * create entity in storage
   * @param item
   */
  public async create(item: T): Promise<T> {
    const entity = assertNotNull(await this.createLocal(item));
    return assertNotNull(await this.createRemote(entity));
  }

  /**
   * update existing entity in storage
   * @param item
   */
  public async update(item: T): Promise<T> {
    const entity = assertNotNull(await this.updateLocal(item));
    return assertNotNull(await this.updateRemote(entity));
  }

  /**
   * delete given entity in local and optional remote storage
   * @param item
   */
  public async delete(item: T): Promise<void> {
    await this.getId(item, (id: T[keyof T]) =>
      this.deleteLocal(id, item).then(_ => this.deleteRemote(id, item))
    );
  }

  /*****************************
   *                           *
   *     INTERNAL SECTION      *
   *                           *
   *****************************/

  private async updateLocalStorage(fromRemote: T[]): Promise<void> {
    const fromLocal = await this.getAll();
    const { keyPath = 'id' } = this.schema;

    const idFn = (item: T) => getValue(item, keyPath as keyof T);

    const localIds = extractIdsList(fromLocal, keyPath);
    const remoteIds = extractIdsList(fromRemote, keyPath);

    const createLocal = fromRemote.filter(
      item => !localIds.includes(idFn(item))
    );
    const deleteLocal = fromLocal.filter(
      item => !remoteIds.includes(idFn(item))
    );
    const deleteLocalIds = deleteLocal.map(idFn);

    const updateLocal = fromRemote.filter(
      item =>
        localIds.includes(idFn(item)) && !deleteLocalIds.includes(idFn(item))
    );

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

  private async createLocal(item: T, addFlag: boolean = true): Promise<T> {
    const localItem: T & { flag: string } = {
      ...schemaConform(item, this.schema.indices),
      flag: addFlag ? 'C' : ''
    };
    this.prepareTransaction();
    return assertNotNull(
      await handleRequest(this.objectStore.add(localItem), localItem)
    );
  }

  private async createRemote(item: T): Promise<T> {
    if (!this.api) {
      return item;
    }
    const isOnline = isOnlineSupport(this.api)
      ? await this.api.isOnline()
      : undefined;
    if (isOnline === undefined || isOnline) {
      const result = await this.api.create(
        schemaConform(item, this.schema.indices)
      );
      await this.getId(item, (id: T[keyof T]) =>
        this.deleteLocal(id, item, false)
      );
      return await this.createLocal(assertNotNull(result), false);
    }
    return item;
  }

  private async updateLocal(
    item: T,
    addFlag: boolean = true
  ): Promise<T | undefined> {
    const entity = assertNotNull(await this.getId(item, id => this.get(id)));
    const localItem: T & { flag: string } = {
      ...schemaConform(item, this.schema.indices),
      flag: addFlag ? evaluateUpdateFlag(entity) : ''
    };
    this.prepareTransaction();
    assertNotNull(entity);
    return await handleRequest(this.objectStore.put(localItem), localItem);
  }

  private async updateRemote(item: T): Promise<T> {
    if (!this.api) {
      return item;
    }
    const isOnline = isOnlineSupport(this.api)
      ? await this.api.isOnline()
      : undefined;
    if (isOnline === undefined || isOnline) {
      try {
        const result = await this.api.update(
          schemaConform(item, this.schema.indices)
        );
        const entity = await this.updateLocal(assertNotNull(result), false);
        return assertNotNull(entity);
      } catch (err) {
        console.error(
          `can't call update of api ${buildEntityIdent(this.schema)}`,
          err
        );
      }
    }
    return item;
  }

  private async deleteLocal(
    id: T[keyof T],
    item: T,
    addFlag: boolean = true
  ): Promise<void> {
    this.prepareTransaction();
    if (!addFlag) {
      await handleRequest(
        this.objectStore.delete((id as unknown) as IndexedKey),
        item
      );
      return;
    }
    const entity = await this.get((id as unknown) as T[keyof T]);
    assertNotNull(entity);
    await handleRequest(
      this.objectStore.put({
        ...entity,
        flag: 'D'
      }),
      true
    );
  }

  private async deleteRemote(id: T[keyof T], item: T): Promise<boolean> {
    if (!this.api) {
      return true;
    }
    const isOnline = isOnlineSupport(this.api)
      ? await this.api.isOnline()
      : undefined;
    if (isOnline === undefined || isOnline) {
      try {
        await this.api.delete(schemaConform(item, this.schema.indices));
        await this.deleteLocal(id, item, false);
      } catch (err) {
        console.error(
          `can't call delete of api ${buildEntityIdent(this.schema)}`,
          err
        );
        return false;
      }
    }
    return true;
  }

  private getId<S>(
    item: T,
    callback: (id: T[keyof T]) => Promise<S>
  ): Promise<S> {
    const { keyPath = 'id' } = this.schema;
    if (!(item as any).hasOwnProperty(keyPath)) {
      return Promise.reject();
    }
    return callback(getValue(item, keyPath as keyof T));
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
      request.onerror = evt => {
        console.error('can not handle operation', { evt, item });
        throw new Error(evt.type);
      };
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
  return db
    .transaction(objectStore.name, 'readwrite')
    .objectStore(objectStore.name);
}

function evaluateUpdateFlag(entity?: any): string {
  return entity && entity.flag === 'C' ? 'C' : 'U';
}

function schemaConform<T, K extends keyof T>(
  item: T,
  indices: StoreIndex[]
): T {
  const keys: K[] = indices.map(({ name }) => name as K);
  const entries: [K, T[K]][] = keys.map(key => [key, item[key as K]]);
  return (Object.fromEntries(entries) as unknown) as T;
}
