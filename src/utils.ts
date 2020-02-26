import { StoreSchema } from "./store-schema";
import {CheckApi} from "./check-api";

export function isDeleted<T>({ flag }: T & {flag: string}): boolean {
  return flag === 'D';
}

export function minVersionInDatabase(schemas: StoreSchema[], dbName: string): number {
  return schemas.filter((schema) => schema.dbName === dbName).length;
}

export function isOnlineSupport(object: any): object is CheckApi {
  return object.isOnline;
}
