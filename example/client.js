const io = require('socket.io-client')('http://localhost:8090'),
  Client = require('../dist/client').default,
  { join } = require('path')

io.on('connect', () => {
  console.log('cool')
})
//Client is not reusable
//once done it will be destroy
const client = new Client(io, {
  filepath: '/home/akumzy/Videos/Algebra Introduction - Basic Overview - Online Crash Course Review Video Tutoria.mp4',
  data: {
    name: 'hello.txt'
  },
  maxWait: 30
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
  .on('cancel', e => {
    console.log(e)
    console.log('canceled')
  })
  .on('ready', () => {
    io.on('disconnect', () => {
      client.pause()
    }).on('connect', () => {
      client.resume()
    })
  })
