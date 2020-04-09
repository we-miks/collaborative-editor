import Quill from "quill";
const Delta = Quill.import("delta");
import config from '@/config';

import ImageAPI from '@/api/v3/image';
import QuillImageDropAndPaste from "quill-image-drop-and-paste";
import ImageResize from "miks-quill-image-resize-module";

import ImagePlaceholder from "./image-placeholder";

Quill.register('modules/imageDropAndPaste', QuillImageDropAndPaste);
Quill.register('modules/imageResize', ImageResize);

Quill.register(ImagePlaceholder);

let uploadImage = {
    data() {
        return {
            isToolbarUploading: false,
            toolbarPlaceholderId: -1
        };
    },
    methods: {
        imageButtonClickHandler () {
            $('#imgUploadBtn').trigger('click');
        },
        imageDropAndPasteHandler(imageDataUrl, type) {

            let placeholderId = Math.ceil(Math.random() * 1000000);
            this.insertImagePlaceholder(placeholderId);
            this.previewInImagePlaceholder(placeholderId, imageDataUrl);

            let self = this;

            ImageAPI.uploadImageWithDataURI(imageDataUrl, type)
                .then((images) => {

                    let index = self.removeImagePlaceholder(placeholderId);

                    if(index !== -1) {
                        let delta = new Delta().retain(index).insert({image: images[0].image_url});
                        this.editor.updateContents(delta, "user");
                    }

                })
                .catch((err) => {
                    console.log(err);
                    self.removeImagePlaceholder(placeholderId);
                    self.$message.error("图片上传出错，请稍后再试...");
                });
        },
        onBeforeImageUpload(file) {
            let isLt5M = file.size / 1024 / 1024 < 5;
            if (!isLt5M) {
                this.$message.error('上传图片大小不能超过 5MB');
                return false;
            }

            if (this.isToolbarUploading) {
                this.$message.error('请等待上传完成');
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
        },
        onImageUploadSuccess(response) {
            // Find image placeholder, delete it and insert a new image
            this.replaceImagePlaceholderWithImage(this.toolbarPlaceholderId, response.data[0].image_url)

            this.isToolbarUploading = false;
        },
        onImageUploadError(err) {
            console.log(err);
            this.$message.error("图片上传出错，请稍后再试...");
            this.isToolbarUploading = false;
        },
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
                        func = ImageAPI.uploadImageWithDataURI;
                    } else if(self.isLocalFile(src)) {
                        // Browser has no access to local files
                        // So remove this file and show a message to user
                        self.$message.error("有些图片无法自动上传，请尝试使用工具栏的上传按钮手工上传");

                        op.insert = "\n";
                    } else if(self.isExternalImageSrc(src)) {
                        func = ImageAPI.uploadImageWithExternalSrc;
                    }

                    if(func) {
                        let placeholderId = Math.ceil(Math.random() * 1000000);

                        setTimeout(() => {
                            self.previewInImagePlaceholder(placeholderId, src);

                            func(src).then(
                                (image) => {
                                    self.replaceImagePlaceholderWithImage(placeholderId, image.image_url);
                                }).catch(
                                (err) => {
                                    console.log(err);
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
        },

        insertImagePlaceholder(id) {
            let range = this.editor.getSelection();

            let [line, offset] = this.editor.getLine(range.index);

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

            this.editor.updateContents(delta, "user");
            this.editor.setSelection(range.index + 1);
        },
        removeImagePlaceholder(id) {
            // Find image placeholder, delete it and insert a new image
            let placeholderDomNode = document.getElementById("image-placeholder-" + id);

            if(placeholderDomNode) {
                let placeholderBlot = Quill.find(placeholderDomNode);
                let placeholderIndex = this.editor.getIndex(placeholderBlot);
                let deleteDelta = new Delta().retain(placeholderIndex).delete(1);
                this.editor.updateContents(deleteDelta, "user");

                return placeholderIndex;
            } else {
                return -1;
            }
        },
        previewInImagePlaceholder(id, src) {
            let placeholderDomNode = document.getElementById("image-placeholder-" + id);

            if(placeholderDomNode) {
                let img = document.createElement('img');
                placeholderDomNode.appendChild(img);
                img.src = src;
            }
        },
        replaceImagePlaceholderWithImage(placeholderId, imageSrc) {
            let index = this.removeImagePlaceholder(placeholderId);
            if(index !== -1) {
                let dt = new Delta();
                dt.retain(index).insert({image: imageSrc});
                this.editor.updateContents(dt, "user");
            }
        },
        isExternalImageSrc(src) {
            return -1 === src.search(config.internal_image_domain);
        },
        isDataURI(src) {
            return /^data:image\/\w+;base64,/.test(src);
        },
        isLocalFile(src) {
            return /^file/.test(src);
        }
    }
};

export default uploadImage;
