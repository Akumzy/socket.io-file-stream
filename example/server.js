const io = require('socket.io')(8090),
  Server = require('../dist/src').Server,
  { createWriteStream } = require('fs')
io.on('connection', socket => {
  console.log('hurrey')
  const server = new Server(socket)
  console.log(server.records)
  server.on('file-upload', (stream, data, resumeAt, ack) => {
    console.log(data)
    console.log('stream')
    console.log(resumeAt)
    const writable = createWriteStream(data.name, {
      encode: 'binary',
      autoClose: true,
      flag: resumeAt ? 'r+' : 'w',
      start: resumeAt || 0
    })
    stream.pipe(writable)
    stream.on('data', chunk => {})
    stream.on('close', () => {
      console.log('done')
    })
    stream.on('end', () => {
      ack([1, 2, 3])
      console.log('end')
    })
    stream.on('error', err => {
      console.log({ err })
    })
  })
})
