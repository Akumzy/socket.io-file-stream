const io = require('socket.io-client')('http://localhost:8090'),
    Client = require('../dist/src').Client,
    { join } = require('path')

io.on('connect', () => {
    const client = new Client(io, {
        filepath: join(__dirname, './test.mp3')
    })

    client
        .upload('file-upload', data => {
            console.log({ data })
        })
        .on('progress', c => {
            console.log(`${(c.total / c.size) * 100}%`)
        })
        .on('done', chunk => {
            console.log(chunk)
        })
        .on('pause', () => {
            console.log('pause')
        })
    setTimeout(() => {
        client.pause()
    }, 200)
    setTimeout(() => {
            client.resume()
        }, 1000)
        // const client1 = new Client(io, {
        //     filepath: join(__dirname, './client.js')
        // })

    // client1
    //     .upload('file-image', data => {
    //         console.log(data)
    //     })
    //     .on('progress', c => {
    //         console.log(`${(c.total / c.size) * 100}%`)
    //     })
    //     .on('done', chunk => {
    //         console.log(chunk)
    //     })
    //     .on('pause', () => {
    //         console.log('pause')
    //     })
    // setTimeout(() => {
    // 	client1.pause()
    // }, 20)
    // setTimeout(() => {
    // 	client1.resume()
    // }, 1000)
})