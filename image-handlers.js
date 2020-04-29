import Quill from "quill";
const Delta = Quill.import("delta");

class ImageHandlers {
    constructor(editor) {
        this.editor = editor;

        this.imageUploadButtonHandler = this.imageUploadButtonHandler.bind(this);
        this.imageDropAndPasteHandler = this.imageDropAndPasteHandler.bind(this);
    }

    imageDropAndPasteHandler(imageDataUrl, type) {

        let placeholderId = Math.ceil(Math.random() * 1000000);
        let deltaId = this.insertImagePlaceholder(placeholderId);
        this.previewInImagePlaceholder(placeholderId, imageDataUrl);

        let self = this;

        this.editor.options.image.handlers.imageDataURIUpload(imageDataUrl, type)
            .then((imageUrl) => {
                self.replaceImagePlaceholderWithImage(placeholderId, deltaId, imageUrl);
            })
            .catch((err) => {
                self.removeImagePlaceholder(placeholderId, deltaId);
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

            let toolbarPlaceholderId = Math.ceil(Math.random() * 1000000);

            // Insert image placeholder
            let deltaId = self.insertImagePlaceholder(toolbarPlaceholderId);

            self.readFileAsDataURI(files[0])
                .then((dataURI) => {
                    self.previewInImagePlaceholder(toolbarPlaceholderId, dataURI);

                    self.editor.options.image.handlers.imageDataURIUpload(dataURI)
                        .then((imageUrl) => {
                            self.replaceImagePlaceholderWithImage(toolbarPlaceholderId, deltaId, imageUrl);
                        })
                        .catch((err) => {
                            self.removeImagePlaceholder(toolbarPlaceholderId, deltaId);
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

    insertImagePlaceholder(id, index) {

        let range;

        if(!index) {
            range = this.editor.quill.getSelection();
            index = range.index;
        }

        let [line, offset] = this.editor.quill.getLine(index);

        let lineLength = line.length();

        let userDelta = new Delta().retain(index);
        let placeholderDelta = new Delta().retain(index);
        let placeholderRevertDelta = new Delta().retain(index);

        if(offset !== 0) {
            // Non-empty line.
            // Insert image after text.
            // A line break must be put before image.
            userDelta = userDelta.insert("\n");
            placeholderDelta = placeholderDelta.retain(1);
            placeholderRevertDelta = placeholderRevertDelta.retain(1);
        }

        // Add placeholder

        placeholderDelta = placeholderDelta.insert({ imagePlaceholder: id});
        placeholderRevertDelta = placeholderRevertDelta.delete(1);

        if(lineLength !== offset + 1) {
            userDelta = userDelta.insert("\n");
        }

        if(range && range.length !== 0) {
            userDelta = userDelta.delete(range.length);
        }

        this.editor.composition.updateQuill(userDelta, "user");

        let localDeltaId = this.editor.composition.addLocalOnlyDelta(placeholderDelta, placeholderRevertDelta);

        if(range) {
            this.editor.quill.setSelection(range.index + 1);
        }

        return localDeltaId;
    }

    removeImagePlaceholder(placeholderId, deltaId) {

        // save selection
        let range = this.editor.quill.getSelection();

        let step = this.editor.composition.removeLocalOnlyDelta(deltaId);

        // restore selection
        this.editor.quill.setSelection(range.index, range.length, "silent");

        return step.change;
    }

    previewInImagePlaceholder(id, src) {
        let placeholderDomNode = document.getElementById("image-placeholder-" + id);

        if(placeholderDomNode) {
            let img = document.createElement('img');

            img.onload = () => {
                placeholderDomNode.appendChild(img);
            };

            img.src = src;
        }
    }

    replaceImagePlaceholderWithImage(placeholderId, deltaId, imageSrc) {

        let self = this;

        setTimeout(() => {
            // preload image before add to editor
            let img = new Image();

            img.onload = () => {
                let changeDelta = self.removeImagePlaceholder(placeholderId, deltaId);

                setTimeout(() => {

                    // save selection
                    let range = self.editor.quill.getSelection();

                    for(let i=0; i<changeDelta.ops.length; i++) {
                        let op = changeDelta.ops[i];
                        if(op.insert && op.insert.imagePlaceholder) {
                            op.insert = {image: imageSrc};
                        }
                    }

                    self.editor.composition.updateQuill(changeDelta, "user");

                    // restore selection
                    self.editor.quill.setSelection(range.index, range.length, "silent");

                }, 1);
            };

            img.onerror = () => {
                self.removeImagePlaceholder(placeholderId, deltaId);
            };

            img.src = imageSrc;
        }, 1000);
    }

    isDataURI(src) {
        return /^data:image\/\w+;base64,/.test(src);
    }

    isImageSrc(src) {
        return /^https?|^\/\//.test(src);
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
