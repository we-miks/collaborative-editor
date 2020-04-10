import Quill from "quill";

import 'quill/dist/quill.bubble.css'
import 'quill/dist/quill.core.css'
import Authorship from "./modules/quill-authorship";
import ImageHandlers from "./image-handlers";
import Composition from "./composition";
import shareDB from "sharedb/lib/client";
import richText from "rich-text";
shareDB.types.register(richText.type);
import lodashObject from "lodash/fp/object";

import QuillImageDropAndPaste from "quill-image-drop-and-paste";
import ImagePlaceholder from "./blot/image-placeholder";
import Synchronizer from "./synchornizer";

Quill.register('modules/imageDropAndPaste', QuillImageDropAndPaste);

Quill.register(ImagePlaceholder);
Quill.register("modules/authorship", Authorship);

class Editor {

    constructor(container, editorOptions, quillOptions) {

        let options = this.mergeQuillOptions(quillOptions);

        this.quill = new Quill(container, options);
        this.options = editorOptions;

        this.imageHandlers = new ImageHandlers(this);
        this.composition = new Composition(this);
        this.synchronizer = new Synchronizer(this.composition);

        let self = this;

        this.quill.on('text-change', function(delta, oldDelta, source) {

            if(source !== 'user')
                return;

            // Text change should only be processed by Composition and then send to others by our own event system.
            self.composition.submitToUpstream(delta, oldDelta, source);
        });
    }

    mergeQuillOptions(options) {

        return lodashObject.merge(options, {
            modules: {
                imageDropAndPaste: {
                    handler: this.imageHandlers.imageDropAndPasteHandler
                },
                clipboard: {
                    matchers: [
                        ['img', this.imageHandlers.clipboardMatchImageHandler]
                    ]
                },
                authorship: {
                    author: this.options.author
                }
            }
        });
    }

    syncDocument(doc) {
        this.doc = doc;
    }

    submitLocalDelta(delta, source) {
        this.quill.updateContents(delta, source);
    }

    submitUpstreamDelta(delta, source) {
        this.doc.submitOp(delta, {source: source});
    }

    eventHandlers = {};

    on(event, handler) {

        let handlerId = Math.ceil(Math.random() * 10000);

        if(!this.eventHandlers[event]) {
            this.eventHandlers[event] = {};
        }

        this.eventHandlers[event][handlerId] = handler;

        return handlerId;
    }

    off(event, handlerId) {
        if(this.eventHandlers[event] && this.eventHandlers[event][handlerId]) {
            delete this.eventHandlers[event][handlerId];
        }
    }

    dispatchEvent(event, payload) {
        if(this.eventHandlers[event]) {
            Object.keys(this.eventHandlers[event]).forEach((handlerId) => {
                let handler = this.eventHandlers[event][handlerId];
                handler(payload);
            });
        }
    }
}

export default Editor;
