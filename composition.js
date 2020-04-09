import Quill from "quill";

const Delta = Quill.import("delta");

class Composition {
    constructor(quill) {

        this.quill = quill;
        this.compositionStatus = false;
        this.doc = null;

        let self = this;

        this.upstreamPendingDeltas = [];
        this.localPendingDelta = null;
        this.pendingSubmitDeltas = [];

        this.localPendingDeltas = [];

        this.compositionEndEventHandlers = [];

        this.latestCompositionEndTicket = null;

        let editorContainerNode = document.getElementById('editor');

        editorContainerNode.addEventListener("compositionstart", function(event){
            self.compositionStatus = true;
        });

        editorContainerNode.addEventListener("compositionend", function(event){

            self.localPendingDeltas.push(self.localPendingDelta);

            self.compositionStatus = false;

            let ticket = event.timeStamp;
            self.latestCompositionEndTicket = ticket;

            setTimeout(() => {

                // Handle cases where composition happens one character after another.
                // In this case composition start happens right after a composition end
                // when user chooses a character using number keys.

                if(self.isComposing() || ticket !== self.latestCompositionEndTicket) {
                    return;
                }

                let upstreamDelta = self.composeDeltas(self.upstreamPendingDeltas);

                let finalSubmittedDelta = self.handleSubmitDeltaMerge(upstreamDelta);

                self.handleLocalDeltaMerge(upstreamDelta, finalSubmittedDelta);

                self.upstreamPendingDeltas.length = 0;
                self.localPendingDelta = null;
                self.localPendingDeltas.length = 0;
                self.pendingSubmitDeltas.length = 0;

                self.compositionEndEventHandlers.forEach((handler) => {
                    handler(finalSubmittedDelta);
                });

            }, 400);
        });
    }

    isComposing() {
        return this.compositionStatus;
    }

    handleLocalDeltaMerge(upstreamDelta, finalSubmittedDelta) {

        this.logDelta("upstream", upstreamDelta);

        let localFixingDelta;

        if(upstreamDelta.ops.length === 0) {

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

        this.logDelta("upstream", upstreamDelta);

        let pendingSubmitDelta = this.composeDeltas(this.pendingSubmitDeltas);
        this.logDelta("pending submit", pendingSubmitDelta);

        let transformedPendingSubmitDelta = upstreamDelta.transform(pendingSubmitDelta, true);
        this.logDelta("final submit", transformedPendingSubmitDelta);

        this.doc.submitOp(transformedPendingSubmitDelta, {source: "user"});

        return transformedPendingSubmitDelta;
    }

    addLocalPendingDelta(delta) {
        this.localPendingDelta = delta;
    }

    addUpstreamPendingDelta(delta) {
        this.upstreamPendingDeltas.push(delta);
    }

    addPendingSubmitDelta(delta) {
        this.pendingSubmitDeltas.push(delta);
    }

    setDoc(doc) {
        this.doc = doc;
    }

    composeDeltas(deltaArray) {

        let merged = new Delta();

        deltaArray.forEach((delta) => {
            merged = merged.compose(delta);
        });

        return merged;
    }

    onCompositionEnd(handler) {
        this.compositionEndEventHandlers.push(handler);
    }

    logDelta(msg, delta) {
        console.log(msg + ": " + JSON.stringify(delta));
    }
}

let instance = null;

Composition.InitComposition = (quill) => {
    instance = new Composition(quill);
};

Composition.GetComposition = () => {
    return instance;
};

export default Composition;
