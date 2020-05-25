# Miks多人协同编辑器
[中文](./README_CN.md) | [English](./README.md)

基于Quill和ShareDB构建的协同编辑器。支持侧边栏作者信息展示，图片上传的预览。支持中文输入法。

***详情可参考这篇文章***

[从零开始设计一个Web端多人协同编辑器](https://zhuanlan.zhihu.com/p/131572523)


## 开始使用

本仓库中包含一个完整可直接运行的demo，关于如何运行这个demo，请参考后面的[开发](./README.md#开发) 章节。

***安装***

```bash
$ npm install --save miks-collaborative-editor
```

***配置***

```javascript
import Editor from "miks-collaborative-editor";
import 'quill/dist/quill.snow.css'

// 当前用户的信息，必须包含id和name字段
let author = {
    id: 10,
    name: 'Main Author'
};

let editorOptions = {
    authorship: {
        author: author,
        
        // 当前用户段落的颜色
        authorColor: '#ed5634', 
        
        // 其他用户段落的颜色
        colors: [
            "#f7b452",
            "#ef6c91",
            "#8e6ed5",
            "#6abc91",
            "#5ac5c3",
            "#7297e3",
            "#9bc86e",
            "#ebd562",
            "#d499b9"
        ],
        handlers: {

            // 当文档中出现了一个新的用户ID时，使用这个函数来获取用户的信息
            // 必须返回一个Promise
            getAuthorInfoById: (authorId) => {
                return new Promise((resolve, reject) => {

                    let author = {
                        id: 12345,
                        name: 'Another author'
                    };

                    if(author) {
                        resolve(author);
                    }else{
                        reject("user not found");
                    }
                });
            }
        }
    },
    image: {
        handlers: {

            // 上传DataURI格式的图片到服务器，并返回一个图片URL
            // 必须返回一个Promise
            imageDataURIUpload: (dataURI) => {

                console.log(dataURI);

                return new Promise((resolve) => {
                    resolve('https://yd.wemiks.com/banner-2d980584-yuanben.svg');
                });
            },

            // 上传一个图片外链到服务器，并返回一个内部的图片URL
            // 必须返回一个Promise
            imageSrcUpload: (src) => {

                console.log(src);

                return new Promise((resolve) => {
                    resolve('https://yd.wemiks.com/banner-2d980584-yuanben.svg');
                });
            },
            
            // 图片上传错误的处理
            imageUploadError: (err) => {
                console.log("image upload error: " + err);
            }
        }
    }
};

// Quill的工具栏配置
// https://quilljs.com/docs/modules/toolbar/
// 图片上传按钮的功能已经在内部实现，无需做任何额外配置
let toolbarOptions = [
    ['bold', 'italic', 'underline', 'strike'],
    [{'header': 1}, {'header': 2}, {'header': 3}],
    [{'list': 'ordered'}, {'list': 'bullet'}, {'indent': '+1'}, {'indent': '-1'}],
    ['align', 'color', 'background'],
    ['blockquote', 'code-block', 'link', 'image']
];

// Quill编辑器的选项配置
// 不要修改和图片上传、图片复制粘贴相关的配置
let quillOptions = {
    modules: {
        toolbar: toolbarOptions
    },
    theme: 'snow'
};

let editor = new Editor("#container", editorOptions, quillOptions);

let websocketEndpoint = "ws://localhost:8080";
editor.syncThroughWebsocket(websocketEndpoint, "examples", "test-doc");

```

***内容加载***

编辑后的内容以Delta的形式存储在后端数据库中，展示前需要使用Quill编辑器转换为HTML。在demo中包含了
HTML转换的示例代码，详情参见后面的开发章节。

由于Quill使用了CSS来实现一些功能，比如[多级嵌套列表](https://github.com/quilljs/quill/issues/979)，在展示内容时，
必须把这些CSS同时加载出来，内容才能正确显示。在本项目的```display.styl```样式文件中包含了展示内容时需要
加载的CSS。在展示内容的页面需要加载这个文件，并且在内容的父级元素上添加一个class：```ql-editor```。
可以参考demo中的示例代码。

## 开发

开发时可以使用本仓库中包含的demo来启动编辑器进行调试。Demo代码位于```demo```文件夹中。

***加载编辑器***

首先安装npm依赖：

```bash
$ npm install
```

然后需要启动服务器端API。服务器端脚本位于```server```文件夹中。
```bash
$ node server/server.js
```

服务器端脚本会在9001端口启动websocket监听。

然后新开一个命令行窗口启动编辑器前端界面：

```bash
$ npm start
```

浏览器应该已经自动弹出新窗口，并且加载出了编辑器和测试的内容。

***加载内容***
由于后端存储的内容是Delta格式，在页面上进行展示时，需要转换为HTML格式。我们可以通过Quill编辑器完成
转换。在demo中包含了一个转换内容并展示的页面```display.js``。打开一个新的浏览器窗口并访问：

```
http://127.0.0.1:9001/display.html
```
可以看到转换后的内容。

## 贡献

欢迎任何形式的贡献。

有任何问题，欢迎提交Issue。欢迎提交PR。

加微信交流：lencyforce
