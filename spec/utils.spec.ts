import { generateTempKey, isDeleted, isOnlineSupport } from '../src/utils';
import { StoreSchema } from '../src';

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

describe('#generateTempKey', () => {
  it('should generate schema key', () => {
    expect(generateTempKey(schema)).toEqual('custom_schema:db:a');
  });
});
