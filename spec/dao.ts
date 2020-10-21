import {CrudApi} from "../src";
import {CheckApi} from "../src/check-api";

export interface Dao {
  id?: string;
  key: string;
  value: unknown;
}

export class DaoApi implements CrudApi<Dao> {
  private storage: Record<string, Dao> = {};

  public delete(obj: Dao): Promise<boolean> {
    if (obj.id && this.storage[obj.id]) {
      delete this.storage[obj.id];
      return Promise.resolve(true);
    }
    return Promise.resolve(false);
  }
  public create(obj: Dao): Promise<Dao | undefined> {
    if (obj.id) {
      this.storage[obj.id] = obj;
      return Promise.resolve(obj);
    }
    return Promise.reject('no id');
  }
  public get(id: string): Promise<Dao | undefined> {
    return this.storage[id]
      ? Promise.resolve(this.storage[id])
      : Promise.reject('not found');
  }
  public getAll(): Promise<Dao[]> {
    return Promise.resolve(Object.values(this.storage));
  }
  public update(obj: Dao): Promise<Dao | undefined> {
    if (!obj.id) {
      return Promise.reject('no id');
    }
    const inner = this.storage[obj.id];
    if (inner) {
      this.storage[obj.id] = obj;
      return Promise.resolve(obj);
    }
    return Promise.reject('not found');
  }
}

export class DaoApiWithApiState extends DaoApi implements CheckApi {

  constructor(public _isOnline: boolean = false) {
    super();
  }

  public setOnline(isOnline: boolean): void {
    this._isOnline = isOnline;
  }

  public isOnline(): Promise<boolean> {
    return Promise.resolve(this._isOnline);
  }
}


export function createDao(prefix: string): Dao {
  return {
    id: prefix,
    key: `key_${prefix}`,
    value: 42
  };
}
