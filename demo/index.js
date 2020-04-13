import Editor from "../editor";
import 'quill/dist/quill.snow.css'
import ReconnectingWebSocket from "reconnecting-websocket";
import ShareDB from "sharedb/lib/client";

let bindings = {
    'list autofill': {
        prefix: /^\s*(0{1,1}\.|\*)$/
    }
};

let author = {
    id: 10,
    name: 'Main Author'
};

let authors = [
    {
        id: 1,
        name: "User A"
    },
    {
        id: 2,
        name: "User A"
    },
    {
        id: 3,
        name: "User A"
    },
    {
        id: 4,
        name: "User A"
    },
    {
        id: 5,
        name: "User A"
    }
];

let testUrl = 'https://www.google.com/image.jpg';

let editorOptions = {
    author: author,
    handlers: {
        imageFileUpload: () => {
            return new Promise((resolve, reject) => {
                resolve(testUrl);
            });
        },
        imageDataURIUpload: () => {
            return new Promise((resolve, reject) => {
                resolve(testUrl);
            });
        },
        imageUploadError: (err) => {
            console.log("image upload error: " + err);
        },
        getAuthorInfoById: (authorId) => {
            return new Promise((resolve, reject) => {

                let author = authors[authorId];

                if(author) {
                    resolve(author);
                }else{
                    reject("user not found");
                }

            });
        }
    }
};

let quillOptions = {
    modules: {
        keyboard: {bindings},
        toolbar: {
            container: "#toolbar",
        }
    },
    theme: 'snow'
};

let editor = new Editor("#container", editorOptions, quillOptions);

let docId = null;

let websocketEndpoint = "ws:/127.0.0.1:5000/ws/documents/";

let socket = new ReconnectingWebSocket(websocketEndpoint);
let connection = new ShareDB.Connection(socket);
let doc = connection.get("documents", docId);

editor.syncDocument(doc);

function onBeforeToolbarImageUpload(file) {
    editor.dispatchEvent("toolbarBeforeImageUpload", file);
}

function onToolbarImageUploadSuccess(response) {
    editor.dispatchEvent("toolbarImageUploadSuccess", response.image_url);
}

function onToolbarImageUploadError(err) {
    editor.dispatchEvent("toolbarImageUploadError", err);
}
