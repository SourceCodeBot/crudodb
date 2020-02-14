"use strict";
exports.__esModule = true;
function isNotDeleted(_a) {
    var flag = _a.flag;
    return flag !== 'D';
}
exports.isNotDeleted = isNotDeleted;
function minVersionInDatabase(schemas, dbName) {
    return schemas.filter(function (schema) { return schema.dbName === dbName; }).length;
}
exports.minVersionInDatabase = minVersionInDatabase;
function isOnlineSupport(object) {
    return object.isOnline;
}
exports.isOnlineSupport = isOnlineSupport;
