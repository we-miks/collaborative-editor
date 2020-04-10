import Editor from "../editor";
import 'quill/dist/quill.snow.css'

let bindings = {
    'list autofill': {
        prefix: /^\s*(0{1,1}\.|\*)$/
    }
};

let author = {
    id: '',
    name: ''
};

let users = [
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

let editorOptions = {
    author: author,
    handlers: {
        imageFileUploadHandler: () => {
            // Upload file
        },
        imageDataURIUploadHandler: () => {
            // Upload image DataURI
        },
        imageUploadErrorHandler: (err) => {

        },
        getUserInfo: (userId) => {
            return new Promise((resolve, reject) => {

                let user = users[userId];

                if(user) {
                    resolve(user);
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

let doc = null;

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
