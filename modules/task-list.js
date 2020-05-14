// Quill task list module
// https://github.com/koffeinfrei/quill-task-list

import Quill from "quill";

const List = Quill.import('formats/list');
const ListItem = Quill.import('formats/list/item');
const Parchment = Quill.import('parchment');
const Module = Quill.import('core/module');

//create and register a new class Attributor for checked tasks
let checkedAttributor = new Parchment.Attributor.Class('checked', 'checked');
Quill.register(checkedAttributor);

import './task-list.css';

class TaskListItem extends ListItem {
    format(name, value) {
        if (name === TaskList.blotName && !value) {
            this.replaceWith(Parchment.create(this.statics.scope));
        }
        else {
            super.format(name, value);
        }
    }

    // when inserting a new list item, remove the 'checked' css class
    clone() {
        const clone = super.clone();
        checkedAttributor.remove(clone.domNode);
        return clone;
    }
}

TaskListItem.blotName = 'task-list-item';
TaskListItem.tagName = 'LI';

class TaskList extends List {
    static create(value) {
        return super.create('bullet');
    }

    static formats(domNode) {
        return 'bullet';
    }
}

TaskList.blotName = 'task-list';
TaskList.tagName = 'UL';
TaskList.className = 'task-list';
TaskList.defaultChild = 'task-list-item';
TaskList.allowedChildren = [TaskListItem];

class TaskListModule extends Module {
    constructor(quill, options) {
        super(quill, options);

        this.quill.container.addEventListener('click', (e) => {
            if (e.target.matches('ul.task-list > li')) {
                if (checkedAttributor.value(e.target)) {
                    checkedAttributor.remove(e.target);
                }
                else {
                    checkedAttributor.add(e.target, true);
                }
            }
        });
    }
}

Quill.register({
    'formats/task-list': TaskList,
    'formats/task-list/item': TaskListItem,
    'modules/task-list': TaskListModule
});

// https://github.com/quilljs/quill/blob/develop/assets/icons/list-check.svg
Quill.import('ui/icons')['task-list'] = `
  <svg class="" viewbox="0 0 18 18">
    <line class="ql-stroke" x1="9" x2="15" y1="4" y2="4"></line>
    <polyline class="ql-stroke" points="3 4 4 5 6 3"></polyline>
    <line class="ql-stroke" x1="9" x2="15" y1="14" y2="14"></line>
    <polyline class="ql-stroke" points="3 14 4 15 6 13"></polyline>
    <line class="ql-stroke" x1="9" x2="15" y1="9" y2="9"></line>
    <polyline class="ql-stroke" points="3 9 4 10 6 8"></polyline>
  </svg>
`;