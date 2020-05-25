import ReconnectingWebSocket from "reconnecting-websocket";
import ShareDB from "sharedb/lib/client";
import Quill from 'quill';
import richText from "rich-text";
ShareDB.types.register(richText.type);

import '../display.styl';

let websocketEndpoint = "ws://127.0.0.1:8080";
let socket = new ReconnectingWebSocket(websocketEndpoint);

let connection = new ShareDB.Connection(socket);

let doc = connection.get("examples", "test-doc");


// Create a hidden quill editor to parse delta to html


let editorContainer = document.createElement('div');
editorContainer.style.display = 'none';

let quill = new Quill(editorContainer);

doc.fetch((err) => {
    if(err) {
        console.log(err);
        return;
    }

    let delta = doc.data;

    quill.setContents(delta);

    document.querySelector(".content").innerHTML = quill.root.innerHTML;

    doc.destroy();
    socket.close();
});

