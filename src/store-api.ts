import { CrudApi } from './crud-api';
import { CrudoDb } from './crudodb';

/**
 * StoreApi provide access to database by an CrudoDb instance.
 */
export class StoreApi<T = unknown> implements CrudApi<T> {
  constructor(private db: CrudoDb, private schemaKey: string) {}

  public create(obj: T): Promise<T> {
    return this.db.create(this.schemaKey, obj);
  }

  public async delete(obj: T): Promise<void> {
    await this.db.delete(this.schemaKey, obj);
  }

  public get<K extends keyof T>(id: T[K]): Promise<T | undefined> {
    return this.db.get(this.schemaKey, id);
  }

  public getAll(): Promise<T[]> {
    return this.db.getAll(this.schemaKey);
  }

  public update(obj: T): Promise<T> {
    return this.db.update(this.schemaKey, obj);
  }

  /**
   * call this method to hold local database sync with given api
   */
  public sync(): Promise<void> {
    return this.db.sync([this.schemaKey]);
  }
}
