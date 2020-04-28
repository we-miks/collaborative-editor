import Quill from "quill";
import EditorEvents from "./editor-events";
const Delta = Quill.import("delta");

class ImageHandlers {
    constructor(editor) {
        this.editor = editor;

        this.imageUploadButtonHandler = this.imageUploadButtonHandler.bind(this);
        this.imageDropAndPasteHandler = this.imageDropAndPasteHandler.bind(this);
        this.clipboardMatchImageHandler = this.clipboardMatchImageHandler.bind(this);
    }

    imageDropAndPasteHandler(imageDataUrl, type) {

        let placeholderId = Math.ceil(Math.random() * 1000000);
        this.insertImagePlaceholder(placeholderId);
        this.previewInImagePlaceholder(placeholderId, imageDataUrl);

        let self = this;

        this.editor.options.image.handlers.imageDataURIUpload(imageDataUrl, type)
            .then((imageUrl) => {
                self.replaceImagePlaceholderWithImage(placeholderId, imageUrl);
            })
            .catch((err) => {
                self.removeImagePlaceholder(placeholderId);
                self.error(err);
            });
    }

    imageUploadButtonHandler() {
        let fileInput = document.createElement("input");
        fileInput.setAttribute('type', 'file');
        fileInput.setAttribute('accept', 'image/*')

        let self = this;

        fileInput.onchange = () => {

            let files = fileInput.files;
            if(files.length === 0) {
                return;
            }

            // Insert image placeholder

            let toolbarPlaceholderId = Math.ceil(Math.random() * 1000000);
            self.insertImagePlaceholder(toolbarPlaceholderId);

            self.readFileAsDataURI(files[0])
                .then((dataURI) => {
                    self.previewInImagePlaceholder(toolbarPlaceholderId, dataURI);

                    self.editor.options.image.handlers.imageDataURIUpload(dataURI)
                        .then((imageUrl) => {
                            self.replaceImagePlaceholderWithImage(toolbarPlaceholderId, imageUrl);
                        })
                        .catch((err) => {
                            self.removeImagePlaceholder(toolbarPlaceholderId);
                            self.error(err);
                        });

                })
                .catch((err) => {
                    self.error(err);
                    self.isToolbarUploading = false;
                });
        };

        fileInput.click();
    }

    clipboardMatchImageHandler(node, delta) {

        // node is the img element
        // delta is the inserting op for image

        let self = this;

        delta.ops.forEach((op) => {

            // Upload image and replace image url
            if(op.insert && op.insert.image) {
                let src = op.insert.image;

                let func;

                if(self.isDataURI(src)) {
                    func = self.editor.options.image.handlers.imageDataURIUpload;
                }else if(self.isImageSrc(src)) {
                    func = self.editor.options.image.handlers.imageSrcUpload;
                } else {
                    // Local files
                    // Browser has no access to local files
                    // So skip this file and send a message to editor
                    self.editor.dispatchEvent(EditorEvents.imageSkipped, src);
                    op.insert = "\n";
                }

                if(func) {
                    let placeholderId = Math.ceil(Math.random() * 1000000);

                    setTimeout(() => {
                        self.previewInImagePlaceholder(placeholderId, src);

                        func(src)
                            .then(
                                (imageUrl) => {
                                    self.replaceImagePlaceholderWithImage(placeholderId, imageUrl);
                                }).catch(
                            (err) => {
                                self.removeImagePlaceholder(placeholderId);
                                self.error(err);
                            });

                    }, 200);

                    delete op.insert.image;
                    op.insert.imagePlaceholder = placeholderId;
                }
            }

            // Remove image attributes
            op.attributes = {};
        });

        return delta;
    }

    insertImagePlaceholder(id) {
        let range = this.editor.quill.getSelection();

        let [line, offset] = this.editor.quill.getLine(range.index);

        let lineLength = line.length();

        let delta = new Delta().retain(range.index);

        if(offset !== 0) {
            // Non-empty line.
            // Insert image after text.
            // A line break must be put before image.
            delta = delta.insert("\n");
        }

        delta.insert({ imagePlaceholder: id});

        if(lineLength !== offset + 1) {
            delta = delta.insert("\n");
        }

        if(range.length !== 0) {
            delta = delta.delete(range.length);
        }

        this.editor.quill.updateContents(delta, "user");
        this.editor.quill.setSelection(range.index + 1);
    }

    removeImagePlaceholder(id) {
        // Find image placeholder, delete it and insert a new image
        let placeholderDomNode = document.getElementById("image-placeholder-" + id);

        if(placeholderDomNode) {

            // save selection
            let range = this.editor.quill.getSelection();

            let placeholderBlot = Quill.find(placeholderDomNode);
            let placeholderIndex = this.editor.quill.getIndex(placeholderBlot);
            let deleteDelta = new Delta().retain(placeholderIndex).delete(1);
            this.editor.quill.updateContents(deleteDelta, "user");

            // restore selection
            this.editor.quill.setSelection(range.index, range.length, "silent");

            return placeholderIndex;
        } else {
            return -1;
        }
    }

    previewInImagePlaceholder(id, src) {
        let placeholderDomNode = document.getElementById("image-placeholder-" + id);

        if(placeholderDomNode) {
            let img = document.createElement('img');
            placeholderDomNode.appendChild(img);
            img.src = src;
        }
    }

    replaceImagePlaceholderWithImage(placeholderId, imageSrc) {

        let self = this;

        setTimeout(() => {
            let index = self.removeImagePlaceholder(placeholderId);
            if(index !== -1) {
                setTimeout(() => {
                    // save selection
                    let range = self.editor.quill.getSelection();

                    let dt = new Delta();
                    dt.retain(index).insert({image: imageSrc});
                    self.editor.quill.updateContents(dt, "user");

                    // restore selection
                    self.editor.quill.setSelection(range.index, range.length, "silent");
                }, 100);
            }
        }, 1000);
    }

    isDataURI(src) {
        return /^data:image\/\w+;base64,/.test(src);
    }

    isImageSrc(src) {
        return /^https?/.test(src);
    }

    error(err) {
        this.editor.options.image.handlers.imageUploadError(err);
    }

    readFileAsDataURI(file) {

        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            if (!file) {
                reject("no file chosen...");
            }

            reader.addEventListener("load", function () {
                resolve(reader.result);
            }, false);

            reader.addEventListener("abort", function () {
                reject("aborted");
            }, false);

            reader.addEventListener("error", function (err) {
                reject(err);
            }, false);

            reader.readAsDataURL(file);
        });
    }
}

export default ImageHandlers;
