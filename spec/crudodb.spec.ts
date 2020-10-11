import { CrudoDb, StoreSchema } from '../src';

require('fake-indexeddb/auto');

describe('#crudoDb', () => {
  console.debug = jest.fn();
  // console.log = jest.fn();
  console.time = jest.fn();
  console.timeEnd = jest.fn();

  async function initInstance(): Promise<CrudoDb> {
    return CrudoDb.setup(true);
  }

  async function getStore(
    dbName: string,
    name: string
  ): Promise<IDBObjectStore> {
    return new Promise((resolve, reject) => {
      const db = indexedDB.open(dbName);
      db.onupgradeneeded = reject;
      db.onblocked = reject;
      db.onerror = reject;
      db.onsuccess = () =>
        resolve(db.result.transaction(name, 'readonly').objectStore(name));
    });
  }

  it('should build general store', async () => {
    await initInstance();
    const store = await getStore('crudodb', 'stores');
    expect(store).toBeTruthy();
    const req = await new Promise((resolve, reject) => {
      const r = store.getAll();
      r.onerror = reject;
      r.onsuccess = () => resolve(r.result);
    });
    expect(req).toHaveLength(0);
  });

  it('should register an schema', async () => {
    const schema: StoreSchema = {
      dbName: 'jest',
      store: 'sbgs',
      dbVersion: 1,
      onUpgradeNeeded: () => fail('should not upgrade needed'),
      indices: [{ name: 'key', unique: true }, { name: 'value' }]
    };
    const instance = await initInstance();
    const schemaKey = await instance.registerSchema({ schema });

    expect(schemaKey).toEqual('custom_schema:jest:sbgs');

    const store = await getStore('crudodb', 'stores');
    expect(await getStore('jest', 'sbgs')).toBeTruthy();
    const req = await new Promise((resolve, reject) => {
      const r = store.getAll();
      r.onerror = reject;
      r.onsuccess = () => resolve(r.result);
    });
    expect(req).toHaveLength(1);
  });
});
