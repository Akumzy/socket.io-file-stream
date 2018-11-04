const io = require('socket.io')(8090),
	Server = require('../dist/src').Server,
	{ createWriteStream } = require('fs')
io.on('connection', socket => {
	console.log('hurrey')
	const server = new Server(socket)

	server.on('file-upload', ({ stream, data }, ack) => {
		const writable = new createWriteStream('new-package.json', {
			autoClose: true
		})
		stream.pipe(writable)
		//any data to send back to client when done
		ack('good')
	})

	server.on('file-image', ({ chunk, data }, ack) => {
		console.log(chunk)
		// console.log(data)
		// console.log(ack)
	})
})
