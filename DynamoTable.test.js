const Test = require('thunk-test')
const map = require('rubico/map')
const assert = require('assert')
const Dynamo = require('./Dynamo')
const DynamoTable = require('./DynamoTable')

module.exports = Test('DynamoTable', DynamoTable)
  .before(async function () {
    this.dynamo = Dynamo('http://localhost:8000/')
    await this.dynamo.deleteTable('test-tablename')
  })
  .before(async function () {
    await this.dynamo.createTable('test-tablename', [{ id: 'string' }])
  })

  .case('http://localhost:8000/', 'test-tablename', async function (testTable) {
    await testTable.putItem({ id: '1', name: 'george' })
    assert.deepEqual(
      await testTable.getItem({ id: '1' }),
      { Item: map(Dynamo.toAttributeValue)({ id: '1', name: 'george' }) })
    assert.deepEqual(
      await testTable.putItem({ id: '1', name: 'george' }, {
        ReturnValues: 'ALL_OLD',
        ReturnConsumedCapacity: 'TOTAL',
      }),
      {
        Attributes: map(Dynamo.toAttributeValue)({ id: '1', name: 'george' }),
        ConsumedCapacity: { CapacityUnits: 1, TableName: 'test-tablename' },
      })

    assert.deepStrictEqual(
      await testTable.updateItem({ id: '1' }, {
        name: 'George III',
        isKing: true,
        ruleStart: 1820,
        ruleEnd: null,
      }, { ReturnValues: 'ALL_NEW' }),
      {
        Attributes: {
          id: { S: '1' },
          name: { S: 'George III' },
          isKing: { BOOL: true },
          ruleStart: { N: '1820' },
          ruleEnd: { NULL: true },
        },
      },
    )

    assert.deepEqual(
      await testTable.getItem({ id: '1' }),
      {
        Item: map(Dynamo.toAttributeValue)({
          id: '1',
          name: 'George III',
          isKing: true,
          ruleStart: 1820,
          ruleEnd: null,
        })
      })

    await testTable.deleteItem({ id: '1' })
    assert.rejects(
      () => testTable.getItem({ id: '1' }),
      new Error('Item not found for {"id":"1"}'))
  })
  .after(async function () {
    await this.dynamo.deleteTable('test-tablename')
  })