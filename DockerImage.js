const rubico = require('rubico')
const isString = require('rubico/x/isString')
const identity = require('rubico/x/identity')
const trace = require('rubico/x/trace')
const defaultsDeep = require('rubico/x/defaultsDeep')
const querystring = require('querystring')
const stringifyJSON = require('./internal/stringifyJSON')
const split = require('./internal/split')
const join = require('./internal/join')
const Docker = require('./Docker')
const stream = require('stream')
const pathJoin = require('./internal/pathJoin')
const parseJSON = require('./internal/parseJSON')

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
 * @name DockerImage
 *
 * @synopsis
 * ```coffeescript [specscript]
 * new DockerImage(image name, dockerfile string) -> DockerImage
 * ```
 *
 * @synopsis
 * Build and push Docker images.
 *
 * Dockerfile Syntax
 * ```sh
 * HEALTHCHECK \
 *   [--interval=<duration '30s'|string>] \
 *   [--timeout=<duration '30s'|string>] \
 *   [--start-period=<duration '0s'|string>] \
 *   [--retries=<3|number>] \
 * CMD <string>
 *
 * ENV <key>=<value> ...<key>=<value>
 *
 * EXPOSE <port> [...<port>/<protocol 'tcp'|'udp'>]
 *
 * WORKDIR <path>
 *
 * VOLUME ["<path>", ..."<paths>"]|<paths string>
 *
 * USER <user>[:<group>]|<UID>[:<GID>]
 *
 * ENTRYPOINT ["<executable>", ..."<parameter>"]
 *   |"<command> ...<parameter>"
 *
 * CMD ["<executable>", ..."<parameter>"] # exec form
 *   |[..."<parameter>"] # default parameters to ENTRYPOINT
 *   |"<command> ...<parameter>" # shell form
 * ```
 */
const DockerImage = function (image, dockerfile) {
  if (this == null || this.constructor != DockerImage) {
    return new DockerImage(image, dockerfile)
  }
  this.image = image
  this.dockerfile = dockerfile
  this.docker = new Docker()
  this.promises = new Set()
  return this
}

/**
 * @name DockerImage.prototype.build
 *
 * @synopsis
 * ```coffeescript [specscript]
 * DockerImage(image, dockerfile).build(
 *   path string,
 *   options? {
 *     ignore: Array<string>, // paths or names to ignore in build context tarball
 *     archive: Object<path string)=>(content string)>, // object representation of the base archive for build context
 *   },
 * ) -> ReadableStream
 * ```
 */
DockerImage.prototype.build = function (path, options = {}) {
  const result = new PassThroughStream(),
    promise = this.docker.buildImage(this.image, path, defaultsDeep({
      archive: {
        Dockerfile: this.dockerfile,
      },
    })(pick(['ignore', 'archive'])(options))).then(response => {
      response.body.pipe(result)
      this.promises.delete(promise)
    })
  this.promises.add(promise)
  result.then = (
    handler, onError,
  ) => passthrough('')(result).then(handler, onError)
  return result
}

/**
 * @name DockerImage.prototype.push
 *
 * @synopsis
 * ```coffeescript [specscript]
 * DockerImage(image, dockerfile).push(repository string, options {
 *   authorization: {
 *     username: string,
 *     password: string,
 *     email: string,
 *     serveraddress: string,
 *   }|{
 *     identitytoken: string,
 *   },
 * }) -> ReadableStream
 * ```
 */
DockerImage.prototype.push = function (repository, options) {
  const result = new PassThroughStream(),
    promise = this.docker.tagImage(this.image, {
      tag: this.image.split(':')[1],
      repo: pathJoin(repository, this.image.split(':')[0]),
    }).then(pipe([
      () => this.docker.pushImage(
        this.image, repository, pick(['authorization'])(options)),
      response => {
        response.body.pipe(result)
        this.promises.delete(promise)
      },
    ]))
  this.promises.add(promise)
  result.then = (
    handler, onError,
  ) => passthrough('')(result).then(handler, onError)
  return result
}

/**
 * @name DockerImage.prototype.inspect
 *
 * @synopsis
 * ```coffeescript [specscript]
 * DockerImage(image, dockerfile).inspect() -> {}
 * ```
 */
DockerImage.prototype.inspect = function () {
  return this.docker.inspectImage(this.image).then(pipe([
    get('body'),
    passthrough(''),
    parseJSON,
  ]))
}

module.exports = DockerImage
