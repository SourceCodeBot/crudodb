import { CrudoDb } from '../src';
import { StoreApi } from '../src/store-api';

import { createDao, Dao } from './dao';

class CrudoDbMock implements Partial<CrudoDb> {
  public getAll = jest.fn();

  public get = jest.fn();

  public create = jest.fn();

  public delete = jest.fn();

  public update = jest.fn();

  public sync = jest.fn();
}

describe('#storeApi', () => {
  const key = 'schemaKey';

  function init(): { crudoDb: CrudoDbMock; instance: StoreApi<Dao> } {
    const crudoDb = new CrudoDbMock();
    const instance = new StoreApi<Dao>(crudoDb as unknown as CrudoDb, key);
    return {
      crudoDb,
      instance
    };
  }

  describe('#api', () => {
    describe('#getAll', () => {
      it('should receive data from db', async () => {
        const { crudoDb, instance } = init();
        const expected: Dao[] = [createDao('receive')];
        crudoDb.getAll = jest.fn(async k => (k === key ? expected : []));

        const data = await instance.getAll();

        expect(data).toEqual(expected);
      });
    });

    describe('#get', () => {
      it('should receive queried data from db', async () => {
        const { crudoDb, instance } = init();
        const expected: Dao = createDao('query');
        crudoDb.get = jest.fn(async (k, id) =>
          k === key && id === 'query' ? expected : undefined
        );

        const data = await instance.get('query');

        expect(data).toEqual(expected);
      });
    });

    describe('#create', () => {
      it('should create given data in db', async () => {
        const { crudoDb, instance } = init();
        const expected: Dao = createDao('create');
        crudoDb.create = jest.fn(async (k, obj: Dao) =>
          k === key ? obj : undefined
        );

        const data = await instance.create(expected);

        expect(data).toEqual(expected);
      });
    });

    describe('#update', () => {
      it('should update existing data in db', async () => {
        const { crudoDb, instance } = init();
        const expected: Dao = createDao('update');
        crudoDb.update = jest.fn(async (k, obj: Dao) =>
          k === key && obj.id === expected.id ? obj : undefined
        );

        const data = await instance.update(expected);

        expect(data).toEqual(expected);
      });
    });

    describe('#delete', () => {
      it('should delete data from db', async () => {
        const { crudoDb, instance } = init();
        const expected: Dao = createDao('delete');
        const testFn = jest.fn(
          async (k, obj: Dao) => !(k !== key || obj.id !== expected.id)
        );
        crudoDb.delete = testFn;

        await instance.delete(expected);

        expect(testFn).toHaveBeenCalledWith(key, expected);
      });
    });
  });

  describe('#sync', () => {
    it('should trigger sync for itself', async () => {
      const { crudoDb, instance } = init();
      crudoDb.sync = jest.fn(() => Promise.resolve());

      await instance.sync();

      expect(crudoDb.sync).toHaveBeenCalledWith([key]);
    });
  });
});
