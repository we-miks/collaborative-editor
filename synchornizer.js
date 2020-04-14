import EditorEvents from "./editor-events";

class Synchronizer  {
    constructor (editor, composition) {
        this.editor = editor;

        this.doc = null;
        this.debug = false;
        this.composition = composition;
    }

    submitDeltaToUpstream(delta) {
        this.doc.submitOp(delta, {source: 'user'});
    }

    syncShareDBDocument(shareDBDocument) {

        this.close();

        this.doc = shareDBDocument;

        let self = this;

        shareDBDocument.subscribe(function(err) {
            if (err) {
                self.log(err);
                return;
            }

            self.editor.dispatchEvent(EditorEvents.beforeSync, shareDBDocument);

            self.composition.setEditorContent(self.doc.data);

            shareDBDocument.on('op', function(delta, source) {

                if(source !== 'api')
                    return;

                self.composition.submitToEditor(delta);
            });

            shareDBDocument.on('del', function() {

                // The doc has been deleted.
                // Local session should be terminated.
                self.close();
                self.editor.dispatchEvent(EditorEvents.documentDeleted, shareDBDocument);
            });
        });
    }

    close() {
        if(this.doc) {
            this.doc.destroy();
            this.doc = null;
        }
    }

    log(msg){
        if(!this.debug)
        {
            return;
        }

        console.log(msg);
    }
}

export default Synchronizer;
