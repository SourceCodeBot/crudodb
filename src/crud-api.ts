export interface CrudApi<T> {
  /**
   * that function should be able to persist an new entity and return it.
   * otherwise undefined.
   * @param obj
   */
  create(obj: T): Promise<T>;

  /**
   * that function should be able to update an existing entity and return it.
   * otherwise undefined.
   * @param obj
   */
  update(obj: T): Promise<T>;

  /**
   * that function should be able to remove an existing entity and return successfully or not.
   * @param obj
   */
  delete(obj: T): Promise<void>;

  /**
   * that function should be able to find and return an existing entity or undefined.
   * @note do not throw errors! there is no error handler. separation of concern!
   * @param id
   */
  get<K extends keyof T>(id: T[K]): Promise<T | undefined>;

  /**
   * that function should be able to return a list of all existing entities or an empty array of that type.
   * @note do not throw errors! there is no error handler. separation of concern!
   */
  getAll(): Promise<T[]>;
}
