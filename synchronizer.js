import EditorEvents from "./editor-events";
import ReconnectingWebSocket from "reconnecting-websocket";
import ShareDB from "sharedb/lib/client";

class Synchronizer  {
    constructor (editor, composition) {
        this.editor = editor;

        this.doc = null;
        this.debug = false;
        this.composition = composition;
        this.heartbeat = null;

        this.socket = null;
    }

    submitDeltaToUpstream(delta) {
        this.doc.submitOp(delta, {source: 'user'});
    }

    syncThroughWebsocket(endpoint, collection, docId) {

        this.close();

        this.socket = new ReconnectingWebSocket(endpoint);

        let connection = new ShareDB.Connection(this.socket);

        this.syncShareDBDocument(connection.get(collection, docId));

        // Send heartbeat message to keep websocket connection alive

        let self = this;

        this.socket.addEventListener("open", () => {
            self.heartbeat = setInterval(() => {
                self.socket.send('{"a":"hs"}');
            }, 5000);
        });

        this.socket.addEventListener("close", () => {
            clearInterval(self.heartbeat);
        });

        return this.socket;
    }

    syncShareDBDocument(shareDBDocument) {

        this.doc = shareDBDocument;

        let self = this;

        shareDBDocument.subscribe(function(err) {
            if (err) {
                self.log(err);
                throw err;
            }

            if(self.doc.type === null) {
                throw new Error("doc does not exist.");
            }

            self.editor.dispatchEvent(EditorEvents.beforeSync, shareDBDocument);

            self.composition.setEditorContent(self.doc.data);

            shareDBDocument.on('op', function(delta, source) {

                if(source === 'user')
                    return;

                if(!delta.ops || delta.ops.length === 0)
                    return;

                self.composition.submitToEditor(delta);
            });

            shareDBDocument.on('del', function() {

                // The doc has been deleted.
                // Local session should be terminated.
                self.close();
                self.editor.dispatchEvent(EditorEvents.documentDeleted, shareDBDocument);
            });

            shareDBDocument.on('error', function(err) {
                self.editor.dispatchEvent(EditorEvents.synchronizationError, err);
            });

            // Initialize history recording
            self.editor.quill.getModule("history").init(self.editor);

            self.editor.dispatchEvent(EditorEvents.documentLoaded, shareDBDocument);
        });
    }

    close() {
        if(this.doc) {
            this.doc.destroy();
            this.doc = null;
        }

        if(this.socket) {
            this.socket.close();
            this.socket = null;
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
