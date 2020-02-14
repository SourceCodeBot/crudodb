
import { StoreSchema } from "../src/models";
import { Database } from "../src/database";

const a: string = 'a';

describe('#database', () => {

  interface Demo {
    id: number;
    title: string;
    created?: Date;
  }

  it('should initialize', async () => {
    const schema: StoreSchema = {
      store: 'demo',
      dbName: 'jest',
      dbVersion: 1,
      indices: [
        {name: 'title'}
      ],
      keyPath: 'id'
    };
    const db = new Database<Demo>('demo', schema);

    await db.awaitInitialized();
  });

});
