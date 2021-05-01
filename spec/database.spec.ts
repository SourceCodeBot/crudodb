import { Database } from '../src/database';
import { CrudApi, StoreSchema, CheckApi } from '../src';
import { BASE_SCHEMA, randomString, unload } from './helper';
import { createDao, Dao, DaoApi, DaoApiWithApiState } from './dao';

require('fake-indexeddb/auto');

describe('#database', () => {
  console.debug = jest.fn();
  console.error = jest.fn();
  console.info = jest.fn();
  console.time = jest.fn();
  console.timeEnd = jest.fn();

  afterEach(async () => {
    await unload('jest-database');
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

        [
          { name: 'flag' },
          ...indices
        ].forEach(({ name, keyPath: kP, unique }) =>
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

  function getDb<T>(
    schema: StoreSchema,
    api?: CrudApi<T>,
    initialLoad?: T[]
  ): Promise<Database<T>> {
    return initialize(schema)
      .then(store => {
        if (initialLoad) {
          const forLoad = store.transaction.db
            .transaction(store.name, 'readwrite')
            .objectStore(store.name);
          initialLoad.forEach(item =>
            forLoad.add({
              ...item,
              flag: ''
            })
          );
        }
        return new Database<T>(store, randomString(), schema, api);
      })
      .catch(err => {
        console.error({ err });
        fail('initialize failed');
      });
  }

  describe('#objectStore', () => {
    it('should work if store changed', async () => {
      const test = 'shouldworkifstorechanged';
      const schema = createSchema(`jest-database-${test}`);
      const instance = await getDb<Dao>(schema);
      const entity = await instance.create(createDao(test));
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
      const entity = await instance.create(createDao(test));
      expect(await instance.get(test)).toEqual(entity);
    });
  });

  describe('#create', () => {
    it('should create only local item', async () => {
      const test = 'shouldcreateonlylocalitem';
      const instance = await getDb<Dao>(createSchema(`jest-database-${test}`));
      const entity = await instance.create(createDao(test));
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
      const instance = await getDb<Dao>(createSchema(`jest-database-${test}`));
      const dao: ExtDao = {
        ...createDao(test),
        notIndexedDaoKey: 'helloWorld'
      };
      const entity = await instance.create(dao);
      const fromStore = await instance.get(test);
      expect(fromStore).toEqual({
        ...entity,
        flag: 'C'
      });
      expect(fromStore).not.toHaveProperty('notIndexedDaoKey');
    });

    it('should not create local item', async () => {
      const test = 'shouldnotcreatelocalitem';
      const instance = await getDb<Dao>(createSchema(`jest-database-${test}`));
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
      const entity = await instance.create(createDao(test));
      const fromStore = await instance.get(test);
      expect(fromStore).toEqual({
        ...entity,
        flag: ''
      });
    });

    it('should create only local item if api fails', async () => {
      const test = 'shouldcreateonlylocalitemifapifails';
      const api: Partial<CrudApi<Dao>> = {
        create: () => {
          throw new Error('ups');
        }
      };
      const schema = createSchema(`jest-database-${test}`);
      const instance = await getDb<Dao>(schema, api as any);
      const entity = await instance.create(createDao(test));
      const fromStore = await instance.get(test);
      expect(fromStore).toEqual({
        ...entity,
        flag: 'C'
      });
    });

    it('should create only local item if api is offline', async () => {
      const test = 'shouldcreateonlylocalitemifapiisoffline';
      const api: Partial<CrudApi<Dao> & CheckApi> = {
        isOnline: () => Promise.resolve(false)
      };
      const instance = await getDb<Dao>(
        createSchema(`jest-database-${test}`),
        api as any
      );
      const entity = await instance.create(createDao(test));
      const fromStore = await instance.get(test);
      expect(fromStore).toEqual({
        ...entity,
        flag: 'C'
      });
    });

    it('should fail while sync with api', async () => {
      const test = 'shouldfailwhilesyncwithapi';
      const schema = createSchema(`jest-database-${test}`);
      const api: DaoApi = {
        create: () => Promise.reject(new Error('ups'))
      } as any;
      const instance = await getDb<Dao>(schema, api);
      const dao = createDao(test);
      const entity = await instance.create(dao);
      expect(entity).toEqual({
        ...dao,
        flag: 'C'
      });
    });
  });

  describe('#delete', () => {
    it('should return false if item not exists', async () => {
      const test = 'shouldreturnfalseifitemnotexists';
      const instance = await getDb<Dao>(createSchema(`jest-database-${test}`));
      const entity = await instance.delete(createDao(test));
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
      const instance = await getDb<Dao>(createSchema(`jest-database-${test}`));
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
      const test = 'shouldreturnfalseifapifails';
      const dao: Dao = createDao(test);
      const api: Partial<CrudApi<Dao>> = {
        delete: () => Promise.reject(new Error('ups'))
      };
      const instance = await getDb<Dao>(
        createSchema(`jest-database-${test}`),
        api as any,
        [dao]
      );
      const entity = await instance.delete(dao);
      expect(entity).toEqual(false);
    });

    it('should return true if api is offline', async () => {
      const test = 'shouldreturntrueifapiisoffline';
      const dao: Dao = createDao(test);
      const api: Partial<CrudApi<Dao> & CheckApi> = {
        isOnline: () => Promise.resolve(false)
      };
      const instance = await getDb<Dao>(
        createSchema(`jest-database-${test}`),
        api as any,
        [dao]
      );
      const entity = await instance.delete(dao);
      expect(entity).toEqual(true);
    });

    it('should fail local deletion', async () => {
      const test = 'shouldfaillocaldeletion';
      const instance = await getDb<Dao>(createSchema(`jest-database-${test}`));
      const entity = await instance.delete({
        key: `key_${test}`,
        value: 23
      });
      expect(entity).toEqual(false);
    });
  });

  describe('#get', () => {
    it('should return item from local store', async () => {
      const test = 'shouldreturnitemfromlocalstore';
      const dao: Dao = createDao(test);
      const instance = await getDb<Dao>(
        createSchema(`jest-database-${test}`),
        undefined,
        [dao]
      );
      const entity = await instance.get(dao.id);
      expect(entity).toEqual({
        ...dao,
        flag: ''
      });
    });

    it('should return item from api by load it', async () => {
      const test = 'shouldreturnitemfromapibyloadit';
      const dao: Dao = createDao(test);
      const api = new DaoApi();
      await api.create(dao);
      const instance = await getDb<Dao>(
        createSchema(`jest-database-${test}`),
        api
      );
      const entity = await instance.get(dao.id);
      expect(entity).toEqual(dao);
    });

    it('should return no item found local without api', async () => {
      const test = 'shouldreturnnoitemfoundlocalwithoutapi';
      const dao: Dao = createDao(test);
      const instance = await getDb<Dao>(createSchema(`jest-database-${test}`));
      const entity = await instance.get(dao.id);
      expect(entity).toBeUndefined();
    });

    it('should return no item found local with api', async () => {
      const test = 'shouldreturnnoitemfoundlocalwithapi';
      const dao: Dao = createDao(test);
      const instance = await getDb<Dao>(
        createSchema(`jest-database-${test}`),
        new DaoApi()
      );
      try {
        await instance.get(dao.id);
        fail('should not went here');
      } catch (e) {
        expect(e).toEqual('not found');
      }
    });
  });

  describe('#getAll', () => {
    it('should return a list of items from local store', async () => {
      const test = 'shouldreturnalistofitemsfromlocalstore';
      const dao: Dao = createDao(test);
      const instance = await getDb<Dao>(
        createSchema(`jest-database-${test}`),
        undefined,
        [dao]
      );
      const entities = await instance.getAll();
      expect(entities).toEqual([
        {
          ...dao,
          flag: ''
        }
      ]);
    });

    it('should return a list of items from api by load it', async () => {
      const test = 'shouldreturnalistofitemsfromapibyloadit';
      const dao: Dao = createDao(test);
      const api = new DaoApi();
      await api.create(dao);
      const instance = await getDb<Dao>(
        createSchema(`jest-database-${test}`),
        api
      );
      const entities = await instance.getAll();
      expect(entities).toEqual([dao]);
    });

    it('should return empty list from local without api', async () => {
      const test = 'shouldreturnemptylistfromlocalwithoutapi';
      const instance = await getDb<Dao>(createSchema(`jest-database-${test}`));
      const entities = await instance.getAll();
      expect(entities).toHaveLength(0);
    });

    it('should return empty list from local with api', async () => {
      const test = 'shouldreturnemptylistfromlocalwithapi';
      const api = new DaoApi();
      const instance = await getDb<Dao>(
        createSchema(`jest-database-${test}`),
        api
      );
      const entities = await instance.getAll();
      expect(entities).toHaveLength(0);
    });
  });

  describe('#update', () => {
    it('should update only local item', async () => {
      const test = 'shouldupdateonlylocalitem';
      const existing = createDao(test);
      const instance = await getDb<Dao>(
        createSchema(`jest-database-${test}`),
        undefined,
        [existing]
      );
      const updated = {
        ...existing,
        value: 3
      };
      const entity = await instance.update(updated);
      expect(entity).toEqual({
        ...updated,
        flag: 'U'
      });
      expect(entity).not.toEqual(existing);
    });

    it('should update local item, but keep C flag', async () => {
      const test = 'shouldupdatelocalitem,butkeepcflag';
      const existing = createDao(test);
      const instance = await getDb<Dao>(createSchema(`jest-database-${test}`));
      await instance.create(existing);
      const updated = {
        ...existing,
        value: 3
      };
      const entity = await instance.update(updated);
      expect(entity).toEqual({
        ...updated,
        flag: 'C'
      });
      expect(entity).not.toEqual(existing);
    });

    it('should update only local item reduced on indices', async () => {
      const test = 'shouldupdateonlylocalitemreducedonindices';
      const existing = createDao(test);
      const instance = await getDb<Dao>(
        createSchema(`jest-database-${test}`),
        undefined,
        [existing]
      );
      const updated = {
        ...existing,
        value: 2,
        other: 1
      };
      const entity = await instance.update(updated);
      expect(entity).not.toEqual(updated);
      expect(entity).not.toHaveProperty('other');
    });

    it('should not update local item', async () => {
      const test = 'shouldnotupdatelocalitem';
      const instance = await getDb<Dao>(createSchema(`jest-database-${test}`));
      const notExisting = createDao(test);
      const entity = await instance.update(notExisting);
      expect(entity).toBeUndefined();
    });

    it('should update local item and in api', async () => {
      const test = 'shouldupdatelocalitemandinapi';
      const existing = createDao(test);
      const api = new DaoApi();
      await api.create(existing);
      const instance = await getDb<Dao>(
        createSchema(`jest-database-${test}`),
        api,
        [existing]
      );
      const updated = {
        ...existing,
        value: 100
      };
      const entity = await instance.update(updated);
      expect(entity).toEqual({
        ...updated,
        flag: ''
      });
    });

    it('should update only local item if api fails', async () => {
      const test = 'shouldupdateonlylocalitemifapifails';
      const existing = createDao(test);
      const api: Partial<CrudApi<Dao>> = {
        update: () => Promise.reject(new Error('ups'))
      };
      const instance = await getDb<Dao>(
        createSchema(`jest-database-${test}`),
        api as any,
        [existing]
      );
      const updated = {
        ...existing,
        value: 43
      };
      const entity = await instance.update(updated);
      expect(entity).toEqual({
        ...updated,
        flag: 'U'
      });
    });

    it('should update only local item if api is offline', async () => {
      const test = 'shouldupdateonlylocalitemifapiisoffline';
      const existing = createDao(test);
      const api: Partial<CrudApi<Dao> & CheckApi> = {
        update: () => Promise.reject(new Error('ups')),
        isOnline: () => Promise.resolve(false)
      };
      const instance = await getDb<Dao>(
        createSchema(`jest-database-${test}`),
        api as any,
        [existing]
      );
      const updated = {
        ...existing,
        value: 43
      };
      const entity = await instance.update(updated);
      expect(entity).toEqual({
        ...updated,
        flag: 'U'
      });
    });

    it('should fail local update', async () => {
      const test = 'shouldfaillocalupdate';
      const instance = await getDb<Dao>(createSchema(`jest-database-${test}`));
      const updated = {
        key: `key_${test}`,
        value: 42
      };
      const entity = await instance.update(updated);
      expect(entity).toBeUndefined();
    });
  });

  describe('#sync', () => {
    it('should skip if no api available', async () => {
      const test = 'shouldskipifnoapiavailable';
      const instance = await getDb<Dao>(createSchema(`jest-database-${test}`));
      await expect(instance.sync()).resolves;
    });

    it('should skip if api is offline', async () => {
      const test = 'shouldskipifnoapiavailable';
      const api: Partial<CrudApi<Dao> & CheckApi> = {
        isOnline: () => Promise.resolve(false)
      };
      jest.spyOn(api, 'isOnline');
      const instance = await getDb<Dao>(
        createSchema(`jest-database-${test}`),
        api as any
      );
      await instance.sync();
      expect(api.isOnline).toHaveBeenCalledTimes(1);
    });

    it('should sync all elements from api', async () => {
      const test = 'shouldsyncallelementsfromapi';
      const numberOfItems = 5;
      const api = new DaoApi();
      await prepApiWithNItems(test, api, numberOfItems, createDao);
      const instance = await getDb<Dao>(
        createSchema(`jest-database-${test}`),
        api
      );
      await instance.sync();
      const locals = await instance.getAll();
      expect(locals).toHaveLength(numberOfItems);
    });

    it('should sync all elements to api', async () => {
      const test = 'shouldsyncallelementstoapi';
      const api = new DaoApiWithApiState();
      const updateOne = createDao(`${test}-U`);
      await api.create(updateOne);
      const instance = await getDb<Dao>(
        createSchema(`jest-database-${test}`),
        api,
        [updateOne]
      );
      await Promise.all([
        instance.create(createDao(`${test}-1`)),
        instance.create(createDao(`${test}-2`)),
        instance.create(createDao(`${test}-3`)),
        instance.create(createDao(`${test}-4`)),
        instance.create(createDao(`${test}-5`)),
        instance.update(updateOne)
      ]);
      await instance.delete(createDao(`${test}-5`));

      api.setOnline(true);

      await instance.sync();
      const locals = await instance.getAll();
      expect(locals).toHaveLength(5);
    });

    it('should sync offline first against api', async () => {
      const test = 'shouldsyncofflinefirstagainstapi';
      const api = new DaoApiWithApiState();
      const local = createDao(`${test}-should-update-local`);
      const deleteOne = createDao(`${test}-R-L-2`);
      const remote = {
        ...local,
        value: 666
      };
      const existsBoth = [createDao(`${test}-R-L-1`), deleteOne];
      const remoteDoas = [
        createDao(`${test}-R-only-1`),
        createDao(`${test}-R-only-2`)
      ];
      const localOnly = [
        createDao(`${test}-L-only-1`),
        createDao(`${test}-L-only-2`)
      ];
      await Promise.all([...remoteDoas, remote].map(dao => api.create(dao)));
      const instance = await getDb<Dao>(
        createSchema(`jest-database-${test}`),
        api,
        [...existsBoth, local]
      );
      await Promise.all(localOnly.map(item => instance.create(item)));
      await instance.delete(deleteOne);

      api.setOnline(true);

      await instance.sync();

      // remote has new items
      const allLocalItems = await instance.getAll();
      const allRemoteItems = await api.getAll();
      expect(allLocalItems).toHaveLength(5);

      // local has new items
      expect(allRemoteItems).toHaveLength(5);

      // local has items which have to delete remote
      expect(
        allLocalItems.find(({ id }) => deleteOne.id === id)
      ).toBeUndefined();
      expect(
        allRemoteItems.find(({ id }) => deleteOne.id === id)
      ).toBeUndefined();

      // remote has items which should updated local
      const shouldLocal666 = await instance.get(remote.id);
      expect(shouldLocal666).toHaveProperty('value', 666);
    });
  });
});

function createSchema(dbName: string): StoreSchema {
  return {
    ...BASE_SCHEMA,
    dbName
  };
}

function prepApiWithNItems<T>(
  testName: string,
  api: CrudApi<T>,
  numberOfItems: number,
  factory: (name: string) => T
): Promise<void> {
  const items = new Array(numberOfItems)
    .fill(1)
    .map((_, index) => factory(`${testName}-${index + 1}`));
  return Promise.all(items.map(item => api.create(item))).then(() => {});
}
