import Quill from "quill";
const Delta = Quill.import("delta");

class ImageHandlers {
    constructor(editor) {
        this.editor = editor;

        this.imageUploadButtonHandler = this.imageUploadButtonHandler.bind(this);
        this.imageDropAndPasteHandler = this.imageDropAndPasteHandler.bind(this);
    }

    imageDropAndPasteHandler(imageDataUrl, type) {

        this.handleContentChangeForImage().then((imageIndex) => {
            let placeholderId = Math.ceil(Math.random() * 1000000);
            let deltaId = this.insertImagePlaceholder(placeholderId, imageIndex);

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
        })
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

            this.handleContentChangeForImage().then((imageIndex) => {
                let placeholderId = Math.ceil(Math.random() * 1000000);
                let deltaId = self.insertImagePlaceholder(placeholderId, imageIndex);

                self.readFileAsDataURI(files[0])
                    .then((dataURI) => {
                        self.previewInImagePlaceholder(placeholderId, dataURI);

                        self.editor.options.image.handlers.imageDataURIUpload(dataURI)
                            .then((imageUrl) => {
                                self.replaceImagePlaceholderWithImage(placeholderId, deltaId, imageUrl);
                            })
                            .catch((err) => {
                                self.removeImagePlaceholder(placeholderId, deltaId);
                                self.error(err);
                            });

                    })
                    .catch((err) => {
                        self.error(err);
                    });
            });
        };

        fileInput.click();
    }

    insertImagePlaceholder(id, index) {

        let placeholderDelta = new Delta().retain(index);
        let placeholderRevertDelta = new Delta().retain(index);

        placeholderDelta = placeholderDelta.insert({ imagePlaceholder: id});
        placeholderRevertDelta = placeholderRevertDelta.delete(1);

        return this.editor.composition.addLocalOnlyDelta(placeholderDelta, placeholderRevertDelta);
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

    replaceImagePlaceholderWithImage(placeholderId, deltaId, imageSrc, appliedDeltas) {

        let self = this;

        setTimeout(() => {
            // preload image before add to editor
            let img = new Image();

            img.onload = () => {
                let changeDelta = self.removeImagePlaceholder(placeholderId, deltaId);

                // save selection
                let range = self.editor.quill.getSelection();

                for(let i=0; i<changeDelta.ops.length; i++) {
                    let op = changeDelta.ops[i];
                    if(op.insert && op.insert.imagePlaceholder) {
                        op.insert = {image: imageSrc};
                    }
                }

                if(typeof(appliedDeltas) !== 'undefined') {
                    if(appliedDeltas && appliedDeltas.length !== 0) {

                        let composedAppliedDelta = new Delta();

                        appliedDeltas.forEach((delta) => {
                            composedAppliedDelta = composedAppliedDelta.compose(delta);
                        });

                        changeDelta = composedAppliedDelta.transform(changeDelta, true);
                    }

                    appliedDeltas.push(changeDelta);
                }

                self.editor.composition.updateQuill(changeDelta, "user");

                // restore selection
                self.editor.quill.setSelection(range.index, range.length, "silent");

            };

            img.onerror = () => {
                self.removeImagePlaceholder(placeholderId, deltaId);
            };

            img.src = imageSrc;
        }, 1000);
    }

    handleContentChangeForImage() {

        let self = this;

        return new Promise((resolve, reject) => {
            let range = self.editor.quill.getSelection();
            let [line, offset] = self.editor.quill.getLine(range.index);

            let lineLength = line.length();

            let userDelta = new Delta().retain(range.index);

            let imageIndex = range.index;

            if(offset !== 0) {
                // Non-empty line.
                // Insert image after text.
                // A line break must be put before image.
                userDelta = userDelta.insert("\n");
                imageIndex = imageIndex + 1;
            }

            if(lineLength !== offset + 1) {
                userDelta = userDelta.insert("\n");
            }

            if(range.length !== 0) {
                userDelta = userDelta.delete(range.length);
            }

            // apply userDelta
            self.editor.quill.updateContents(userDelta, "user");

            // restore selection
            self.editor.quill.setSelection(range.index, 0, "silent");

            setTimeout(() => {
                resolve(imageIndex);
            }, 1);
        });
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
