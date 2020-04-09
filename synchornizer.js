import ReconnectingWebSocket from "reconnecting-websocket";
import sharedb from 'sharedb/lib/client';
import DraftAPI from '@/api/v3/draft';

class ContentSynchronizer  {
    constructor () {
        this.socket = null;
        this.connection = null;
        this.doc = null;
        this.debug = false;
        this.composition = null;
        this.closed = true;

        this.onSyncContentHandlers = [];
        this.onDraftDeletedHandlers = [];
    }

    setEditor(editor) {
        this.editor = editor;
        this.initEditorListener();
    }

    setComposition(composition) {
        this.composition = composition;
    }

    initEditorListener() {

        let self = this;

        this.editor.on('text-change', function(delta, oldDelta, source) {

            if(!self.doc || self.closed)
                return;

            let serial = Math.ceil(Math.random() * 1000);

            self.log("[" + serial + "] Submit changes to server...");
            self.log("[" + serial + "] The source is " + source);
            self.log("[" + serial + "] " + JSON.stringify(delta));

            if (source !== 'user')
            {
                self.log("[" + serial + "] " +  "The source is not user. Skip.");
                return;
            }

            if(self.composition.isComposing()) {
                self.log("pending op: " + JSON.stringify(delta));
                self.composition.addPendingSubmitDelta(delta);
            } else {
                self.log("submitting op: " + JSON.stringify(delta));
                self.doc.submitOp(delta, {source: "user"});
            }

            self.log("[" + serial + "] " +  "Submit finished.")
        });
    }

    onSyncContent(handler) {
        this.onSyncContentHandlers.push(handler);
    }

    onDraftDeleted(handler) {
        this.onDraftDeletedHandlers.push(handler);
    }

    syncDraft(draftId) {

        this.onSyncContentHandlers.forEach((handler) => {
            handler(draftId);
        });

        this.close();

        this.socket = new ReconnectingWebSocket(DraftAPI.WebSocketSyncContent(draftId));
        this.connection = new sharedb.Connection(this.socket);
        this.doc = this.connection.get(draftId, 'richtext');

        this.composition.setDoc(this.doc);

        this.closed = false;

        let self = this;

        this.doc.subscribe(function(err) {
            if (err) {
                self.log(err);
                return;
            }

            self.editor.setContents(self.doc.data);

            self.doc.on('op', function(delta, source) {

                self.log("received delta: " + JSON.stringify(delta.ops));

                let serial = Math.ceil(Math.random() * 1000);

                self.log("[" + serial + "] Received OP on WebSocket");
                self.log("[" + serial + "] The source is " + source);
                self.log("[" + serial + "] " + JSON.stringify(delta));

                if (source === "user")
                {
                    self.log("[" + serial + "] The source is user. Skip.");
                    return;
                }

                if(self.composition.isComposing()) {
                    self.composition.addUpstreamPendingDelta(delta);
                } else {
                    self.editor.updateContents(delta, source);
                }
            });

            self.doc.on('del', function() {
                // The draft has been published.
                // Local session should be terminated.
                self.close();

                self.onDraftDeletedHandlers.forEach((handler) => {
                    handler(draftId);
                });
            });
        })
    }

    close() {
        if(this.doc)
            this.doc.destroy();

        if(this.connection)
            this.connection.close();

        if(this.socket)
            this.socket.close();

        this.closed = true;
    }

    log(msg){
        if(!this.debug)
        {
            return;
        }

        console.log(msg);
    }
}

export default ContentSynchronizer;
