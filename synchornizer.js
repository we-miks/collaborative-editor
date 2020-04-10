import ReconnectingWebSocket from "reconnecting-websocket";
import sharedb from 'sharedb/lib/client';

class Synchronizer  {
    constructor () {
        this.socket = null;
        this.connection = null;
        this.doc = null;
        this.debug = false;
        this.composition = null;
        this.closed = true;
        this.upstreamDeltaHandler = null;
    }

    submitDeltaToUpstream(delta) {
        this.doc.submitOp(delta, {source: 'user'});
    }

    onUpstreamDelta(handler) {
        this.upstreamDeltaHandler = handler;
    }

    syncDraft(draftId) {

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
                self.onUpstreamDelta(delta);
            });

            self.doc.on('del', function() {
                // The draft has been published.
                // Local session should be terminated.
                self.close();
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

export default Synchronizer;
