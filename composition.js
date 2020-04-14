import Quill from "quill";
const Delta = Quill.import("delta");

class Composition {
    constructor(editor) {

        this.editor = editor;
        this.quill = editor.quill;
        this.synchronizer = null;
        this.compositionStatus = false;

        let self = this;

        this.upstreamPendingDeltas = [];
        this.localPendingDelta = null;
        this.pendingSubmitDeltas = [];

        this.localPendingDeltas = [];

        this.compositionEndEventHandlers = [];

        this.latestCompositionEndTicket = null;

        this.quill.root.addEventListener("compositionstart", function(){
            self.compositionStatus = true;
        });

        this.quill.root.addEventListener("compositionend", function(event){

            if(self.localPendingDelta) {
                self.localPendingDeltas.push(self.localPendingDelta);
                self.localPendingDelta = null;
            }

            self.compositionStatus = false;

            let ticket = event.timeStamp;
            self.latestCompositionEndTicket = ticket;

            setTimeout(() => {

                // Handle cases where composition start happens right after a composition end
                // when user chooses a character using number keys.

                if(self.isComposing() || ticket !== self.latestCompositionEndTicket) {
                    return;
                }

                self.flush();

            }, 400);
        });
    }

    setSynchronizer(synchronizer) {
        this.synchronizer = synchronizer;
    }

    flush() {
        let upstreamDelta = this.composeDeltas(this.upstreamPendingDeltas);

        let finalSubmittedDelta = this.handleSubmitDeltaMerge(upstreamDelta);

        this.handleLocalDeltaMerge(upstreamDelta, finalSubmittedDelta);

        this.upstreamPendingDeltas.length = 0;
        this.localPendingDelta = null;
        this.localPendingDeltas.length = 0;
        this.pendingSubmitDeltas.length = 0;
    }

    submitToUpstream(delta) {
        this.addPendingSubmitDelta(delta);

        if(!this.isComposing()) {
            this.flush();
        }
    }

    setEditorContent(delta, source) {
        // Used to initialize editor content
        this.editor.quill.setContents(delta, source);
    }

    submitToEditor(delta, source) {
        this.addUpstreamPendingDelta(delta);

        if(!this.isComposing()) {
            this.flush();
        }
    }

    submitLocalFixingDelta(delta) {
        this.addLocalFixingDelta(delta);

        if(!this.isComposing()) {
            this.handleLocalDeltaMerge();
        }
    }

    isComposing() {
        return this.compositionStatus;
    }

    handleLocalDeltaMerge(upstreamDelta, finalSubmittedDelta) {

        let localFixingDelta;

        if(!upstreamDelta || upstreamDelta.ops.length === 0) {

            // No pending upstream changes.
            // Local pending delta is just a retain operation.

            localFixingDelta = this.composeDeltas(this.localPendingDeltas);

        } else {

            // This is a conflict situation
            // Since we paused upstream ops from applying, local editor is updated first.
            // But from the server's perspective, upstream ops happened first, which should be the final truth.
            // So we need to revert the composition input in the editor first, apply upstream ops
            // and then redo the composition input in a transformed location.

            // The final submitted delta must be an insert op, so we revert it with a delete.

            let revertOp = new Delta();
            if(finalSubmittedDelta && finalSubmittedDelta.ops.length !== 0) {
                finalSubmittedDelta.ops.forEach((op) => {
                    if(op.retain) {
                        revertOp.retain(op.retain);
                    } else if (op.insert) {
                        revertOp.delete(op.insert.length);
                    } else {
                        console.log("exceptional situation");
                    }
                });
            }

            // Revert op is calculated on the final submitted delta, which is transformed on the upstream delta already.
            // So we run the upstream op first, then the final submitted op, then the revert op.
            localFixingDelta = upstreamDelta.compose(finalSubmittedDelta).compose(revertOp);
        }

        this.quill.updateContents(localFixingDelta, "silent");
    }

    handleSubmitDeltaMerge(upstreamDelta) {

        let pendingSubmitDelta = this.composeDeltas(this.pendingSubmitDeltas);

        let transformedPendingSubmitDelta = upstreamDelta.transform(pendingSubmitDelta, true);

        // Delta could be modified by event handlers
        this.editor.dispatchEvent("beforeSubmitToUpstream", transformedPendingSubmitDelta);

        // Submit to synchronizer
        this.synchronizer.submitDeltaToUpstream(transformedPendingSubmitDelta);

        return transformedPendingSubmitDelta;
    }

    addLocalFixingDelta(delta) {
        this.localPendingDelta = delta;
    }

    addUpstreamPendingDelta(delta) {
        this.upstreamPendingDeltas.push(delta);
    }

    addPendingSubmitDelta(delta) {
        this.pendingSubmitDeltas.push(delta);
    }

    composeDeltas(deltaArray) {

        let merged = new Delta();

        deltaArray.forEach((delta) => {
            merged = merged.compose(delta);
        });

        return merged;
    }
}

export default Composition;
