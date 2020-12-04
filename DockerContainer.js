const rubico = require('rubico')
const isString = require('rubico/x/isString')
const identity = require('rubico/x/identity')
const noop = require('rubico/x/noop')
const querystring = require('querystring')
const stringifyJSON = require('./internal/stringifyJSON')
const split = require('./internal/split')
const join = require('./internal/join')
const Docker = require('./Docker')
const stream = require('stream')

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

const PassThroughStream = stream.PassThrough

/**
 * @name DockerContainer
 *
 * @synopsis
 * ```coffeescript [specscript]
 * new DockerContainer(image string) -> DockerContainer
 * ```
 *
 * @TODO
 * Refactor all Docker functionality to Docker
 * Use og docker to implement APIs
 *
 * ```javascript
 * new DockerContainer('node:15-alpine', options? {
 *   name: string, // specific name for the container
 *   rm: boolean, // automatically remove the container when it exits TODO
 *   restart: 'no'|'on-failure[:<max-retries>]'|'always'|'unless-stopped',
 *   logDriver: 'json-file'|'syslog'|'journald'|'gelf'|'fluentd'|'awslogs'|'splunk'|'none',
 *   logDriverOptions: Object<string>,
 *   publish: Array<string>, // '<hostPort>:<containerPort>[:"tcp"|"udp"|"sctp"]'
 *   healthcheck: {
 *     test: Array<string>, // healthcheck command configuration. See description
 *     interval?: 10e9|>1e6, // nanoseconds to wait between healthchecks; 0 means inherit
 *     timeout?: 20e9|>1e6, // nanoseconds to wait before healthcheck fails
 *     retries?: 5|number, // number of retries before unhealhty
 *     startPeriod?: >=1e6, // nanoseconds to wait on container init before starting first healthcheck
 *   },
 *   memory: number, // memory limit in bytes
 *   mounts: Array<{
 *     source: string, // name of volume
 *     target: string, // mounted path inside container
 *     readonly: boolean,
 *   }>|Array<string>, // '<source>:<target>[:readonly]'
 *
 *   // Dockerfile defaults
 *   cmd: Array<string|number>, // CMD
 *   expose: Array<(port string)>, // EXPOSE
 *   volume: Array<path string>, // VOLUME
 *   workdir: path string, // WORKDIR
 *   env: {
 *     HOME: string,
 *     HOSTNAME: string,
 *     PATH: string, // $PATH
 *     ...(moreEnvOptions Object<string>),
 *   }, // ENV; environment variables exposed to container during run time
 * }).run(['node', '-e', 'console.log(\'hey\')'])
 * ```
 *
 * @description
 * Declarative syntax for Docker containers.
 * ```javascript
 * new DockerContainer('node:15-alpine', {
 *   name: 'my-container',
 *   env: { FOO: 'hey', BAR: 1 },
 *   cmd: ['node', '-e', 'console.log(process.env.FOO)'],
 * }).attach(async dockerRawStream => {
 *   // main process stream
 * }).start()
 * ```
 */
const DockerContainer = function (name, options) {
  if (this == null || this.constructor != DockerContainer) {
    return new DockerContainer(name, options)
  }
  this.docker = new Docker()
  this.options = options
  this.name = name
  this.ready = this.docker.inspectContainer(name).then(async response => {
    switch (response.status) {
      case 200:
        return undefined
      case 404:
        return this.docker.createContainer(name, options).then(noop)
      default:
        throw new Error(`${response.statusText}: ${await response.text()}`)
    }
  })
  return this
}

// dockerContainer.run() -> mainCmdStream ReadableStream
DockerContainer.prototype.run = function dockerContainerRun() {
  const result = new PassThroughStream()
  result.promise = (async () => {
    await this.ready
    await new Promise((resolve, reject) => {
      this.docker.attachContainer(this.name).then(async response => {
        response.body.on('end', resolve)
        response.body.on('error', reject)
        response.body.pipe(result)
        await this.docker.startContainer(this.name)
      })
    })
  })()
  return result
}

// dockerContainer.exec(cmd Array<string>) -> sideCmdStream ReadableStream
DockerContainer.prototype.exec = function dockerContainerExec(cmd) {
  const result = new PassThroughStream()
  result.promise = (async () => {
    await this.ready
    await new Promise((resolve, reject) => {
      this.docker.execContainer(this.name, cmd).then(response => {
        response.body.on('end', resolve)
        response.body.on('error', reject)
        response.body.pipe(result)
      })
    })
  })()
  return result
}

// dockerContainer.start() -> Promise<Object>
DockerContainer.prototype.start = async function dockerContainerStart() {
  await this.ready
  return this.docker.startContainer(this.name)
    .then(always({ message: 'success' }))
}

// dockerContainer.stop() -> Promise<{ message: 'success' }>
DockerContainer.prototype.stop = async function dockerContainerStop() {
  await this.ready
  return this.docker.stopContainer(this.name, { time: 1 })
    .then(always({ message: 'success' }))
}

module.exports = DockerContainer
