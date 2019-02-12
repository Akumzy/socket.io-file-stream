const io = require('socket.io')(8090),
  Server = require('../dist/src').Server,
  { ensureFile, appendFile, unlink } = require('fs-extra')

io.on('connection', socket => {
  const server = new Server(socket)
  server.on('file-upload', async (stream, data, resumeAt, ack) => {
    try {
      stream.subscribe({
        async next({ buffer, flag }) {
          console.log(flag)

          await appendFile(data.name, buffer, {
            encoding: 'binary',
            flag
          })
        },
        complete() {
          console.log('yo yo')
          ack([1, 2, 3])
        },
        error(err) {
          console.log(err)
        }
      })
    } catch (err) {
      console.log(err)
    }
  })
})
