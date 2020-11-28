const rubico = require('rubico')
const rubicoX = require('rubico/x')
const crypto = require('crypto')
const DynamoDB = require('aws-sdk/clients/dynamodb')
const Dynamo = require('./Dynamo')
const isPromise = require('./internal/isPromise')
const hashJSON = require('./internal/hashJSON')
const stringifyJSON = require('./internal/stringifyJSON')
const join = require('./internal/join')

const {
  pipe, tap,
  switchCase, tryCatch,
  fork, assign, get, pick, omit,
  map, filter, reduce, transform, flatMap,
  and, or, not, any, all,
  eq, gt, lt, gte, lte,
  thunkify, always,
  curry, __,
} = rubico

const {
  values,
} = rubicoX

/**
 * @name DynamoTable
 *
 * @synopsis
 * ```coffeescript [specscript]
 * DynamoTable(table string, options {
 *   key: [
 *     { [hashKey string]: 'S'|'string'|'N'|'number'|'B'|'binary' },
 *     { [sortKey string]: 'S'|'string'|'N'|'number'|'B'|'binary' },
 *   ],
 *   accessKeyId: string,
 *   secretAccessKey: string,
 *   region: string,
 *   endpoint: string,
 * })
 * ```
 *
 * @description
 * Creates a DynamoDB table. [aws-sdk DynamoDB](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/DynamoDB.html)
 *
 * ```javascript
 * DynamoTable('http://localhost:8000/', 'my-local-table') // -> DynamoTable
 *
 * DynamoTable({
 *   accessKeyId: 'my-access-key-id',
 *   secretAccessKey: 'my-secret-access-key',
 *   region: 'my-region',
 * }, 'my-aws-table') // -> DynamoTable
 * ```
 */
const DynamoTable = function (table, options) {
  if (this == null || this.constructor != DynamoTable) {
    return new DynamoTable(table, options)
  }
  this.table = table
  this.connection = options.endpoint
    ? new Dynamo(options.endpoint).connection
    : new Dynamo(pick([
      'accessKeyId', 'secretAccessKey', 'region',
    ])(options)).connection
  return this
}

/**
 * @name DynamoTable.prototype.putItem
 *
 * @synopsis
 * ```coffeescript [specscript]
 * DynamoTable(connection string|object, table string).putItem(
 *   item Object,
 *   options? {
 *     returnConsumedCapacity?: 'INDEXES'|'TOTAL'|'NONE',
 *     returnItemCollectionMetrics?: 'SIZE'|'NONE',
 *     returnValues?: 'NONE'|'ALL_OLD',
 *   }, // TODO finish these options
 * )
 * ```
 *
 * @description
 * `AWS.DynamoDB.prototype.putItem` for JavaScript Objects. [aws-sdk DynamoDB putItem](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/DynamoDB.html#putItem-property)
 *
 * ```javascript
 * const localUsersTable = DynamoTable('http://localhost:8000/', 'my-local-table')
 *
 * await localUsersTable.ready
 *
 * await localUsersTable.putItem({ _id: '1', name: 'Geor' })
 * ```
 */
DynamoTable.prototype.putItem = function putItem(item, options) {
  return this.connection.putItem({
    TableName: this.table,
    Item: map(Dynamo.AttributeValue)(item),
    ...options,
  }).promise()
}

/**
 * @name DynamoTable.prototype.getItem
 *
 * @synopsis
 * ```coffeescript [specscript]
 * DynamoTable(dynamo).getItem(key Object) -> Promise<{ Item: DynamoAttributeValue }>
 * ```
 */
DynamoTable.prototype.getItem = function getItem(key) {
  return this.connection.getItem({
    TableName: this.table,
    Key: map(Dynamo.AttributeValue)(key),
  }).promise().then(tap(result => {
    if (result.Item == null) {
      throw new Error(`Item not found for ${stringifyJSON(key)}`)
    }
  }))
}

/**
 * @name DynamoTable.prototype.updateItem
 *
 * @synopsis
 * ```coffeescript [specscript]
 * DynamoTable(connection string|object, table string).updateItem(
 *   key Object,
 *   updates Object,
 *   options? {
 *     ReturnConsumedCapacity?: 'INDEXES'|'TOTAL'|'NONE',
 *     ReturnItemCollectionMetrics?: 'SIZE'|'NONE',
 *     ReturnValues?: 'NONE'|'ALL_OLD'|'UPDATED_OLD'|'ALL_NEW'|'UPDATED_NEW',
 *   },
 * )
 * ```
 *
 * @description
 * `AWS.DynamoDB.prototype.updateItem` for JavaScript Objects. [aws-sdk DynamoDB updateItem](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/DynamoDB.html#updateItem-property)
 *
 * ```javascript
 * const localUsersTable = DynamoTable('http://localhost:8000/', 'my-local-table')
 *
 * await localUsersTable.ready
 *
 * await localUsersTable.updateItem({ _id: '1' }, {
 *   name: 'George',
 *   height: 180,
 *   heightUnits: 'cm',
 * })
 * ```
 */
DynamoTable.prototype.updateItem = function updateItem(key, updates, options) {
  return this.connection.updateItem({
    TableName: this.table,
    Key: map(Dynamo.AttributeValue)(key),
    UpdateExpression: pipe([
      Object.entries,
      map(([key, value]) => [`#${hashJSON(key)} = :${hashJSON(value)}`]),
      join(', '),
      expression => `set ${expression}`,
    ])(updates),
    ExpressionAttributeNames: map.entries(
      ([key, value]) => [`#${hashJSON(key)}`, key],
    )(updates),
    ExpressionAttributeValues: map.entries(
      ([key, value]) => [`:${hashJSON(value)}`, Dynamo.AttributeValue(value)],
    )(updates),
    ...options,
  }).promise()
}

/**
 * @name DynamoTable.prototype.deleteItem
 *
 * @synopsis
 * ```coffeescript [specscript]
 * DynamoTable(connection, table).deleteItem(
 *   key Object,
 *   options? {
 *     ReturnConsumedCapacity?: 'INDEXES'|'TOTAL'|'NONE',
 *     ReturnItemCollectionMetrics?: 'SIZE'|'NONE',
 *     ReturnValues?: 'NONE'|'ALL_OLD',
 *   },
 * ) -> Promise<{ Item: Object<DynamoAttributeValue> }>
 * ```
 */
DynamoTable.prototype.deleteItem = function deleteItem(key, options) {
  return this.connection.deleteItem({
    TableName: this.table,
    Key: map(Dynamo.AttributeValue)(key),
    ...options,
  }).promise()
}

module.exports = DynamoTable
