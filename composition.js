import Quill from "quill";
import EditorEvents from "./editor-events";
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

        this.oldDelta = null;
        this.quill.on('text-change', function(delta, oldDelta, source) {

            if(source !== 'user')
                return;

            // old delta before composition
            if(!self.isComposing()) {
                self.oldDelta = oldDelta;
            }

            // Text change should only be processed by Composition and then send to others by our own event system.
            self.submitToUpstream(delta);
        });
    }

    setSynchronizer(synchronizer) {
        this.synchronizer = synchronizer;
    }

    flush(delta) {
        let upstreamDelta = this.composeDeltas(this.upstreamPendingDeltas);

        let finalSubmittedDelta = this.handleSubmitDeltaMerge(upstreamDelta);

        let finalAppliedDelta = this.handleLocalDeltaMerge(upstreamDelta, finalSubmittedDelta);

        this.upstreamPendingDeltas.length = 0;
        this.localPendingDelta = null;
        this.localPendingDeltas.length = 0;
        this.pendingSubmitDeltas.length = 0;

        // oldDelta is before composition, finalSubmittedDelta does not include composition process
        // oldDelta and delta is consistent

        let currentDelta = finalAppliedDelta.ops.length === 0 ? delta : finalAppliedDelta;

        this.editor.dispatchEvent(EditorEvents.editorTextChanged, {delta: currentDelta, oldDelta: this.oldDelta});
    }

    submitToUpstream(delta) {
        this.addPendingSubmitDelta(delta);

        if(!this.isComposing()) {
            this.flush(delta);
        }
    }

    setEditorContent(delta, source) {

        // Used to initialize editor content
        let oldDelta = this.editor.quill.getContents();

        this.editor.quill.setContents(delta, source);

        this.editor.dispatchEvent(EditorEvents.editorTextChanged, {delta: delta, oldDelta: oldDelta});
    }

    submitToEditor(delta) {
        this.addUpstreamPendingDelta(delta);

        if(!this.isComposing()) {
            this.flush(delta);
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

        return localFixingDelta;
    }

    handleSubmitDeltaMerge(upstreamDelta) {

        let pendingSubmitDelta = this.composeDeltas(this.pendingSubmitDeltas);

        let transformedPendingSubmitDelta = upstreamDelta.transform(pendingSubmitDelta, true);

        // Delta could be modified by event handlers
        this.editor.dispatchEvent(EditorEvents.beforeSubmitToUpstream, transformedPendingSubmitDelta);

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
