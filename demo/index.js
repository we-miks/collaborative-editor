import Editor from "../editor";
import 'quill/dist/quill.snow.css'
import EditorEvents from "../editor-events";
import '../modules/task-list';

import ReconnectingWebSocket from "reconnecting-websocket";
import ShareDB from "sharedb/lib/client";
import Quill from 'quill';
import richText from "rich-text";
ShareDB.types.register(richText.type);

// For icons of header value 3
const icons = Quill.import('ui/icons');
icons['header'][3] = require('!html-loader!quill/assets/icons/header-3.svg');

import '../display.styl';


let authors = [
    {
        id: 1,
        name: "User A"
    },
    {
        id: 2,
        name: "User B"
    },
    {
        id: 3,
        name: "User C"
    },
    {
        id: 4,
        name: "User D"
    },
    {
        id: 5,
        name: "User E"
    }
];

let authorIndex = Math.ceil(Math.random() * 1000) % authors.length;

let testUrl = 'https://yd.wemiks.com/banner-2d980584-yuanben.svg';

let editorOptions = {
    authorship: {
        author: authors[authorIndex],
        authorColor: '#ed5634',
        colors: [
            "#f7b452",
            "#ef6c91",
            "#8e6ed5",
            "#6abc91",
            "#5ac5c3",
            "#7297e3",
            "#9bc86e",
            "#ebd562",
            "#d499b9"
        ],
        handlers: {
            getAuthorInfoById: (authorId) => {
                return new Promise((resolve, reject) => {

                    let author = authors.find((a) => a.id + '' === authorId);

                    console.log("user info retrieved from server: " + authorId);

                    if(author) {
                        resolve(author);
                    }else{
                        reject("user not found");
                    }

                });
            }
        }
    },
    image: {
        handlers: {
            imageDataURIUpload: (dataURI) => {

                return new Promise((resolve) => {
                    resolve(testUrl);
                });
            },
            imageSrcUpload: (src) => {

                return new Promise((resolve) => {
                    resolve(testUrl);
                });
            },
            imageUploadError: (err) => {
                console.log("image upload error: " + err);
            }
        }
    }
};

let toolbarOptions = [
    ['bold', 'italic', 'underline', 'strike'],
    [{'header': 1}, {'header': 2}, {'header': 3}],
    [{'list': 'ordered'}, {'list': 'bullet'}, 'task-list', {'indent': '+1'}, {'indent': '-1'}],
    ['align', 'color', 'background'],
    ['blockquote', 'code-block', 'link', 'image']
];

let quillOptions = {
    modules: {
        toolbar: toolbarOptions,
        'task-list': true
    },
    theme: 'snow'
};

let editor = new Editor("#container", editorOptions, quillOptions);

editor.on(EditorEvents.imageSkipped, ()=>{
    console.log("image skipped");
});

editor.on(EditorEvents.documentLoaded, () => {
    console.log("document loaded");
});

editor.on(EditorEvents.synchronizationError, (err) => {
    console.log("connection error");
    console.log(err);
});



let websocketEndpoint = "ws://127.0.0.1:8080";

editor.syncThroughWebsocket(websocketEndpoint, "examples", "test-doc");

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

    editor.on(EditorEvents.editorTextChanged, (delta) => {
        let del = delta.oldDelta.compose(delta.delta)
        quill.setContents(del);
        document.querySelector(".content").innerHTML = quill.root.innerHTML;
    })
});
