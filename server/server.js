let http = require('http');
let express = require('express');
let ShareDB = require('sharedb');
let richText = require('rich-text');
let WebSocket = require('ws');
let WebSocketJSONStream = require('@teamwork/websocket-json-stream');

ShareDB.types.register(richText.type);
let backend = new ShareDB();
createDoc(startServer);

// Create initial document then fire callback
function createDoc(callback) {
    let connection = backend.connect();
    let doc = connection.get('examples', 'test-doc');
    doc.fetch(function(err) {
        if (err) throw err;
        if (doc.type === null) {
            doc.create([{insert: 'Hi!', attributes:{author: 3}}], 'rich-text', callback);
            return;
        }
        callback();
    });
}

function startServer() {
    // Create a web server to serve files and listen to WebSocket connections
    let app = express();
    app.use(express.static('static'));
    app.use(express.static('node_modules/quill/dist'));
    let server = http.createServer(app);

    // Connect any incoming WebSocket connection to ShareDB
    let wss = new WebSocket.Server({server: server});
    wss.on('connection', function(ws) {
        let stream = new WebSocketJSONStream(ws);
        backend.listen(stream);
    });

    server.listen(8080);
    console.log('Listening on http://localhost:8080');
}
