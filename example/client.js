const io = require('socket.io-client')('http://localhost:8090'),
  Client = require('../client'),
  { join } = require('path')

io.on('connect', () => {
  console.log('cool')
})
//Client is not reusable
//once done it will be destroy
const client = new Client(io, {
  filepath: join(__dirname, './text.txt'),
  data: {
    name: 'hello.txt'
  }
})
// auto reconnect
// as long as it's below one hour
// it will start from where it stops

client
  .upload('file-upload', res => {
    console.log(res)
  })
  .on('progress', c => {
    console.log(c) // { size: 783, total: 783 }
    console.log(typeof c.total, typeof c.size)
    console.log(`${(c.total / c.size) * 100}%`)
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
