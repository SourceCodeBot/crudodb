import { Database } from '../src/database';
import { CrudApi, StoreSchema } from '../src';

require('fake-indexeddb/auto');

interface Dao {
  id?: string;
  key: string;
  value: unknown;
}

const DAO_SCHEMA: StoreSchema = {
  indices: [{ name: 'id', unique: true }, { name: 'key' }, { name: 'value' }],
  store: 'jest',
  dbName: 'jest-database-CHANGE',
  dbVersion: 1
};

class DaoApi implements CrudApi<Dao> {
  private storage: Record<string, Dao> = {};

  public delete(obj: Dao): Promise<boolean> {
    if (obj.id && this.storage[obj.id]) {
      delete this.storage[obj.id];
      return Promise.resolve(true);
    }
    return Promise.resolve(false);
  }
  public create(obj: Dao): Promise<Dao | undefined> {
    if (obj.id) {
      this.storage[obj.id] = obj;
      return Promise.resolve(obj);
    }
    return Promise.reject('no id');
  }
  public get(id: string): Promise<Dao | undefined> {
    return this.storage[id]
      ? Promise.resolve(this.storage[id])
      : Promise.reject('not found');
  }
  public getAll(): Promise<Dao[]> {
    return Promise.resolve(Object.values(this.storage));
  }
  public update(obj: Dao): Promise<Dao | undefined> {
    if (!obj.id) {
      return Promise.reject('no id');
    }
    const inner = this.storage[obj.id];
    if (inner) {
      this.storage[obj.id] = obj;
      return Promise.resolve(obj);
    }
    return Promise.reject('not found');
  }
}

const debug = false;

describe('#database', () => {

  afterEach(async () => {
    await unload();
  });

  function initialize(schema: StoreSchema): Promise<IDBObjectStore> {
    return new Promise(async (resolve, reject) => {
      const req = indexedDB.open(schema.dbName, schema.dbVersion);
      req.onupgradeneeded = () => {
        const { indices, store: storeName, keyPath = 'id' } = schema;
        const store = req.result.createObjectStore(storeName, { keyPath });
        store.transaction.oncomplete = () => {
          const tx = req.result.transaction(storeName, 'readwrite');
          resolve(tx.objectStore(storeName));
        };
        store.transaction.onabort = console.error;
        store.transaction.onerror = console.error;

        [{ name: 'flag' }, ...indices]
          .forEach(({ name, keyPath: kP, unique }) =>
            store.createIndex(name, kP ?? name, { unique })
        );
      };
      req.onsuccess = () => {
        const { store: storeName } = schema;
        const tx = req.result.transaction(storeName, 'readwrite');
        resolve(tx.objectStore(storeName));
      };
      req.onblocked = reject;
      req.onerror = reject;
    });
  }

  function unload(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase('jest-database');
      request.onblocked = () => reject('blocked');
      request.onupgradeneeded = () => reject('upgradeneeded');
      request.onsuccess = resolve;
      request.onerror = () => reject('error');
    })
      .then(() => true)
      .catch(err => {
        console.error('unload failed', err);
        return false;
      });
  }

  function getDb<T>(schema: StoreSchema, api?: CrudApi<T>, initialLoad?: T[]): Promise<Database<T>> {
    return initialize(schema).then(
      store => {
        if (initialLoad) {
          const forLoad = store.transaction.db
            .transaction(store.name, 'readwrite')
            .objectStore(store.name);
          initialLoad.forEach((item) => forLoad.add({
            ...item,
            flag: ''
          }));
        }
        return new Database(store, randomString(), schema, api, debug);
      }
    )
      .catch((err) => {
      console.error({err});
      fail('initialize failed');
    });
  }

  describe('#objectStore', () => {
    it('should work if store changed', async () => {
      const test = 'shouldworkifstorechanged';
      const schema = createSchema(`jest-database-${test}`);
      const instance = await getDb<Dao>(schema);
      const entity = await instance.create(
        createDao(test)
      );
      instance.updateStore(await initialize(schema));

      const fromStore = await instance.get(test);
      expect(fromStore).toEqual({
        ...entity,
        flag: 'C'
      });
    });
  });

  describe('#api', () => {
    it('should work if api isDefined', async () => {
      const test = 'shouldworkifapiisDefined';
      const instance = await getDb<Dao>(
        createSchema(`jest-database-${test}`),
        new DaoApi()
      );
      const entity = await instance.create(
        createDao(test)
      );
      expect(await instance.get(test)).toEqual(entity);
    });
  });

  describe('#create', () => {
    it('should create only local item', async() => {
      const test = 'shouldcreateonlylocalitem';
      const instance = await getDb<Dao>(
        createSchema(`jest-database-${test}`)
      );
      const entity = await instance.create(
        createDao(test)
      );
      const fromStore = await instance.get(test);
      expect(fromStore).toEqual({
        ...entity,
        flag: 'C'
      });
    });

    it('should create only local item reduced on indices', async () => {
      const test = 'shouldcreateonlylocalitemreducedonindices';
      interface ExtDao extends Dao {
        notIndexedDaoKey: string;
      }
      const instance = await getDb<Dao>(
        createSchema(`jest-database-${test}`)
      );
      const dao: ExtDao = {
        ...createDao(test),
        notIndexedDaoKey: 'helloWorld'
      };
      const entity = await instance.create(dao);
      const fromStore = await instance.get(test);
      expect(fromStore).not.toEqual(entity);
      expect(fromStore).not.toHaveProperty('notIndexedDaoKey');
    });

    it('should not create local item', async () => {
      const test = 'shouldnotcreatelocalitem';
      const instance = await getDb<Dao>(
        createSchema(`jest-database-${test}`)
      );
      const dao: Dao = {
        key: null!,
        id: null!,
        value: 42
      };
      const entity = await instance.create(dao);
      const fromStore = await instance.get(test);
      expect(entity).toBeUndefined();
      expect(fromStore).toBeUndefined();
    });

    it('should create local item and in api', async () => {
      const test = 'shouldcreatelocalitemandinapi';
      const schema = createSchema(`jest-database-${test}`);
      const instance = await getDb<Dao>(schema, new DaoApi());
      const entity = await instance.create(
        createDao(test)
      );
      const fromStore = await instance.get(test);
      expect(fromStore).toEqual({
        ...entity,
        flag: ''
      });
    });

    it('should create only local item if api fails', async () => {
      const test = 'shouldcreateonlylocalitemifapifails';
      const api: DaoApi = {
        create: () => {
          throw new Error('ups');
        }
      } as any;
      const schema = createSchema(`jest-database-${test}`);
      const instance = await getDb<Dao>(schema, api);
      const entity = await instance.create(
        createDao(test)
      );
      const fromStore = await instance.get(test);
      expect(fromStore).toEqual({
        ...entity,
        flag: 'C'
      });
    });
  });

  describe('#delete', () => {
    it('should return false if item not exists', async () => {
      const test = 'shouldreturnfalseifitemnotexists';
      const instance = await getDb<Dao>(
        createSchema(`jest-database-${test}`)
      );
      const entity = await instance.delete(
        createDao(test)
      );
      expect(entity).toEqual(false);
    });

    it('should return true if item exists', async () => {
      const test = 'shouldreturntrueifitemexists';
      const dao = createDao(test);
      const instance = await getDb<Dao>(
        createSchema(`jest-database-${test}`),
        undefined,
        [dao]
      );
      const entity = await instance.delete(dao);
      expect(entity).toEqual(true);
    });

    it('should throw error if key is null', async () => {
      const test = 'shouldthrowerrorifkeyisnull';
      const dao: Dao = {
        id: test,
        key: null!,
        value: 42
      };
      const instance = await getDb<Dao>(
        createSchema(`jest-database-${test}`)
      );
      const entity = await instance.delete(dao);
      expect(entity).toEqual(false);
    });

    it('should return true if item exists and delete remote', async () => {
      const test = 'shouldreturntrueifitemexistsanddeleteremote';
      const dao: Dao = createDao(test);
      const daoApi = new DaoApi();
      await daoApi.create(dao);
      const instance = await getDb<Dao>(
        createSchema(`jest-database-${test}`),
        daoApi,
        [dao]
      );
      const entity = await instance.delete(dao);
      expect(entity).toEqual(true);
    });

    it('should return false if api fails', async () => {
      const test = 'shouldreturntrueifitemexistsanddeleteremote';
      const dao: Dao = createDao(test);
      const instance = await getDb<Dao>(
        createSchema(`jest-database-${test}`),
        new DaoApi(),
        [dao]
      );
      const entity = await instance.delete(dao);
      expect(entity).toEqual(false);
    });
  });

  /*
  describe('#get', () => {

  });

  describe('#getAll', () => {

  });

  describe('#update', () => {

  });

  describe('#sync', () => {

  });
   */
});

function randomString(): string {
  return (Math.random() * 1_000_000).toString(16);
}

function createDao(prefix: string): Dao {
  return {
    id: prefix,
    key: `key_${prefix}`,
    value: 42
  };
}

function createSchema(dbName: string): StoreSchema {
  return {
    ...DAO_SCHEMA,
    dbName
  };
}
