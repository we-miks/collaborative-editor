import Quill from "quill";
import EditorEvents from "../editor-events";
const Clipboard = Quill.import("modules/clipboard");
const Delta = Quill.import("delta");

class MiksClipboard extends Clipboard {

    setEditor(editor) {
        this.editor = editor;
    }

    onPaste(e) {
        if (e.defaultPrevented || !this.quill.isEnabled()) return;

        let scrollTop = this.quill.scrollingContainer.scrollTop;

        let range = this.quill.getSelection();

        this.container.focus();
        this.quill.selection.update(Quill.sources.SILENT);

        setTimeout(() => {
            // selected text should be deleted first
            if(range.length !== 0) {
                let delta = new Delta().retain(range.index).delete(range.length);
                this.quill.updateContents(delta, "user");
            }

            let self = this;

            setTimeout(() => {

                let delta = new Delta().retain(range.index);
                delta = delta.concat(this.convert());

                let index = 0;

                delta.ops.forEach((op) => {
                    if(op.retain) {
                        index = index + op.retain;
                    } else if (op.insert) {
                        if(typeof(op.insert) === 'string') {
                            index = index + op.insert.length;
                        }else if(op.insert.image) {

                            let src = op.insert.image;
                            let imgIdx = index;

                            setTimeout(() => {
                                self.insertImageAtIndex(imgIdx, src);
                            }, 1);

                            op.insert = "\n";

                            index = index + 1;
                        } else {
                            index = index + 1;
                        }
                    }
                });

                this.editor.composition.updateQuill(delta, Quill.sources.USER);

                this.quill.setSelection(delta.length() - range.length, Quill.sources.SILENT);
                this.quill.scrollingContainer.scrollTop = scrollTop;
                this.quill.focus();
            }, 1);
        }, 1);
    }

    insertImageAtIndex(index, src) {

        let func;
        let imageHandlers = this.editor.imageHandlers;

        if(imageHandlers.isDataURI(src)) {
            func = this.editor.options.image.handlers.imageDataURIUpload;
        }else if(imageHandlers.isImageSrc(src)) {
            func = this.editor.options.image.handlers.imageSrcUpload;
        } else {
            // Local files
            // Browser has no access to local files
            // So skip this file and send a message to editor
            this.editor.dispatchEvent(EditorEvents.imageSkipped, src);
        }

        if(func) {

            let placeholderId = Math.ceil(Math.random() * 1000000);

            let deltaId = imageHandlers.insertImagePlaceholder(placeholderId, index);

            setTimeout(() => {
                imageHandlers.previewInImagePlaceholder(placeholderId, src);

                func(src)
                    .then(
                        (imageUrl) => {
                            imageHandlers.replaceImagePlaceholderWithImage(placeholderId, deltaId, imageUrl);
                        }).catch(
                    (err) => {
                        imageHandlers.removeImagePlaceholder(placeholderId, deltaId);
                        imageHandlers.error(err);
                    });

            }, 200);
        }
    }
}

export default MiksClipboard;
