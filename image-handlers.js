import Quill from "quill";
const Delta = Quill.import("delta");

class ImageHandlers {
    constructor(editor) {
        this.editor = editor;

        this.isToolbarUploading = false;
        this.toolbarPlaceholderId = -1;

        let self = this;

        this.editor.on("toolbarBeforeImageUpload", function(file){
            self.onBeforeImageUpload(file);
        });

        this.editor.on("toolbarImageUploadSuccess", function(imageUrl){
            self.onImageUploadSuccess(imageUrl);
        });

        this.editor.on("toolbarImageUploadError", function(err){
            self.onImageUploadError(err);
        });
    }

    imageDropAndPasteHandler(imageDataUrl, type) {

        let placeholderId = Math.ceil(Math.random() * 1000000);
        this.insertImagePlaceholder(placeholderId);
        this.previewInImagePlaceholder(placeholderId, imageDataUrl);

        let self = this;

        this.editor.options.handlers.imageDataURIUploadHandler(imageDataUrl, type)
            .then((imageUrl) => {

                let index = self.removeImagePlaceholder(placeholderId);

                if(index !== -1) {
                    let delta = new Delta().retain(index).insert({image: imageUrl});
                    self.editor.quill.updateContents(delta, "user");
                }

            })
            .catch((err) => {
                self.removeImagePlaceholder(placeholderId);
                self.error(err);
            });
    }

    onBeforeImageUpload(file) {

        if (this.isToolbarUploading) {
            this.error("请等待上传完成");
            return false;
        }

        // Insert image placeholder
        this.isToolbarUploading = true;
        this.toolbarPlaceholderId = Math.ceil(Math.random() * 1000000);
        this.insertImagePlaceholder(this.toolbarPlaceholderId);

        // Load image preview

        const reader = new FileReader();

        let self = this;

        reader.addEventListener("load", function () {

            self.previewInImagePlaceholder(self.toolbarPlaceholderId, reader.result);

        }, false);

        if (file) {
            reader.readAsDataURL(file);
        }

        return true;
    }

    onImageUploadSuccess(imageUrl) {
        // Find image placeholder, delete it and insert a new image
        this.replaceImagePlaceholderWithImage(this.toolbarPlaceholderId, imageUrl);
        this.isToolbarUploading = false;
    }

    onImageUploadError(err) {
        console.log(err);
        this.error("图片上传出错，请稍后再试...");
        this.isToolbarUploading = false;
    }

    clipboardMatchImageHandler(node, delta) {

        // node is the img element
        // delta is the inserting op for image

        let self = this;

        delta.ops.forEach((op) => {

            // Upload image and replace image url
            if(op.insert && op.insert.image) {
                let src = op.insert.image;

                if(self.isDataURI(src)) {

                    let placeholderId = Math.ceil(Math.random() * 1000000);

                    setTimeout(() => {
                        self.previewInImagePlaceholder(placeholderId, src);

                        self.editor.options.handlers.imageDataURIUploadHandler(src)
                            .then(
                                (imageUrl) => {
                                    self.replaceImagePlaceholderWithImage(placeholderId, imageUrl);
                                }).catch(
                                (err) => {
                                    self.error(err);
                                });

                    }, 200);

                    delete op.insert.image;
                    op.insert.imagePlaceholder = placeholderId;

                } else {
                    // Browser has no access to local files
                    // So remove this file and show a message to user
                    self.error("有些图片无法自动上传，请尝试使用工具栏的上传按钮手工上传");
                    op.insert = "\n";
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
            let placeholderBlot = Quill.find(placeholderDomNode);
            let placeholderIndex = this.editor.quill.getIndex(placeholderBlot);
            let deleteDelta = new Delta().retain(placeholderIndex).delete(1);
            this.editor.quill.updateContents(deleteDelta, "user");

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
        let index = this.removeImagePlaceholder(placeholderId);
        if(index !== -1) {
            let dt = new Delta();
            dt.retain(index).insert({image: imageSrc});
            this.editor.quill.updateContents(dt, "user");
        }
    }

    isDataURI(src) {
        return /^data:image\/\w+;base64,/.test(src);
    }

    error(err) {
        this.editor.options.handlers.imageUploadErrorHandler(err);
    }
}

export default ImageHandlers;
