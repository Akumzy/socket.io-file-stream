const io = require('socket.io')(8090),
  Server = require('../dist/server').default,
  { appendFile } = require('fs-extra')

io.on('connection', socket => {
  const server = new Server(socket)
  server.on('file-upload', async ({ stream, data, ready }, ack) => {
    try {
      ready()
      stream.subscribe({
        async next({ buffer, flag }) {
          await appendFile(data.name, buffer, {
            encoding: 'binary',
            flag
          })
        },
        complete() {
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
