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

            let convertedDelta = self.localOnlyDelta.revert.transform(delta, true);
            let convertedOldDelta = oldDelta.compose(self.localOnlyDelta.revert);

            self.transformLocalOnlyDelta(delta);

            self.submitToUpstream(convertedDelta, convertedOldDelta);
        });
    }

    clear() {
        this.localOnlyDelta = {
            change: new Delta(),
            revert: new Delta(),
            steps: [],
            originalSteps: []
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
        let [localChangeDelta, finalSubmittedDelta] = this.handleSubmitDeltaMerge(upstreamDelta);
        let changeDelta = upstreamDelta.compose(finalSubmittedDelta);

        oldDelta = this.handleLocalDeltaMerge(upstreamDelta, localChangeDelta, finalSubmittedDelta, oldDelta);

        this.upstreamPendingDeltas.length = 0;
        this.pendingSubmitDeltas.length = 0;

        if(upstreamDelta.ops.length !== 0) {
            this.editor.dispatchEvent(EditorEvents.upstreamTextChanged, {delta: upstreamDelta, oldDelta: oldDelta});
        }

        this.editor.dispatchEvent(EditorEvents.userTextChanged, {delta: finalSubmittedDelta, oldDelta: oldDelta.compose(upstreamDelta)});
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

    handleLocalDeltaMerge(upstreamDelta, localChangeDelta, finalSubmittedDelta, oldDelta) {

        let revertDelta = new Delta();

        if(!oldDelta || (upstreamDelta && upstreamDelta.ops.length !== 0)) {

            // A delta that reverts the local change is required.
            // The local change delta must be an insert op, so we revert it with a delete.

            localChangeDelta.ops.forEach((op) => {
                if(op.retain) {
                    revertDelta.retain(op.retain);
                } else if (op.insert) {
                    revertDelta.delete(op.insert.length);
                } else {
                    console.log("can't happen");
                }
            });
        }

        if(!oldDelta) {
            // This is from the composition end event, in which case we have lost the chance to get old delta
            // before change. So we have to calculate one by ourselves.

            let currentDoc = this.getEditorContents();
            oldDelta = currentDoc.compose(revertDelta);
        }

        if(upstreamDelta && upstreamDelta.ops.length !== 0) {

            // Since we paused upstream ops from applying, local editor is updated first.
            // But from the server's perspective, upstream ops happens first, which should be the final truth.
            // So we need to revert the composition input in the editor first, apply upstream ops
            // and then redo the composition input in a transformed location.

            // Revert op is calculated on the local change delta, which is before the applying of upstream delta.
            // So we run the revert delta first, then the upstream delta, finally the transformed local change delta(the
            // final submitted delta).

            let localFixingDelta = revertDelta.compose(upstreamDelta).compose(finalSubmittedDelta);
            this.updateQuill(localFixingDelta, "silent");
        }

        return oldDelta;
    }

    handleSubmitDeltaMerge(upstreamDelta) {

        let pendingSubmitDelta = this.composeDeltas(this.pendingSubmitDeltas);

        let transformedPendingSubmitDelta = upstreamDelta.transform(pendingSubmitDelta, true);

        // Delta could be modified by event handlers
        this.editor.dispatchEvent(EditorEvents.beforeSubmitToUpstream, transformedPendingSubmitDelta);

        // Submit to synchronizer
        this.synchronizer.submitDeltaToUpstream(transformedPendingSubmitDelta);

        return [pendingSubmitDelta, transformedPendingSubmitDelta];
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
    addLocalOnlyDelta(changeDelta, revertDelta, convertAgainstLocalOnlyDelta = true) {

        let convertedChange = convertAgainstLocalOnlyDelta ? this.localOnlyDelta.change.transform(changeDelta, true) : changeDelta;
        let convertedRevert = convertAgainstLocalOnlyDelta ? this.localOnlyDelta.change.transform(revertDelta, true) : revertDelta;

        this.quill.updateContents(convertedChange, "silent");

        let id = Math.ceil(Math.random() * 100000);

        this.localOnlyDelta.steps.push({
            id: id,
            change: convertedChange,
            revert: convertedRevert
        });

        this.localOnlyDelta.originalSteps.push({
            change: changeDelta,
            revert: revertDelta
        });

        this.updateLocalOnlyDelta();
        return id;
    }

    removeLocalOnlyDelta(id) {

        let idx = this.localOnlyDelta.steps.findIndex((element) => {return element.id === id});

        if(idx !== -1) {

            let step = this.localOnlyDelta.steps.splice(idx, 1);
            step = step[0];

            this.quill.updateContents(step.revert, "silent");
            this.transformLocalOnlyDelta(step.revert);

            let originalStep = this.localOnlyDelta.originalSteps.splice(idx, 1);

            return originalStep[0];
        } else {
            return null;
        }
    }

    transformLocalOnlyDelta(delta) {
        this.localOnlyDelta.steps.forEach((step) => {
            step.change = delta.transform(step.change, true);
            step.revert = delta.transform(step.revert, true);
        })

        this.updateLocalOnlyDelta();
    }

    updateLocalOnlyDelta() {
        this.localOnlyDelta.change = new Delta();
        this.localOnlyDelta.revert = new Delta();

        for (let i = 0, l = this.localOnlyDelta.steps.length; i < l; i++) {
            this.localOnlyDelta.change = this.localOnlyDelta.change.compose(this.localOnlyDelta.steps[i].change);
        }

        for (let i = this.localOnlyDelta.steps.length - 1; i >= 0; i--) {
            this.localOnlyDelta.revert = this.localOnlyDelta.revert.compose(this.localOnlyDelta.steps[i].revert);
        }
    }

    updateQuill(delta, source) {
        let convertedDelta = this.localOnlyDelta.change.transform(delta, true);
        this.quill.updateContents(convertedDelta, source);

        if(source !== Quill.sources.USER) {
            this.transformLocalOnlyDelta(convertedDelta);
        }
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
