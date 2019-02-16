const io = require('socket.io')(8090),
  Server = require('../server').default,
  { appendFile } = require('fs-extra')

io.on('connection', socket => {
  const server = new Server(socket)
  server.on('file-upload', async ({ stream, data, ready }, ack) => {
    try {
      console.time('start')
      sleep(30000)
      console.timeEnd('start')
      ready()
      stream.subscribe({
        async next({ buffer, flag }) {
          console.log(buffer)
          console.time('Time took write to file')
          await appendFile(data.name, buffer, {
            encoding: 'binary',
            flag
          })
          console.timeEnd('Time took write to file')
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
function sleep(milliseconds) {
  var start = new Date().getTime()
  for (var i = 0; i < 1e7; i++) {
    if (new Date().getTime() - start > milliseconds) {
      break
    }
  }
}
