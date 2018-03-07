'use strict'

const PORT = process.env.PORT || 8000
const http = require('http')
const server = http.createServer()

function calArrayConcat(n) {
  function toFib(x, y, z) {
    return x.concat((z < 2) ? z : x[z - 1] + x[z - 2])
  }

  const arr = Array.apply(null, new Array(n)).reduce(toFib, [])
  const len = arr.length
  return arr[len - 1] + arr[len - 2]
}

function calArrayPush(n) {
  function toFib(x, y, z) {
    x.push((z < 2) ? z : x[z - 1] + x[z - 2])
    return x
  }

  const arr = Array.apply(null, new Array(n)).reduce(toFib, [])
  const len = arr.length
  return arr[len - 1] + arr[len - 2]
}

function calIterative(n) {
  let x = 0
  let y = 1
  let c = 0
  let t

  while (c !== n) {
    t = x
    x = y
    y += t
    c++
  }
  return x
}

const METHOD = process.env.METHOD

function onRequest(req, res) {
  res.writeHead(200, { 'Content-Type': 'text/plain' })

  var n = parseInt(req.url.slice(1))
  if (isNaN(n) || n < 0) {
    return res.end('Please supply a number larger than 0, i.e. curl localhost:8000/12')
  }

  let result
  switch (METHOD) {
    case 'push': result = calArrayPush(n); break
    case 'iter': result = calIterative(n); break
    default: result = calArrayConcat(n)
  }

  res.end(`fibonacci of ${n} is ${result}\r\n`)
}

function onListening() {
  console.error('HTTP server listening on port', PORT)
}

server
  .on('request', onRequest)
  .on('listening', onListening)
  .listen(PORT)
