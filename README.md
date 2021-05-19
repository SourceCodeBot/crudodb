# CrudoDb

[![npm version](https://badgen.net/npm/v/crudodb)](https://badge.fury.io/js/crudodb) [![npm downloads](https://badgen.net/npm/dt/crudodb)](https://badgen.net/npm/dt/crudodb)


Offline-first IndexedDb wrapper written in TypeScript, which is able to sync with backend services by passing optional service implementation.

## What reason exists for CrudoDb?

CrudoDb allows you to write offline-first webapps without any backend implementation.

In agile Projects, you can implement a PoC without any depend to the backend team.

A small and good tested implementation against fakeindexeddb and (at the moment) local developer tested solution.

Indexeddb internal dbVersion will only incremented if necessary.

## Quick greenfield example

```typescript

const instance = await CrudoDb.setup();

const schema: StoreSchema = {dbVersion:1,dbName:'test', indices: [{name:'a'},{name:'b'}]};

const dao = await instance.applySchema({schema});

const entity = await dao.create({a: '42', b:'666'});
```

## Recommendations

read in [documentation](docs) for angular and react recommendations.


## The Latest Test Coverage (local)

from 2021-05-06

-----------------|---------|----------|---------|---------|----------------------------
File             | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-----------------|---------|----------|---------|---------|----------------------------
All files        |   93.29 |     87.5 |   91.45 |   94.62 |
crudodb.ts       |   94.62 |    73.33 |     100 |   94.44 | 94-99,150,213
database.ts      |   93.49 |    95.06 |   88.52 |   95.48 | 54,174,337-338,342-346,358
index.ts         |     100 |      100 |      50 |     100 |
store-api.ts     |     100 |      100 |     100 |     100 |
store-schema.ts  |     100 |      100 |     100 |     100 |
utils.ts         |   89.39 |    81.82 |   90.91 |   91.53 | 29,54-58,71
-----------------|---------|----------|---------|---------|----------------------------
