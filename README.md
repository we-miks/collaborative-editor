# Miks Collaborative Editor
[中文](./README_CN.md) | [English](./README.md)

A collaborative editor that supports authorship display, image placeholder and CJK characters composition based on Quill and ShareDB.

## Features

### Operational transformation (OT)

### Authorship display

### Chinese/Japanese/Korean characters composition

### Image placeholder

## Getting Started

***Installation***

```bash
$ npm install --save miks-collaborative-editor
```

***Configuration***

```javascript
import Editor from "miks-collaborative-editor";
import 'quill/dist/quill.snow.css'
import ReconnectingWebSocket from "reconnecting-websocket";
import ShareDB from "sharedb/lib/client";

// The current user's info, must contain both id and name field. 
let author = {
    id: 10,
    name: 'Main Author'
};

let editorOptions = {
    authorship: {
        author: author,
        
        // The color used to highlight current user's paragraphs.
        authorColor: '#ed5634', 
        
        // The colors used to highlight other authors' paragraphs.
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

            // Used to fetch a user's name when we find the id of the user
            // in the content.
            // Should always return a promise
            getAuthorInfoById: (authorId) => {
                return new Promise((resolve, reject) => {

                    let author = {
                        id: 12345,
                        name: 'Another author'
                    };

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


            // Upload image in DataURI format to the server
            // and return a URL to be used in the editor.
            // Should always return a promise
            imageDataURIUpload: (dataURI) => {

                console.log(dataURI);

                return new Promise((resolve) => {
                    resolve('https://yd.wemiks.com/banner-2d980584-yuanben.svg');
                });
            },

            // Send a external image url to the server
            // and return a URL in our own domain..
            // Usually we don't want to keep the external image src in the
            // editor and instead want to fetch it and save it on our own server.
            // Should always return a promise
            imageSrcUpload: (src) => {

                console.log(src);

                return new Promise((resolve) => {
                    resolve('https://yd.wemiks.com/banner-2d980584-yuanben.svg');
                });
            },
            
            // Handle the display of image upload errors.
            imageUploadError: (err) => {
                console.log("image upload error: " + err);
            }
        }
    }
};

// The editor toolbar configuration in the exact format as Quill
// https://quilljs.com/docs/modules/toolbar/
// Note that image upload button handling is already included
// no extra setup is required beyond the implementation of
// the image upload handlers above.
let toolbarOptions = [
    ['bold', 'italic', 'underline', 'strike'],
    [{'header': 1}, {'header': 2}, {'header': 3}],
    [{'list': 'ordered'}, {'list': 'bullet'}, {'indent': '+1'}, {'indent': '-1'}],
    ['align', 'color', 'background'],
    ['blockquote', 'code-block', 'link', 'image']
];

// Quill options
// Customize it as you want, just remember not to alter the handlers related
// to image uploading, clipboard image pasting and image drag'n'drop.
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

```

## Development

Node modules should be installed first:

```bash
$ npm install
```

There's a demo included in this repository to load the editor,
which could also be used to do the development. The demo is located under ```demo``` directory.

First of all we need to start the server side websocket api so that our
editor could connect to it and start running. A functional server side script
is already included in the ```server``` directory.

```bash
$ node server/server.js
```

Running above command will start the websocket server on port 9001.

Then we could start the demo using webpack:

```bash
$ npm start
```

Now you should be able to see a webpage popup with a loaded editor.

Don't hesitate! Submit your PR!
