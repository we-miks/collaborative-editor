import Quill from "quill";

import EditorEvents from "./editor-events";

const Parchment = Quill.import("parchment");
const Delta = Quill.import("delta");

const AuthorAttribute = new Parchment.Attributor.Class('author', 'ql-author', {
    scope: Parchment.Scope.INLINE
});

Quill.register(AuthorAttribute);

import './authorship.css';

class Authorship {
    constructor(editor, composition, options) {

        this.editor = editor;
        this.composition = composition;
        this.author = options.author;

        this.authorSidebar = new AuthorSidebar(editor.quill, AuthorAttribute, options);

        let self = this;

        this.editor.on(EditorEvents.beforeSync, () => {
            self.authorSidebar.reset();
        });

        this.editor.on(EditorEvents.beforeSubmitToUpstream, (delta) => {
            self.applyLocalFixingDelta(delta);
        });

        this.editor.on(EditorEvents.editorTextChanged, ({delta, oldDelta}) => {
            self.authorSidebar.update(delta, oldDelta);
        });

        this.editor.on(EditorEvents.undo, ({delta, oldDelta}) => {
            self.authorSidebar.update(delta, oldDelta);
        });

        this.editor.on(EditorEvents.redo, ({delta, oldDelta}) => {
            self.authorSidebar.update(delta, oldDelta);
        });
    }

    applyLocalFixingDelta(delta) {

        let authorDelta = new Delta();
        let authorFormat = { author: this.author.id };

        let self = this;

        delta.ops.forEach(op => {
            if (op.delete) {
                return;
            }
            if (op.insert || (op.retain && op.attributes)) {

                // Add authorship to insert/format
                op.attributes = op.attributes || {};
                op.attributes.author = self.author.id;

                // Apply authorship to our own editor
                authorDelta.retain(
                    op.retain || op.insert.length || 1,
                    authorFormat,
                );
            } else {
                authorDelta.retain(op.retain);
            }
        });

        if (authorDelta.ops.length !== 0) {
            self.composition.submitLocalFixingDelta(authorDelta);
        }
    }
}

class AuthorSidebar {

    constructor (quill, authorAttribute, options) {

        this.quill = quill;
        this.author = options.author;
        this.authorAttribute = authorAttribute;
        this.options = options;

        // Add sidebar container to editor
        this.sidebarNode = this.quill.addContainer("ql-author-sidebar");

        this.sidebarItems = [];
        this.authorsInfo = {};

        this.colors = options.colors;

        this.identifiedAuthorIds = {};
        this.identifiedAuthorCount = 0;
        this.styleElement = null;

        let self = this;

        // On image load, update sidebar position
        quill.root.addEventListener(
            'load',
            function(event){
                let domNode = event.target;
                if( domNode.tagName === 'IMG'){

                    let imageBlot = Quill.find(domNode);

                    if(!imageBlot) {
                        // Could also be image placeholder

                        let imagePlaceholderDomNode = domNode.closest(".image-placeholder");

                        if(imagePlaceholderDomNode) {
                            imageBlot = Quill.find(imagePlaceholderDomNode);
                        }
                    }

                    if(imageBlot) {

                        let [lineBlot, offset] = quill.getLine(quill.getIndex(imageBlot));

                        let lineNumber = quill.getLines().indexOf(lineBlot);
                        self.adjustSidebarItemPosition(lineBlot, lineNumber);
                    }
                }
            },
            true // useCapture
        );
    }

    reset () {
        this.sidebarNode.classList.add("single-author");
        this.sidebarItems.forEach((item) => {
            item.remove();
        });
        this.sidebarItems.length = 0;

        this.identifiedAuthorIds = {};
        this.identifiedAuthorCount = 0;

        // Add the local editor's info into the authorsInfo
        this.authorsInfo = {};
        this.authorsInfo[this.author.id] = this.author;

        // User main color for local editor
        this.addStyleForAuthor(this.author.id, this.options.authorColor);

        this.createSidebarItem(-1);
    }

    update (delta, oldDelta) {

        this.searchAuthorFromDelta(delta);

        // In deletion situations where we cannot determine which lines has been deleted
        // we calculate a parallel Delta with each step of the target delta so that we can
        // get a revert op of the deletion to find out exactly if there're any new lines been deleted.

        let parallelDelta = oldDelta;

        let allLines = this.quill.getLines();
        let affectedLines = [];

        let index = 0;
        let latestLineIndex = 0;

        let self = this;

        for(let i=0; i<delta.ops.length; i++) {
            let op = delta.ops[i];

            if(op.insert) {

                // For embed elements such as image, op.insert is an object and length is 1;
                let length = op.insert.length || 1;

                let lines = self.quill.getLines(index, length);

                if(typeof(op.insert) === 'string') {
                    let regex = /\n/g;
                    while ( (regex.exec(op.insert)) ) {

                        let author = null;
                        if(op.attributes && op.attributes.author)
                            author = op.attributes.author;

                        self.createSidebarItem(latestLineIndex);
                    }
                }

                lines.forEach((line) => {

                    self.addAffectedLine(affectedLines, line);

                    let lineIndex = allLines.indexOf(line);

                    if (lineIndex > latestLineIndex) {
                        latestLineIndex = lineIndex;
                    }
                });

                if((latestLineIndex + 1) < allLines.length) {
                    // Edge case for the next line of line break
                    self.addAffectedLine(affectedLines, allLines[latestLineIndex + 1]);
                }

                let dt = new Delta();
                dt = dt.retain(index).insert(op.insert, op.attributes);
                parallelDelta = parallelDelta.compose(dt);

                index = index + length;

            } else if (op.retain) {

                let lines = this.quill.getLines(index, op.retain);

                if(lines.length !== 0) {
                    lines.forEach((line) => {

                        if(op.attributes) {
                            self.addAffectedLine(affectedLines, line);
                        }

                        let lineIndex = allLines.indexOf(line);

                        if (lineIndex > latestLineIndex) {
                            latestLineIndex = lineIndex;
                        }
                    });
                }

                let dt = new Delta();
                dt = dt.retain(op.retain, op.attributes);
                parallelDelta = parallelDelta.compose(dt);

                index = index + op.retain;

            } else if (op.delete) {

                let [currentLine, offset] = self.quill.getLine(index);

                let currentLineIndex = -1;

                if(currentLine) {
                    currentLineIndex = allLines.indexOf(currentLine);
                    self.addAffectedLine(affectedLines, currentLine);
                }

                // A more complicated situation where even if the total line number is not changed, it is likely
                // to be a deletion of one line followed by an insertion of new line.
                // So we use the parallel delta to invert current delta to find out what exactly has been deleted.

                let afterDelete = parallelDelta.compose(new Delta().retain(index).delete(op.delete));

                // Edge case for the last line break in the editor
                if(currentLineIndex !== -1) {
                    let diffDelta = afterDelete.diff(parallelDelta, index);

                    diffDelta.ops.forEach((dop) => {
                        if(dop.insert) {
                            let regex = /\n/g;
                            while ( (regex.exec(dop.insert)) ) {
                                // A line is deleted.
                                self.deleteSidebarItem(currentLineIndex, 1);
                            }
                        }
                    });
                }

                parallelDelta = afterDelete;

                // Index doesn't need to be changed since deletion has already been done on quill editor.

            } else {
                console.log("exceptional behavior");
            }
        }

        this.updateAffectedLineRecursively(0, affectedLines, allLines);
    }

    updateAffectedLineRecursively(current, affectedLines, allLines) {
        if (current >= affectedLines.length)
            return;

        let line = affectedLines[current];
        let lineIndex = allLines.indexOf(line);

        let self = this;

        this.updateLineAuthor(line, lineIndex)
            .then(() => {
                self.adjustSidebarItemPosition(line, lineIndex);
                self.updateAffectedLineRecursively(current+1, affectedLines, allLines);
            })
            .catch((err) => {
                console.error(err);
            });
    }

    updateLineAuthor(line, lineIndex) {

        return new Promise((resolve, reject) => {
            let maxLengthAuthor = 0;
            let maxLength = 0;

            let authorLength = {};

            let current = line.children.head;

            let sidebarItem = this.sidebarItems[lineIndex];
            this.updateAuthorInfoOnSidebarItem(sidebarItem, lineIndex); // Clear previous author info

            if(current) {
                while(current) {
                    let length = current.length();

                    if(!current.domNode.getAttribute) {
                        // Text node
                    } else {
                        let authorId = this.authorAttribute.value(current.domNode);

                        if(typeof(authorLength[authorId]) === 'undefined') {
                            authorLength[authorId] = length;
                        } else {
                            authorLength[authorId] += length;
                        }

                        if(authorLength[authorId] > maxLength) {
                            maxLength = authorLength[authorId];
                            maxLengthAuthor = authorId;
                        }
                    }

                    current = current.next;
                }

                if(maxLengthAuthor === 0) {
                    resolve();
                    return;
                }

                // Update author's name inside sidebar item
                let lineAuthorId = maxLengthAuthor;
                let self = this;

                if(!this.authorsInfo[lineAuthorId]) {
                    // Author info must be retrieved from the store
                    self.options.handlers.getAuthorInfoById(lineAuthorId)
                        .then((author) => {
                            self.authorsInfo[lineAuthorId] = author;
                            self.updateAuthorInfoOnSidebarItem(sidebarItem, lineIndex, lineAuthorId);
                            resolve();
                        })
                        .catch((err) => {
                            reject(err);
                        });
                } else {
                    this.updateAuthorInfoOnSidebarItem(sidebarItem, lineIndex, lineAuthorId);
                    resolve();
                }
            }
        });
    }

    updateAuthorInfoOnSidebarItem(sidebarItem, itemIndex, authorId) {
        sidebarItem.className = 'ql-author-item';
        sidebarItem.removeAttribute("data-author-id");

        let authorNameNode = sidebarItem.querySelector(".author-name");
        authorNameNode.innerHTML = "";

        if(authorId) {
            let authorName = this.authorsInfo[authorId].name;

            sidebarItem.className = 'ql-author-item ql-author-' + authorId;
            sidebarItem.setAttribute("data-author-id", authorId);

            authorNameNode.innerHTML = authorName;

            // Check if we're the first item in a same color range
            if(itemIndex === 0) {
                sidebarItem.classList.add("first");
            } else {
                let previousSidebarItem = this.sidebarItems[itemIndex - 1];
                if(!previousSidebarItem.classList.contains("ql-author-" + authorId)) {
                    sidebarItem.classList.add("first");
                }
            }
        }

        // Check if we're breaking an existing range
        if(itemIndex !== this.sidebarItems.length - 1) {
            let nextSidebarItem = this.sidebarItems[itemIndex + 1];
            if(nextSidebarItem.classList.contains("ql-author-" + authorId)) {
                // Next is the same as us
                nextSidebarItem.classList.remove("first");
            } else {
                nextSidebarItem.classList.add("first");
            }
        }
    }

    adjustSidebarItemPosition(line, lineIndex) {
        let height = line.domNode.offsetHeight;
        this.sidebarItems[lineIndex].style.height = height + "px";

        let styles = window.getComputedStyle(line.domNode);
        this.sidebarItems[lineIndex].style.marginTop = styles.getPropertyValue("margin-top");
        this.sidebarItems[lineIndex].style.marginBottom = styles.getPropertyValue("margin-bottom");
    }

    createSidebarItem(afterIndex) {
        let index = (afterIndex + 1);
        let item = document.createElement('div');
        item.id = 'ql-author-item-' + Math.ceil(Math.random() * 1000000);
        item.className = 'ql-author-item';

        item.innerHTML = '<div class="color-bar"></div><div class="author-name"></div>';

        if(index === 0 || index === this.sidebarItems.length) {
            this.sidebarNode.append(item);
            this.sidebarItems.push(item);
        } else {
            this.sidebarNode.insertBefore(item, this.sidebarItems[index]);
            this.sidebarItems.splice(index, 0, item);
        }
    }

    deleteSidebarItem(afterIndex, count) {
        let elements = this.sidebarItems.splice(afterIndex + 1, count);
        elements.forEach((elem) => {
            elem.remove();
        });

        if(afterIndex >= this.sidebarItems.length - 1) {
            return;
        }

        let previousItem = this.sidebarItems[afterIndex];
        let nextItem = this.sidebarItems[afterIndex + 1];

        if(previousItem.getAttribute("data-author-id") !== nextItem.getAttribute("data-author-id")) {
            nextItem.classList.add("first");
        }
    }

    addAffectedLine(affectedLines, line) {
        if(affectedLines.indexOf(line) === -1) {
            affectedLines.push(line);
        }
    }

    searchAuthorFromDelta(delta) {

        let self = this;

        delta.ops.forEach((op) => {
            if(op.attributes && op.attributes.author) {
                let authorId = op.attributes.author;
                if(authorId !== self.author.id && typeof(self.identifiedAuthorIds[authorId]) === 'undefined') {
                    // New author identified.
                    // Assign a color to this author.
                    self.identifiedAuthorIds[authorId] = self.identifiedAuthorCount++ % self.colors.length;

                    // Add css rules to display the color
                    this.addStyleForAuthor(authorId);
                }
            }
        });

        if(self.identifiedAuthorCount >= 1) {
            this.sidebarNode.classList.remove("single-author");
        }
    }

    addStyleForAuthor(authorId, preferredColor) {

        if (!this.styleElement) {
            this.styleElement = document.createElement('style');
            this.styleElement.type = 'text/css';
            document.documentElement
                .getElementsByTagName('head')[0]
                .appendChild(this.styleElement);
        }

        let color = preferredColor || this.findColor(authorId);

        if(color) {
            let rule = `.ql-author-sidebar .ql-author-${authorId} .color-bar { ` + `background-color:${color}; }\n`;
            this.styleElement.sheet.insertRule(rule, 0);
            let rule2 = `.ql-author-sidebar .ql-author-${authorId} .author-name { ` + `color:${color}; }\n`;
            this.styleElement.sheet.insertRule(rule2, 0);
        }
    }

    findColor(authorId) {
        if(typeof(this.identifiedAuthorIds[authorId]) === 'undefined')
            return null;

        return this.colors[this.identifiedAuthorIds[authorId]];
    }
}

const DEBUG = false;
function log(msg){
    if(!DEBUG)
    {
        return;
    }

    console.log(msg);
}

export default Authorship;
