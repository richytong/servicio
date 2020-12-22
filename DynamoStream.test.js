const assert = require('assert')
const Test = require('thunk-test')
const DynamoTable = require('./DynamoTable')
const DynamoStream = require('./DynamoStream')
const transform = require('rubico/transform')
const map = require('rubico/map')
const thunkify = require('rubico/thunkify')
const asyncIterableTake = require('./internal/asyncIterableTake')

module.exports = Test('DynamoStream', DynamoStream)
  .before(async function () {
    const table = new DynamoTable({
      name: 'my-table',
      key: [{ id: 'string' }],
      endpoint: 'http://localhost:8000',
    })
    await table.ready
    await table.delete()
  })
  .before(async function () {
    this.table = new DynamoTable({
      name: 'my-table',
      key: [{ id: 'string' }],
      endpoint: 'http://localhost:8000',
    })
    await this.table.ready
  })
  .case({
    table: 'my-table',
    endpoint: 'http://localhost:8000',
  }, async function (myStream) {
    await myStream.ready

    const table = this.table
    await table.putItem({
      id: '1',
      status: 'waitlist',
      createTime: 1000,
      name: 'George',
    })
    await table.putItem({
      id: '2',
      status: 'waitlist',
      createTime: 1001,
      name: 'geo',
    })
    await table.putItem({
      id: '3',
      status: 'waitlist',
      createTime: 1002,
      name: 'john',
    })
    await table.putItem({
      id: '4',
      status: 'approved',
      createTime: 1003,
      name: 'sally',
    })
    await table.putItem({
      id: '5',
      status: 'approved',
      createTime: 1004,
      name: 'sally',
    })

    const first5 = await asyncIterableTake(5)(myStream)
    assert.strictEqual(first5.length, 5)
  })
  .case({
    table: 'my-table',
    endpoint: 'http://localhost:8000',
    getRecordsLimit: 1,
  }, async function (myStream) {
    await myStream.ready

    const table = this.table
    await table.putItem({
      id: '1',
      status: 'waitlist',
      createTime: 1000,
      name: 'George',
    })
    await table.putItem({
      id: '2',
      status: 'waitlist',
      createTime: 1001,
      name: 'geo',
    })
    await table.putItem({
      id: '3',
      status: 'waitlist',
      createTime: 1002,
      name: 'john',
    })
    await table.putItem({
      id: '4',
      status: 'approved',
      createTime: 1003,
      name: 'sally',
    })
    await table.putItem({
      id: '5',
      status: 'approved',
      createTime: 1004,
      name: 'sally',
    })

    const first5 = await asyncIterableTake(5)(myStream)
    assert.strictEqual(first5.length, 5)
  })
  .case({
    table: 'my-table',
    endpoint: 'http://localhost:8000',
    getRecordsLimit: 1,
  }, async function (myStream) {
    await myStream.ready

    const table = this.table
    await table.putItem({
      id: '1',
      status: 'waitlist',
      createTime: 1000,
      name: 'George',
    })
    await table.putItem({
      id: '2',
      status: 'waitlist',
      createTime: 1001,
      name: 'geo',
    })
    await table.putItem({
      id: '3',
      status: 'waitlist',
      createTime: 1002,
      name: 'john',
    })
    await table.putItem({
      id: '4',
      status: 'approved',
      createTime: 1003,
      name: 'sally',
    })
    await table.putItem({
      id: '5',
      status: 'approved',
      createTime: 1004,
      name: 'sally',
    })

    const first5 = await asyncIterableTake(5)(myStream)
    assert.strictEqual(first5.length, 5)
  })
  .case({
    table: 'my-table',
    endpoint: 'http://localhost:8000',
    shardIteratorType: 'LATEST',
  }, async function (myStream) {
    await myStream.ready

    // there shouldn't be any more records, so latestRecordPromise should never resolve
    const latestRecordPromise = asyncIterableTake(1)(myStream)
    const raceResult = await Promise.race([
      latestRecordPromise,
      new Promise(resolve => setTimeout(thunkify(resolve, 'hey'), 3000))
    ])
    assert.equal(raceResult, 'hey')
    myStream.close()
  })
