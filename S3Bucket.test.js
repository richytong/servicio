const assert = require('assert')
const Test = require('thunk-test')
const S3 = require('./S3')
const S3Bucket = require('./S3Bucket')
const inspect = require('./internal/inspect')

module.exports = Test('S3Bucket', S3Bucket)
  .before(async function () {
    this.s3 = new S3({ endpoint: 'http://localhost:9000/' })
    try {
      await new S3Bucket({
        name: 'test-bucket',
        endpoint: 'http://localhost:9000',
      }).deleteObjects(['a', 'b', 'c'])
      await new S3Bucket({
        name: 'test-bucket',
        endpoint: 'http://localhost:9000',
      }).deleteObject('binary')
      await this.s3.deleteBucket('test-bucket')
    } catch {}
  })
  .case({
    name: 'test-bucket',
    endpoint: 'http://localhost:9000/',
  }, async function (testBucket) {
    await testBucket.ready

    await testBucket.deleteObjects(['a', 'b', 'c'])
    await testBucket.deleteObject('binary')

    await testBucket.putObject('a', JSON.stringify({ id: 'a' }), {
      ContentType: 'application/json',
    })
    await testBucket.putObject('b', JSON.stringify({ id: 'b' }))
    await testBucket.putObject('c', JSON.stringify({ id: 'c' }))
    const a = await testBucket.getObject('a')
    assert(a.ETag == '"6a1a81494a7765ad411580b31c1b7044"')
    assert(a.Body.toString() == '{"id":"a"}')
    assert(a.ContentType == 'application/json')
    const s3Objects = await testBucket.listObjects()
    assert(s3Objects.Contents.length == 3)
    assert(s3Objects.Contents[0].Key == 'a')
    assert(s3Objects.Contents[1].Key == 'b')
    assert(s3Objects.Contents[2].Key == 'c')
    await testBucket.putObject('binary', Buffer.from('binary'))
    const binary = await testBucket.getObject('binary')
    assert(binary.ContentType == 'application/octet-stream')
    assert.deepEqual(binary.Body, Buffer.from('binary'))

    await testBucket.deleteAllObjects({ MaxKeys: 1 })
    const deleted = await testBucket.delete()
  })
