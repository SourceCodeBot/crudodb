"use strict";
var __assign = (this && this.__assign) || Object.assign || function(t) {
    for (var s, i = 1, n = arguments.length; i < n; i++) {
        s = arguments[i];
        for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
            t[p] = s[p];
    }
    return t;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
var rxjs_1 = require("rxjs");
var operators_1 = require("rxjs/operators");
var utils_1 = require("./utils");
var Database = /** @class */ (function () {
    function Database(key, schema, api) {
        var _this = this;
        this.key = key;
        this.schema = schema;
        this.api = api;
        this.onInit = new rxjs_1.Subject();
        this.initialized$ = this.onInit.asObservable()
            .pipe(operators_1.shareReplay(1));
        this.init()
            .then(function (db) { return (_this.store = db); })
            .then(function () { return (_this.onInit.next(_this.store != null)); })["catch"](function (err) {
            return console.error('error occurred while init database', err);
        });
    }
    Object.defineProperty(Database.prototype, "store", {
        get: function () {
            return this._store;
        },
        set: function (db) {
            this._store = db;
        },
        enumerable: true,
        configurable: true
    });
    Database.prototype.awaitInitialized = function () {
        return this.initialized$.pipe(operators_1.take(1)).toPromise();
    };
    Database.prototype.init = function () {
        var _this = this;
        return new Promise(function (resolve, reject) {
            var _a = _this.schema, dbName = _a.dbName, dbVersion = _a.dbVersion;
            var request = indexedDB.open(dbName, dbVersion);
            request.onsuccess = function (evt) { return resolve(evt.result); };
            request.onerror = function (evt) { return reject(evt); };
            request.onupgradeneeded = function (evt) { return _this.onUpgradeNeeded(evt, _this.schema); };
        });
    };
    Database.prototype.onUpgradeNeeded = function (evt, schema) {
        return __awaiter(this, void 0, void 0, function () {
            var db, store, _a, keyPath, indices, objectStore_1;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        db = evt.result;
                        if (!(evt.oldVersion < 1)) return [3 /*break*/, 1];
                        store = schema.store, _a = schema.keyPath, keyPath = _a === void 0 ? 'id' : _a, indices = schema.indices;
                        objectStore_1 = db.createObjectStore(store, { keyPath: keyPath });
                        indices.forEach(function (_a) {
                            var name = _a.name, _b = _a.keyPath, keyPath = _b === void 0 ? name : _b, _c = _a.unique, unique = _c === void 0 ? false : _c;
                            return objectStore_1.createIndex(name, keyPath, { unique: unique });
                        });
                        objectStore_1.createIndex('flag', 'flag', { unique: false });
                        return [2 /*return*/, true];
                    case 1:
                        if (!!!schema.onUpgradeNeeded) return [3 /*break*/, 3];
                        return [4 /*yield*/, schema.onUpgradeNeeded(db, evt)];
                    case 2: return [2 /*return*/, _b.sent()];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    Database.prototype.sync = function () {
        return __awaiter(this, void 0, void 0, function () {
            var db, store, request;
            var _this = this;
            return __generator(this, function (_a) {
                db = this.store;
                store = this.schema.store;
                request = db
                    .transaction([store], 'readwrite')
                    .objectStore(store)
                    .index('flag')
                    .getAll();
                request.onerror = function (evt) { return console.error("can't sync " + buildEntityIdent(_this.schema), evt); };
                request.onsuccess = function () { return __awaiter(_this, void 0, void 0, function () {
                    var isOnline, _a;
                    var _this = this;
                    return __generator(this, function (_b) {
                        switch (_b.label) {
                            case 0: return [4 /*yield*/, Promise.all(request.result.map(function (item) { return __awaiter(_this, void 0, void 0, function () {
                                    var _a;
                                    var _this = this;
                                    return __generator(this, function (_b) {
                                        switch (_b.label) {
                                            case 0:
                                                _a = item.flag;
                                                switch (_a) {
                                                    case 'D': return [3 /*break*/, 1];
                                                    case 'C': return [3 /*break*/, 3];
                                                    case 'U': return [3 /*break*/, 5];
                                                }
                                                return [3 /*break*/, 7];
                                            case 1: return [4 /*yield*/, this.getId(item, function (id) { return _this.deleteRemote(id, item); })];
                                            case 2:
                                                _b.sent();
                                                return [3 /*break*/, 8];
                                            case 3: return [4 /*yield*/, this.createRemote(item)];
                                            case 4:
                                                _b.sent();
                                                return [3 /*break*/, 8];
                                            case 5: return [4 /*yield*/, this.updateRemote(item)];
                                            case 6:
                                                _b.sent();
                                                return [3 /*break*/, 8];
                                            case 7:
                                                console.warn('undefined flag', item.flag);
                                                _b.label = 8;
                                            case 8: return [2 /*return*/];
                                        }
                                    });
                                }); }))];
                            case 1:
                                _b.sent();
                                if (!utils_1.isOnlineSupport(this.api)) return [3 /*break*/, 3];
                                return [4 /*yield*/, this.api.isOnline()];
                            case 2:
                                _a = _b.sent();
                                return [3 /*break*/, 4];
                            case 3:
                                _a = undefined;
                                _b.label = 4;
                            case 4:
                                isOnline = _a;
                                if (!(isOnline === undefined || isOnline)) return [3 /*break*/, 6];
                                return [4 /*yield*/, this.api.gets()
                                        .then(function (fromRemote) { return _this.updateLocalStorage(fromRemote); })["catch"](function (err) { return console.error(_this.key + " sync failed with api", err); })];
                            case 5:
                                _b.sent();
                                _b.label = 6;
                            case 6: return [2 /*return*/];
                        }
                    });
                }); };
                return [2 /*return*/];
            });
        });
    };
    Database.prototype.get = function (id) {
        var store = this.schema.store;
        var request = this.store
            .transaction([store], 'readonly')
            .objectStore(store)
            .index('flag')
            .get(id);
        return new Promise(function (resolve, reject) {
            request.onerror = function (err) { return reject(err); };
            request.onsuccess = function () { return resolve(utils_1.isNotDeleted(request.result) ? request.result : undefined); };
        });
    };
    Database.prototype.getAll = function () {
        var store = this.schema.store;
        var request = this.store
            .transaction([store], 'readonly')
            .objectStore(store)
            .getAll();
        return new Promise(function (resolve, reject) {
            request.onsuccess = function () { return resolve(request.result.filter(utils_1.isNotDeleted)); };
            request.onerror = function (err) { return reject(err); };
        });
    };
    /**
     * create entity in storage
     * @param item
     */
    Database.prototype.create = function (item) {
        var _this = this;
        return this.createLocal(item).then(function () {
            return _this.createRemote(item);
        });
    };
    /**
     * update existing entity in storage
     * @param item
     */
    Database.prototype.update = function (item) {
        var _this = this;
        return this.updateLocal(item)
            .then(function () { return _this.updateRemote(item); });
    };
    /**
     * delete given entity in local and optional remote storage
     * @param item
     */
    Database.prototype["delete"] = function (item) {
        var _this = this;
        return this.getId(item, function (id) { return _this.deleteLocal(id, item)
            .then(function () { return _this.deleteRemote(id, item); }); })["catch"](function () { return false; });
    };
    /*****************************
     *                           *
     *     INTERNAL SECTION      *
     *                           *
     *****************************/
    Database.prototype.updateLocalStorage = function (fromRemote) {
        return __awaiter(this, void 0, void 0, function () {
            var fromLocal, _a, keyPath, localIds, remoteIds, createLocal, deleteLocal, updateLocal;
            var _this = this;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, this.getAll()];
                    case 1:
                        fromLocal = _b.sent();
                        _a = this.schema.keyPath, keyPath = _a === void 0 ? 'id' : _a;
                        localIds = extractIdsList(fromLocal, keyPath);
                        remoteIds = extractIdsList(fromRemote, keyPath);
                        createLocal = fromRemote.filter(function (item) { return !localIds.includes(item[keyPath]); });
                        deleteLocal = fromLocal.filter(function (item) { return !remoteIds.includes(item[keyPath]); });
                        updateLocal = fromLocal.filter(function (item) { return !deleteLocal.includes(item); });
                        createLocal.forEach(function (item) { return _this.createLocal(item, false)["catch"](function (err) { return logInfo(item, err); }); });
                        deleteLocal.forEach(function (item) { return _this.getId(item, function (id) { return _this.deleteLocal(id, item, false); })["catch"](function (err) { return logInfo(item, err); }); });
                        updateLocal.forEach(function (item) { return _this.updateLocal(item, false)["catch"](function (err) { return logInfo(item, err); }); });
                        return [2 /*return*/];
                }
            });
        });
    };
    Database.prototype.createLocal = function (item, addFlag) {
        if (addFlag === void 0) { addFlag = true; }
        return __awaiter(this, void 0, void 0, function () {
            var localItem;
            return __generator(this, function (_a) {
                localItem = __assign({}, item, { flag: addFlag ? 'C' : undefined });
                return [2 /*return*/, this.updateInternalEntry(localItem, 'create', function (store) { return store.add(localItem); })];
            });
        });
    };
    Database.prototype.createRemote = function (item) {
        return __awaiter(this, void 0, void 0, function () {
            var isOnline, _a;
            var _this = this;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!this.api) {
                            return [2 /*return*/, item];
                        }
                        if (!utils_1.isOnlineSupport(this.api)) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.api.isOnline()];
                    case 1:
                        _a = _b.sent();
                        return [3 /*break*/, 3];
                    case 2:
                        _a = undefined;
                        _b.label = 3;
                    case 3:
                        isOnline = _a;
                        if (isOnline === undefined || isOnline) {
                            return [2 /*return*/, this.api.create(item).then(function (result) { return __awaiter(_this, void 0, void 0, function () {
                                    var deleted;
                                    var _this = this;
                                    return __generator(this, function (_a) {
                                        switch (_a.label) {
                                            case 0: return [4 /*yield*/, this.getId(item, function (id) { return _this.deleteLocal(id, item); })["catch"](function () { return false; })];
                                            case 1:
                                                deleted = _a.sent();
                                                return [2 /*return*/, deleted && this.createLocal(result, false)];
                                        }
                                    });
                                }); })["catch"](function (err) {
                                    console.error("can't call create of api " + buildEntityIdent(_this.schema), err);
                                    return item;
                                })];
                        }
                        return [2 /*return*/, item];
                }
            });
        });
    };
    Database.prototype.updateLocal = function (item, addFlag) {
        if (addFlag === void 0) { addFlag = true; }
        var localItem = __assign({}, item, { flag: addFlag ? 'U' : undefined });
        return this.updateInternalEntry(localItem, 'update', function (store) { return store.put(item); });
    };
    Database.prototype.updateRemote = function (item) {
        return __awaiter(this, void 0, void 0, function () {
            var isOnline, _a;
            var _this = this;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!this.api) {
                            return [2 /*return*/, item];
                        }
                        if (!utils_1.isOnlineSupport(this.api)) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.api.isOnline()];
                    case 1:
                        _a = _b.sent();
                        return [3 /*break*/, 3];
                    case 2:
                        _a = undefined;
                        _b.label = 3;
                    case 3:
                        isOnline = _a;
                        if (isOnline === undefined || isOnline) {
                            return [2 /*return*/, this.api.update(item).then(function (result) { return __awaiter(_this, void 0, void 0, function () {
                                    var deleted;
                                    var _this = this;
                                    return __generator(this, function (_a) {
                                        switch (_a.label) {
                                            case 0: return [4 /*yield*/, this.getId(item, function (id) { return _this.deleteLocal(id, item); })["catch"](function () { return false; })];
                                            case 1:
                                                deleted = _a.sent();
                                                return [2 /*return*/, deleted && this.createLocal(result, false)];
                                        }
                                    });
                                }); })["catch"](function (err) {
                                    console.error("can't call update of api " + buildEntityIdent(_this.schema), err);
                                    return item;
                                })];
                        }
                        return [2 /*return*/, item];
                }
            });
        });
    };
    Database.prototype.deleteLocal = function (id, item, addFlag) {
        if (addFlag === void 0) { addFlag = true; }
        if (!addFlag) {
            return this.updateInternalEntry(item, 'delete', function (store) { return store["delete"](id); })
                .then(function () { return true; })["catch"](function () { return false; });
        }
        var localItem = __assign({}, item, { flag: 'D' });
        return this.updateInternalEntry(localItem, 'delete', function (store) { return store.put(localItem); })
            .then(function (result) { return result === undefined; });
    };
    Database.prototype.updateInternalEntry = function (localItem, routine, storeRoutine) {
        var store = this.schema.store;
        var request = storeRoutine(this.store
            .transaction([store], 'readwrite')
            .objectStore(store));
        return handleRequest(request, localItem)["catch"](function (err) {
            console.error("cant " + routine + " local entry", err);
            return localItem;
        });
    };
    Database.prototype.deleteRemote = function (id, item) {
        return __awaiter(this, void 0, void 0, function () {
            var isOnline, _a;
            var _this = this;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!this.api) {
                            return [2 /*return*/, false];
                        }
                        if (!utils_1.isOnlineSupport(this.api)) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.api.isOnline()];
                    case 1:
                        _a = _b.sent();
                        return [3 /*break*/, 3];
                    case 2:
                        _a = undefined;
                        _b.label = 3;
                    case 3:
                        isOnline = _a;
                        if (isOnline === undefined || isOnline) {
                            return [2 /*return*/, this.api["delete"](item).then(function (deleted) { return __awaiter(_this, void 0, void 0, function () {
                                    var _a;
                                    return __generator(this, function (_b) {
                                        switch (_b.label) {
                                            case 0:
                                                _a = deleted;
                                                if (!_a) return [3 /*break*/, 2];
                                                return [4 /*yield*/, this.deleteLocal(id, item, false)];
                                            case 1:
                                                _a = (_b.sent());
                                                _b.label = 2;
                                            case 2: return [2 /*return*/, _a];
                                        }
                                    });
                                }); })["catch"](function (err) {
                                    console.error("can't call delete of api " + buildEntityIdent(_this.schema), err);
                                    return false;
                                })];
                        }
                        return [2 /*return*/, true];
                }
            });
        });
    };
    Database.prototype.getId = function (item, callback) {
        var _a = this.schema.keyPath, keyPath = _a === void 0 ? 'id' : _a;
        if (!item.hasOwnProperty(keyPath)) {
            return Promise.reject();
        }
        var id = item[keyPath];
        return callback(id);
    };
    return Database;
}());
exports.Database = Database;
function buildEntityIdent(_a) {
    var dbName = _a.dbName, store = _a.store;
    return dbName + ":" + store;
}
function handleRequest(request, item) {
    return new Promise(function (resolve) {
        try {
            request.onsuccess = function () {
                resolve(item);
            };
            request.onerror = function (evt) {
                console.error('can not handle operation', {
                    evt: evt,
                    item: item
                });
                resolve(undefined);
            };
        }
        catch (error) {
            console.error('can not handle request', {
                item: item,
                error: error
            });
        }
    });
}
function extractIdsList(list, key) {
    return list.map(function (item) { return item[key]; }).filter(function (id) { return id != null; });
}
function logInfo(item, error) {
    console.debug("error while sync", { item: item, error: error });
}
