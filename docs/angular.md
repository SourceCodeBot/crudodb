# Angular (rxjs)

recommendation for angular is to use shared root service, which setup the instance.

all consuming services need a schemaKey. To work smooth with it, cache it in a property and optional combine it with the instance from root service.

In all following usages, you have to pipe `handle$` to the matching method  

```typescript
import {Injectable} from '@angular/core';
import {combineLatest, Observable} from "rxjs";
import {map, shareReplay, switchMap, tap} from "rxjs/operators";
import {fromPromise} from "rxjs/internal-compatibility";
import {CrudoDb} from "crudodb";

@Injectable({providedIn: 'root'})
export class StoreAccessService {

    public instance$ = fromPromise(CrudoDb.setup)
        .pipe(shareReplay(1));

}

@Injectable({providedIn: 'root'})
export class DaoService {

    private key$ = this.storeAccess.instance$.pipe(
        switchMap((instance) => instance.registerSchema({schema})),
        shareReplay(1)
    );

    private handle$ = combineLatest([this.key$, this.storeAccess.instance$]).pipe(shareReplay(1));

    constructor(private storeAccess: StoreAccessService) {}

    public create(item: Dao): Observable<Dao> {
        return this.handle$.pipe(
            switchMap(([key, instance]) => instance.create(key, item))
        );
    }
}

```
