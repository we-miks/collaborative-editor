import Editor from "../editor";
import 'quill/dist/quill.snow.css'
import ReconnectingWebSocket from "reconnecting-websocket";
import ShareDB from "sharedb/lib/client";

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

let testUrl = 'https://yd.wemiks.com/banner-2d980584-yuanben.svg';

let editorOptions = {
    author: author,
    handlers: {
        imageDataURIUpload: (file) => {

            console.log(file);

            return new Promise((resolve) => {
                resolve(testUrl);
            });
        },
        imageSrcUpload: (src) => {

            console.log(src);

            return new Promise((resolve) => {
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

let toolbarOptions = [
    ['bold', 'italic', 'underline', 'strike'],
    [{'header': 1}, {'header': 2}, {'header': 3}],
    [{'list': 'ordered'}, {'list': 'bullet'}, {'indent': '+1'}, {'indent': '-1'}],
    ['align', 'color', 'background'],
    ['blockquote', 'code-block', 'link', 'image']
];

let quillOptions = {
    modules: {
        toolbar: toolbarOptions
    },
    theme: 'snow'
};

let editor = new Editor("#container", editorOptions, quillOptions);

let websocketEndpoint = "ws://localhost:8080";

let socket = new ReconnectingWebSocket(websocketEndpoint);
let connection = new ShareDB.Connection(socket);
let doc = connection.get("examples", "test-doc");

editor.syncDocument(doc);
