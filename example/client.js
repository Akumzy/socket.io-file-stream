const io = require('socket.io-client')('http://localhost:8090'),
	Client = require('../dist/src').Client,
	{ join } = require('path')

io.on('connect', () => {
	console.log('cool')
})
//Client is not reusable
//once done it will be destroy
const client = new Client(io, {
	filepath:
		'/home/akumzy/Music/04. DJ Khaled - Wild Thoughts (feat. Rihanna & Br.mp3',
	data: {
		name: '04. DJ Khaled - Wild Thoughts (feat. Rihanna & Br.mp3'
	}
})
// auto reconnect
// as long as it's below one hour
// it will start from where it stops
// io.on('disconnect', () => {
// 	client.pause()
// }).on('reconnect', () => {
// 	client.resume()
// })
client
	.upload('file-upload', data => {
		console.log({ data }) //{ data: { size: 783, total: 783, payload: [ 'good' ] } }
	})
	.on('progress', c => {
		// console.log(c) // { size: 783, total: 783 }
		console.log(`${(c.total / c.size) * 100}%`)
	})
	// .on('done', data => {
	// 	console.log(data) // { size: 783, total: 783, payload: [ 'good' ] }
	// })
	// .on('pause', () => {
	// 	console.log('pause')
	// })
	.on('cancel', () => {
		console.log('canceled')
	})
// setTimeout(() => {
//     client.pause()
// }, 200)
setTimeout(() => {
	client.stop()
}, 1000)
