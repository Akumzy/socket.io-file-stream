const io = require('socket.io')(8090),
    Server = require('../dist/src').Server
io.on('connection', socket => {
    console.log('hurrey')

    Server.on(socket, 'file-upload', ({ chunk, data }, ack) => {
        console.log(chunk)
            // console.log(data)
            // console.log(ack)
    })

    Server.on(socket, 'file-image', ({ chunk, data }, ack) => {
        console.log(chunk)
            // console.log(data)
            // console.log(ack)
    })
})