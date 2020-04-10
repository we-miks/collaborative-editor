
class Editor {

    options = {};

    constructor(options) {

        if(options) {
            this.options = options;
        }
    }

    hello () {
        return "Hello World!";
    }

    eventHandlers = {};

    on(event, handler) {

        let handlerId = Math.ceil(Math.random() * 10000);

        if(!this.eventHandlers[event]) {
            this.eventHandlers[event] = {};
        }

        this.eventHandlers[event][handlerId] = handler;

        return handlerId;
    }

    off(event, handlerId) {
        if(this.eventHandlers[event] && this.eventHandlers[event][handlerId]) {
            delete this.eventHandlers[event][handlerId];
        }
    }

    dispatchEvent(event, payload) {
        if(this.eventHandlers[event]) {
            Object.keys(this.eventHandlers[event]).forEach((handlerId) => {
                let handler = this.eventHandlers[event][handlerId];
                handler(payload);
            });
        }
    }
}

export default Editor;
