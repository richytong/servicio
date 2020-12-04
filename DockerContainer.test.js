const Test = require('thunk-test')
const assert = require('assert')
const DockerContainer = require('./DockerContainer')
const Docker = require('./Docker')
const rubico = require('rubico')
const identity = require('rubico/x/identity')
const join = require('./internal/join')
const Http = require('./Http')

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

const passthrough = target => transform(map(identity), target)

const charCode = string => string.charCodeAt(0)

const Stdout = {
  write(...args) {
    console.log(...args)
    return this
  },
}

module.exports = Test('DockerContainer', DockerContainer)
  .before(async function () {
    this.docker = new Docker()
    await this.docker.pruneContainers()
    await this.docker.pruneImages()
  })
  .case('test-alpine-1', {
    image: 'node:15-alpine',
    env: { FOO: 'foo', BAR: 'bar' },
    cmd: [
      'node',
      '-e',
      `
http.createServer((request, response) => {
  repsonse.end('hello')
}).listen(8080, () => {
  console.log(process.env.FOO)
})`,
    ],
    rm: true
  }, async container => {
    const serverStream = container.run()
    let content = []
    serverStream.on('data', async chunk => {
      content.push(chunk)
      assert.deepEqual(
        await passthrough([])(container.exec(['node', '-e', 'console.log(process.env.BAR)'])),
        [1, 0, 0, 0, 0, 0, 0, 4, charCode('b'), charCode('a'), charCode('r'), charCode('\n')],
      )
      const stopResult = await container.stop()
      assert.equal(stopResult.message, 'success')
    })
    await new Promise(resolve => {
      serverStream.on('end', () => {
        content = Buffer.concat(content)
        assert.deepEqual(
          content,
          Buffer.from([1, 0, 0, 0, 0, 0, 0, 4, charCode('f'), charCode('o'), charCode('o'), charCode('\n')]))
        resolve()
      })
    })
  })
  .case('test-alpine-2', {
    image: 'node:15-alpine',
    env: { FOO: 'foo' },
    cmd: ['node', '-e', 'console.log(process.env.FOO)'],
  }, async container => {
    const logStream = container.run()
    assert.deepEqual(
      await passthrough(Buffer.from(''))(logStream),
      Buffer.from([1, 0, 0, 0, 0, 0, 0, 4, charCode('f'), charCode('o'), charCode('o'), charCode('\n')]))
    let startResponse = await container.start()
    assert.equal(startResponse.message, 'success')
    startResponse = await container.start()
    assert.equal(startResponse.message, 'container already started')
  })
  .after(async function () {
    await this.docker.pruneContainers()
    await this.docker.pruneImages()
  })
