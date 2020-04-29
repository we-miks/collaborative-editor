import Quill from "quill";
const Parchment = Quill.import('parchment');

import './image-placeholder.css';

class ImagePlaceholder extends Parchment.Embed {
    static create(value) {
        let node = super.create(value);
        node.setAttribute("image-placeholder-id", value);
        node.setAttribute("contenteditable", false);
        node.setAttribute("id", "image-placeholder-" + value);

        let imgMask = document.createElement('span');
        imgMask.className = "image-mask";
        node.appendChild(imgMask);

        imgMask.innerHTML = '<span class="loading"><span class="ring"></span></span>';

        return node;
    }
}
ImagePlaceholder.blotName = 'imagePlaceholder';
ImagePlaceholder.className = 'image-placeholder';
ImagePlaceholder.tagName = 'SPAN';

export default ImagePlaceholder;
