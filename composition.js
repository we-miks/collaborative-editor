import Quill from "quill";
import EditorEvents from "./editor-events";
const Delta = Quill.import("delta");

class Composition {
    constructor(editor) {

        this.editor = editor;
        this.quill = editor.quill;
        this.synchronizer = null;
        this.compositionInProgress = false;

        let self = this;

        this.upstreamPendingDeltas = [];
        this.pendingSubmitDeltas = [];

        this.clear();

        this.latestCompositionEndTicket = null;

        let compositionStatus = false;

        this.quill.root.addEventListener("compositionstart", function(){
            compositionStatus = true;
            self.compositionInProgress = true;
        });

        this.quill.root.addEventListener("compositionend", function(event){

            compositionStatus = false;

            let ticket = event.timeStamp;
            self.latestCompositionEndTicket = ticket;

            setTimeout(() => {

                // Handle cases where composition start happens right after a composition end
                // when user chooses a character using number keys.

                if(compositionStatus || ticket !== self.latestCompositionEndTicket) {
                    return;
                }

                self.compositionInProgress = false;

                self.flush();

            }, 400);
        });

        // Text change should only be processed by Composition and then send to others by our own event system.
        this.quill.on('text-change', function(delta, oldDelta, source) {

            if(source !== 'user')
                return;

            let convertedDelta = self.localOnlyDelta.revert.transform(delta);
            let convertedOldDelta = oldDelta.compose(self.localOnlyDelta.revert);

            self.submitToUpstream(convertedDelta, convertedOldDelta);
            self.transformLocalOnlyDelta(delta);
        });
    }

    clear() {
        this.localOnlyDelta = {
            change: new Delta(),
            revert: new Delta(),
            steps: []
        };
    }

    getEditorContents() {
        let delta = this.quill.getContents();
        return delta.compose(this.localOnlyDelta.revert);
    }

    setSynchronizer(synchronizer) {
        this.synchronizer = synchronizer;
    }

    flush(oldDelta) {
        let upstreamDelta = this.composeDeltas(this.upstreamPendingDeltas);
        let finalSubmittedDelta = this.handleSubmitDeltaMerge(upstreamDelta);

        this.handleLocalDeltaMerge(upstreamDelta, finalSubmittedDelta);

        this.upstreamPendingDeltas.length = 0;
        this.pendingSubmitDeltas.length = 0;

        let changeDelta = upstreamDelta.compose(finalSubmittedDelta);

        if(!oldDelta) {

            let currentDoc = this.getEditorContents();
            let revertDelta = new Delta();

            changeDelta.ops.forEach((op) => {
                if(op.retain) {
                    revertDelta.retain(op.retain);
                } else if (op.insert) {
                    revertDelta.delete(op.insert.length);
                } else {
                    console.log("unsupported operation");
                }
            });

            oldDelta = currentDoc.compose(revertDelta);
        }

        this.editor.dispatchEvent(EditorEvents.editorTextChanged, {delta: changeDelta, oldDelta: oldDelta});
    }

    submitToUpstream(delta, oldDelta) {

        this.addPendingSubmitDelta(delta);

        if(!this.isComposing()) {
            this.flush(oldDelta);
        }
    }

    /**
     * Initialize editor content
     * @param delta
     * @param source
     */
    setEditorContent(delta, source) {
        this.clear();
        this.editor.quill.setContents(delta, source);
        this.editor.dispatchEvent(EditorEvents.editorTextChanged, {delta: delta, oldDelta: new Delta().insert("\n")});
    }

    submitToEditor(delta) {
        this.addUpstreamPendingDelta(delta);

        if(!this.isComposing()) {
            this.flush();
        }
    }

    /**
     * Handle transformation on local delta such as adding authorship info
     * This function should only be called in an editorTextChanged event
     * since it is not protected by composition.
     * Call this function (update DOM) during composition will lead to wrong mutation records
     * and thus wrong delta.
     * @param delta
     */
    submitLocalFixingDelta(delta) {
        this.updateQuill(delta, "silent");
    }

    isComposing() {
        return this.compositionInProgress;
    }

    handleLocalDeltaMerge(upstreamDelta, finalSubmittedDelta) {

        if(upstreamDelta && upstreamDelta.ops.length !== 0) {

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

            let localFixingDelta = upstreamDelta.compose(finalSubmittedDelta).compose(revertOp);

            this.updateQuill(localFixingDelta, "silent");
        }
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

    addUpstreamPendingDelta(delta) {
        this.upstreamPendingDeltas.push(delta);
    }

    addPendingSubmitDelta(delta) {
        this.pendingSubmitDeltas.push(delta);
    }

    /**
     * Add local only delta
     * local only delta is applied to the local editor only and will never be submitted to the server
     * if there're local only delta applied to the editor, the upstream delta should be transformed by the changeDelta
     * before applied to the editor. the local changes delta should be transformed by revertDelta before submitted to
     * the upstream server.
     */
    addLocalOnlyDelta(changeDelta, revertDelta) {

        let id = Math.ceil(Math.random() * 100000);

        this.localOnlyDelta.steps.push({
            id: id,
            change: changeDelta,
            revert: revertDelta
        })

        this.updateQuill(changeDelta, "silent");

        this.updateLocalOnlyDelta();
        return id;
    }

    removeLocalOnlyDelta(id) {

        let idx = this.localOnlyDelta.steps.findIndex((element) => {return element.id === id});

        if(idx !== -1) {
            let step = this.localOnlyDelta.steps.splice(idx, 1);

            this.quill.updateContents(step[0].revert, "silent");

            this.updateLocalOnlyDelta();

            return step[0];
        } else {
            return null;
        }
    }

    transformLocalOnlyDelta(delta) {
        this.localOnlyDelta.steps.forEach((step) => {
            step.change = delta.transform(step.change);
            step.revert = delta.transform(step.revert);
        })

        this.updateLocalOnlyDelta();
    }

    updateLocalOnlyDelta() {
        this.localOnlyDelta.change = new Delta();
        this.localOnlyDelta.revert = new Delta();
        for(let step of this.localOnlyDelta.steps) {
            this.localOnlyDelta.change = this.localOnlyDelta.change.compose(step.change);
            this.localOnlyDelta.revert = this.localOnlyDelta.revert.compose(step.revert);
        }
    }

    updateQuill(delta, source) {
        let convertedDelta = this.localOnlyDelta.change.transform(delta);
        this.quill.updateContents(convertedDelta, source);

        this.transformLocalOnlyDelta(convertedDelta);
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
