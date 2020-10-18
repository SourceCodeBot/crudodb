import {
  execDatabase,
  generateTempKey,
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
    let result: any;
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

describe('#prepareStoreWithDatabase', () => {
  it('fail - tbd', () => {
    fail('please write awesome high coverage tests for me!');
  });
});

describe('#initGeneralDb', () => {
  it('should build database with', () => {
    fail('please write awesome high coverage tests for me!');
  });
});
