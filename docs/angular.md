# Angular (rxjs)

recommendation for angular is to use shared root service, which setup the instance.

all consuming services need a StoreApi instance.

```typescript
import {Injectable} from '@angular/core';
import {combineLatest, Observable, from} from 'rxjs';
import {map, shareReplay, switchMap, tap} from 'rxjs/operators';
import {CrudoDb, StoreSchema} from 'crudodb';

@Injectable({providedIn: 'root'})
export class StoreAccessService {

  public instance$ = from(CrudoDb.setup())
    .pipe(shareReplay(1));

}

interface Dao {
  key: string;
  id: number;
}

const schema: StoreSchema = {
  dbName: 'my-database',
  dbVersion: 1,
  store: 'dao',
  indices: [
    { name: 'id', unique: true },
    { name: 'key' }
  ]
};

@Injectable({providedIn: 'root'})
export class DaoService {

  private db$ = this.storeAccess.instance$.pipe(
    switchMap((instance) => instance.applySchema({schema})),
    shareReplay(1)
  );

  constructor(
    private storeAccess: StoreAccessService
  ) {}

  public create(item: Dao): Observable<Dao> {
    return this.db$.pipe(
      switchMap((db) => db.create(item))
    );
  }
}

```
