# Presidium
![Node.js CI](https://github.com/richytong/presidium/workflows/Node.js%20CI/badge.svg?branch=master)
[![codecov](https://codecov.io/gh/richytong/presidium/branch/master/graph/badge.svg)](https://codecov.io/gh/richytong/presidium)
[![npm version](https://img.shields.io/npm/v/presidium.svg?style=flat)](https://www.npmjs.com/package/presidium)

A library for creating web services.

## Serve Http
```javascript
import { HttpServer, Http } from 'presidium'

new HttpServer((request, response) => {
  response.writeHead(200, { 'Content-Type': 'application/json' })
  response.write(JSON.stringify({ greeting: 'Hello World' }))
  response.end()
}).listen(3000)

const http = new Http('http://localhost:3000/')

http.get('/')
  .then(response => response.json())
  .then(console.log) // { greeting: 'Hello World' }
```

## Serve WebSocket
```javascript
import { WebSocketServer, WebSocket } from 'presidium'

new WebSocketServer(socket => {
  socket.on('message', message => {
    console.log(`received: ${message}`) // received: something from client
    socket.send('something from server')
  })
}).listen(1337)

const socket = new WebSocket('ws://localhost:1337/')
socket.on('open', () => {
  socket.send('something from client')
})
socket.on('message', data => {
  console.log(data) // something from server
})
```

## CRUD and query DynamoDB
```javascript
import { DynamoTable, DynamoIndex } from 'presidium'

const awsCreds = {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
}

const myTable = new DynamoTable('my-table', {
  key: [{ id: 'string' }],
  ...awsCreds,
})

const myIndex = new DynamoIndex('my-index', {
  key: [{ name: 'string' }, { age: 'number' }],
  table: 'my-table',
  ...awsCreds,
})

;(async function() {
  await myTable.putItem({ id: '1', name: 'George' })
  await myTable.updateItem({ id: '1' }, { age: 32 })
  console.log(
    await myTable.getItem({ id: '1' }),
  ) // { Item: { id: '1', ... } }

  console.log(
    await myIndex.query(
      'name = :name AND age < :age',
      { name: 'George', age: 33 }),
  ) // [{ Items: [{ id: '1', ... }, ...] }]
  await myTable.deleteItem({ id: '1' })
})()
```

## Build && Push Docker Images
```javascript
import { DockerImage } from 'presidium'

const myAppImage = new DockerImage('my-app:latest', `
FROM node:15-alpine
WORKDIR /opt
COPY . .
RUN echo //registry.npmjs.org/:_authToken=${myNpmToken} > $HOME/.npmrc \
  && npm i \
  && rm $HOME/.npmrc
EXPOSE 8080
CMD ["npm", "start"]
`).build(__dirname, {
  ignore: ['.github', 'node_modules'],
}, buildStream => {
  buildStream.pipe(process.stdout)
  buildStream.on('end', () => {
    myAppImage.push('my-registry.io', pushStream => {
      pushStream.pipe(process.stdout)
    })
  })
})
```

## Execute Docker Containers
```javascript
import { DockerContainer } from 'presidium'

new DockerContainer('node:15-alpine', {
  env: { FOO: 'foo', BAR: 'bar' },
  cmd: ['node', '-e', 'console.log(process.env.FOO)'],
}).attach(dockerStream => {
  // dockerStream.pipe(process.stdout) // raw docker stream
}).start()

DockerContainer.run('node:15-alpine', {
  env: { FOO: 'foo', BAR: 'bar' },
  cmd: ['node', '-e', 'console.log(process.env.FOO)'],
}, dockerStream => { /* ... */ })
```

## Deploy Docker Swarm Services
```javascript
import { DockerSwarm, DockerService } from 'presidium'

(async function () {
  await DockerSwarm.join('[::1]:2377', process.env.SWARM_MANAGER_TOKEN)
  await DockerService.update('my-unique-service-name-in-swarm', {
    image: 'my-app:latest',
    env: { FOO: 'foo', BAR: 'bar' },
    cmd: ['npm', 'start'],
    replicas: 5,
    restart: 'on-failure',
    publish: { 3000: 3000 }, // hostPort: containerPort
    healthCmd: ['wget', '--no-verbose', '--tries=1', '--spider', 'localhost:3000'],
    mounts: ['my-volume:/opt/data/my-volume:readonly']
    logDriver: 'json-file',
    logDriverOptions: { 'max-file': '10', 'max-size': '100m' },
  })
})()
```
