import ReconnectingWebSocket from "reconnecting-websocket";
import ShareDB from "sharedb/lib/client";
import { QuillDeltaToHtmlConverter } from 'quill-delta-to-html';
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

    let converter = new QuillDeltaToHtmlConverter(delta.ops, {});

    document.querySelector(".content").innerHTML = converter.convert();

    doc.destroy();
    socket.close();
});

