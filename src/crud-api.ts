export interface CrudApi<T> {
  /**
   * that function should be able to persist an new entity and return it.
   * otherwise undefined.
   * @note do not throw errors! there is no error handler. separation of concern!
   * @param obj
   */
  create(obj: T): Promise<T | undefined>;

  /**
   * that function should be able to update an existing entity and return it.
   * otherwise undefined.
   * @note do not throw errors! there is no error handler. separation of concern!
   * @param obj
   */
  update(obj: T): Promise<T | undefined>;

  /**
   * that function should be able to remove an existing entity and return successfully or not.
   * @note do not throw errors! there is no error handler. separation of concern!
   * @param obj
   */
  delete(obj: T): Promise<boolean>;

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
