import ReconnectingWebSocket from "reconnecting-websocket";
import ShareDB from "sharedb/lib/client";
import { convertDeltaToHtml }  from 'node-quill-converter';
import '../display.styl';

let websocketEndpoint = "ws://127.0.0.1:8080";
let socket = new ReconnectingWebSocket(websocketEndpoint);

let connection = new ShareDB.Connection(socket);

let doc = connection.get("examples", "test-doc");

doc.fetch((err) => {
    if(err) {
        console.log(err);
        return;
    }

    let delta = doc.data;

    document.querySelector(".content").innerHTML = convertDeltaToHtml(delta);

    doc.destroy();
    socket.close();
});

