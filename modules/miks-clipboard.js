import Quill from "quill";
import EditorEvents from "../editor-events";
import normalizeUrl from "normalize-url";
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

        let appliedDeltas = [];

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
                            self.insertImageAtIndex(imgIdx, src, appliedDeltas);
                        }, 1);

                        delete op.attributes;
                        op.insert = "";
                    } else {
                        index = index + 1;
                    }
                }
            });

            this.editor.quill.updateContents(delta, Quill.sources.USER);

            this.quill.setSelection(delta.length() - range.length, Quill.sources.SILENT);
            this.quill.scrollingContainer.scrollTop = scrollTop;
            this.quill.focus();
        }, 1);
    }

    insertImageAtIndex(index, src, appliedDeltas) {

        let func;
        let imageHandlers = this.editor.imageHandlers;

        let normalizedSrc = normalizeUrl(src)

        if(imageHandlers.isDataURI(normalizedSrc)) {
            func = this.editor.options.image.handlers.imageDataURIUpload;
        }else if(imageHandlers.isImageSrc(normalizedSrc)) {
            func = this.editor.options.image.handlers.imageSrcUpload;
        } else {
            // Local files
            // Browser has no access to local files
            // So skip this file and send a message to editor
            this.editor.dispatchEvent(EditorEvents.imageSkipped, normalizedSrc);
        }

        if(func) {

            let placeholderId = Math.ceil(Math.random() * 1000000);

            let deltaId = imageHandlers.insertImagePlaceholder(placeholderId, index);

            setTimeout(() => {
                imageHandlers.previewInImagePlaceholder(placeholderId, normalizedSrc);

                func(normalizedSrc)
                    .then(
                        (imageUrl) => {
                            imageHandlers.replaceImagePlaceholderWithImage(placeholderId, deltaId, imageUrl, appliedDeltas);
                        }).catch(
                    (err) => {
                        imageHandlers.removeImagePlaceholder(placeholderId, deltaId);
                        imageHandlers.error(err);
                    });

            }, 1);
        }
    }
}

export default MiksClipboard;
