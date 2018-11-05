const io = require('socket.io')(8090),
    Server = require('../dist/src').Server,
    { createWriteStream } = require('fs')
io.on('connection', socket => {
    console.log('hurrey')
    const server = new Server(socket)

    server.on('file-upload', ({ stream, data }, done) => {
        console.log('stream');
        const writable = new createWriteStream(data.data.name, {
            autoClose: true
        })
        stream.pipe(writable)
        writable.on('close', () => {
            //make sure to call this function 
            //only when you're done you can
            //pass a value to it which will be 
            //sent back to client as well
            done('good')
        })

    })
})