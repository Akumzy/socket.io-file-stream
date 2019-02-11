const io = require('socket.io')(8090),
  Server = require('../dist/src').Server,
  { createWriteStream } = require('fs')
io.on('connection', socket => {
  console.log('hurrey')
  const server = new Server(socket)

  server.on('file-upload', (stream, data) => {
    console.log('stream')
    const writable = createWriteStream(data.name, {
      autoClose: true
    })
    stream.pipe(writable)
    stream.on('close', () => {
      console.log('done')
    })
    stream.on('end', () => {
      console.log('end')
    })
    stream.on('error', err => {
      console.log(err)
    })
  })
})
