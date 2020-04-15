# Miks Collaborative Editor
[中文](./README_CN.md) | [English](./README.md)

A collaborative editor that supports authorship display, image placeholder and CJK characters composition based on Quill and ShareDB.

## Features

### Operational transformation (OT)

The document is represented by a collection of operations: ```insert```, ```delete``` and ```retain```.
Each modification of the document can also be represented by a serials of OT operations. By doing so, it is easy to
record all the modification history of a document, and to merge modifications from different collaborators into one.

For a detailed explanation of OT, please refer to [this document](http://operational-transformation.github.io/).

In our implementation, the document, which is a collection of OT operations, is stored on the server side using
[ShareDB](https://github.com/share/sharedb), and served to the frontend using WebSocket API. ShareDB deals with
the versioning of operations and handles the merging of them from different clients.

[Quill](https://github.com/quilljs/quill) editor on the client side receives the operations,
or [Delta](https://github.com/quilljs/delta) as it claims, and renders them into HTML using a virtual DOM like tech
called [Parchment](https://github.com/quilljs/parchment), which transforms operations into a hierarchy of Blots that
represent paragraphs, texts and images. The Blots are converted to HTML and inserted into the webpage in the end.

Blots listen for the mutation records from the browser, and transforms the records into Delta. Quill sends the Delta to
ShareDB to be merged and saved.

### Authorship display

In the collaborative editing context, we often want to see the author of a certain paragraph, a sentence or even a word
to be displayed along with the text. In our implementation, the author's id is recorded inside the document as class
attributes. As the user typing in, the author's id is added automatically.

When there're more than 1 author inside the document, we will show a sidebar to display the author's name in a paragraph
level. The author of a paragraph is decided by counting the number of characters that belongs to this author inside the
paragraph.

We do not show authors information in the sentence level. However, it could be easily implemented using CSS.

### Chinese/Japanese/Korean characters composition

For languages that requires composition such as Chinese, some temporary characters might be put into the editor by the
composition tools during the composition process, at the end of the composition progress, the temp chars are deleted,
and the real characters are inserted.

In the collaboration environment, during a composition process, there might be changes from other clients that are
pushed to our editor, and changes the html when applied. The modification of the html elements during a composition
process will break the mutation records and lead to the editor producing wrong Deltas.

We fix this issue by pausing the applying of deltas from upstream server and at the end of the composition process
merge the pending upstream deltas with the real characters from composition.

The temp characters during the composition process will not be uploaded to the server so that the modification history
will not become a mess.

### Image uploading placeholder

When uploading images, there will be a placeholder showing the image (read from local file) and loading status. When
the image is successfully uploaded, the image placeholder will be replaced with the uploaded one.

There're 3 ways user might insert image into the editor: the toolbar button, drag'n'drop from file explorer,
and copy'n'paste from other web pages or applications. Which are all taken good care of. The only thing left to do for
the developers is to implement the uploading handler, uploads the image to the server and returns an image URL.

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
