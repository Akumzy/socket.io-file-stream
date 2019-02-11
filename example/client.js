const io = require('socket.io-client')('http://localhost:8090'),
  Client = require('../dist/src').Client,
  { join } = require('path')

io.on('connect', () => {
  console.log('cool')
})
//Client is not reusable
//once done it will be destroy
const client = new Client(io, {
  filepath: join(__dirname, '../dist/src/lib/client-web.js'),
  data: {
    name: 'web.js'
  }
})
// auto reconnect
// as long as it's below one hour
// it will start from where it stops

client
  .upload('file-upload', data => {
    console.log(data) // 'good'}
  })
  .on('progress', c => {
    // console.log(c) // { size: 783, total: 783 }
    console.log(`${(c.total / c.size) * 100}%`)
  })
  .on('done', data => {
    console.log(data) // { size: 783, total: 783, payload: [ 'good' ] }
  })
  .on('pause', () => {
    console.log('pause')
  })
  .on('cancel', () => {
    console.log('canceled')
  })
  .on('ready', () => {
    io.on('disconnect', () => {
      client.pause()
    }).on('connect', () => {
      client.resume()
    })
  })
// setTimeout(() => {
//   io.disconnect()
//   setTimeout(() => {
//     io.connect()
//   }, 100)
// }, 1500)
// setTimeout(() => {
//   io.disconnect()
//   setTimeout(() => {
//     io.connect()
//   }, 5000)
// }, 1700)
