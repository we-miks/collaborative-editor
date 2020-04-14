import Quill from "quill";

import 'quill/dist/quill.bubble.css'
import 'quill/dist/quill.core.css'
import Authorship from "./authorship";
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

// For icons of header value 3
const icons = Quill.import('ui/icons');
icons['header'][3] = require('!html-loader!quill/assets/icons/header-3.svg');

class Editor {

    constructor(container, editorOptions, quillOptions) {

        this.options = editorOptions;

        this.imageHandlers = new ImageHandlers(this);

        let options = this.mergeQuillOptions(quillOptions);
        this.quill = new Quill(container, options);

        this.composition = new Composition(this);
        this.synchronizer = new Synchronizer(this, this.composition);
        this.composition.setSynchronizer(this.synchronizer);

        this.authorship = new Authorship(this, this.composition, editorOptions);

        let self = this;

        this.quill.on('text-change', function(delta, oldDelta, source) {

            if(source !== 'user')
                return;

            // Text change should only be processed by Composition and then send to others by our own event system.
            self.composition.submitToUpstream(delta, oldDelta, source);
        });

        // Add image upload toolbar button handler
        this.quill.getModule("toolbar").addHandler('image', this.imageHandlers.imageUploadButtonHandler);
    }

    mergeQuillOptions(options) {

        let self = this;

        return lodashObject.merge(options, {
            modules: {
                imageDropAndPaste: {
                    handler: self.imageHandlers.imageDropAndPasteHandler
                },
                clipboard: {
                    matchers: [
                        ['img', self.imageHandlers.clipboardMatchImageHandler]
                    ]
                }
            }
        });
    }

    syncDocument(shareDBDocument) {
        this.synchronizer.syncShareDBDocument(shareDBDocument);
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
