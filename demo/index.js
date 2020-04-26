import Editor from "../editor";
import 'quill/dist/quill.snow.css'
import EditorEvents from "../editor-events";

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

                console.log(dataURI);

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
            }
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

editor.on(EditorEvents.imageSkipped, ()=>{
    console.log("image skipped");
});

let websocketEndpoint = "ws://127.0.0.1:8080";

editor.syncThroughWebsocket(websocketEndpoint, "examples", "test-doc");
