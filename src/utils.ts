import { StoreSchema } from "./models";
import { CheckApiOnline } from "./database";

export function isNotDeleted<T>({ flag }: T & {flag: string}): boolean {
  return flag !== 'D';
}

export function minVersionInDatabase(schemas: StoreSchema[], dbName: string): number {
  return schemas.filter((schema) => schema.dbName === dbName).length;
}

export function isOnlineSupport(object: any): object is CheckApiOnline {
  return object.isOnline;
}
