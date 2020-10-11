import {
  createMapOfDbNameAndVersion,
  detectVersionForDatabase,
  execDatabase,
  generateTempKey,
  getSchemaStatusInDatabase,
  isDeleted,
  isOnlineSupport
} from '../src/utils';
import { Database } from '../src/database';
import { StoreSchema } from '../src';
import { flushPromises } from './flush-promises';

jest.useFakeTimers();

const schema: StoreSchema = {
  store: 'a',
  indices: [],
  dbName: 'db',
  dbVersion: 1
};

describe('#isDeleted', () => {
  it('should return true for deleted flag', () => {
    expect(isDeleted({ flag: 'D' })).toEqual(true);
  });

  it('should return false for anything else', () => {
    expect(isDeleted({ flag: 'A' })).toEqual(false);
  });

  it('should return false for undefined or null', () => {
    expect(isDeleted({})).toEqual(false);
  });
});

describe('#detectVersionForDatabase', () => {
  it('should return 1 as default', () => {
    expect(detectVersionForDatabase([], '')).toEqual(1);
  });

  it('should return 10 for database', () => {
    expect(
      detectVersionForDatabase(
        [{ dbVersion: 10, dbName: 'schema', indices: [], store: 'a' }],
        'schema'
      )
    ).toEqual(10);
  });

  it('should return highest version for database', () => {
    expect(
      detectVersionForDatabase(
        [
          { dbVersion: 1, dbName: 'schema', indices: [], store: 'a' },
          { dbVersion: 5, dbName: 'schema', indices: [], store: 'a' },
          { dbVersion: 10, dbName: 'schema', indices: [], store: 'a' }
        ],
        'schema'
      )
    ).toEqual(10);
  });
});

describe('#isOnlineSupport', () => {
  it('should have isOnline support', () => {
    expect(isOnlineSupport({ isOnline: () => Promise.resolve(true) })).toEqual(
      true
    );
  });

  it('should have no support for isOnline', () => {
    expect(isOnlineSupport({})).toEqual(false);
  });
});

describe('#execDatabase', () => {
  it('should execute callback', async () => {
    const callback = jest.fn();
    const db = new Database({} as any, 'key', schema);
    await execDatabase('key', db, callback);
    await flushPromises();
    expect(callback).toHaveBeenCalledWith(db);
  });

  it('should not execute callback', async () => {
    const callback = jest.fn();
    let result: any = null;
    try {
      result = await execDatabase('key', undefined, callback);
    } catch (e) {
      result = e;
    }
    await flushPromises();
    expect(callback).not.toHaveBeenCalled();
    expect(result).toEqual('key does not exists');
  });
});

describe('#generateTempKey', () => {
  it('should generate schema key', () => {
    expect(generateTempKey(schema)).toEqual('custom_schema:db:a');
  });
});

describe('#createMapOfDbNameAndVersion', () => {
  it('should create map for schemas', () => {
    const schemas: StoreSchema[] = [
      { dbVersion: 1, dbName: 'b', store: 'x', indices: [] },
      { dbVersion: 2, dbName: 'b', store: 'z', indices: [] },
      { dbVersion: 2, dbName: 'c', store: 'y', indices: [] }
    ];
    expect(createMapOfDbNameAndVersion(schemas)).toMatchObject({
      b: 2,
      c: 2
    });
  });

  it('should create empty map for empty array', () => {
    const schemas: StoreSchema[] = [];
    expect(createMapOfDbNameAndVersion(schemas)).toMatchObject({});
  });
});

describe('#prepareStoreAndOpenTransactionWithDatabase', () => {
  it('fail - tbd', () => {
    fail('please write awesome high coverage tests for me!');
  });
});

describe('#initGeneralDb', () => {
  it('should build database with', () => {
    fail('please write awesome high coverage tests for me!');
  });
});

describe('#getSchemaStatusInDatabase', () => {
  it('should return ready for', () => {
    expect(getSchemaStatusInDatabase(schema, schema)).toEqual('ready');
  });

  it('should return upgrade for', () => {
    expect(
      getSchemaStatusInDatabase(schema, {
        ...schema,
        dbVersion: 42
      })
    ).toEqual('upgrade');
  });

  it('should return initial for', () => {
    expect(getSchemaStatusInDatabase(schema)).toEqual('initial');
  });
});
