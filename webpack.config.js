const path =  require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
    mode: 'development',
    entry: {
        index: "./demo/index.js",
        display: "./demo/display.js"
    },
    output: {
        filename: '[name].js',
        path: path.resolve(__dirname, 'dist'),
    },
    devtool: 'source-map',
    module: {
        rules: [
            {
                test: /\.(js)$/,
                exclude: /node_modules/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: ['@babel/preset-env']
                    }
                }
            },
            {
                test: /\.css$/i,
                use: ['style-loader', 'css-loader']
            },
            {
                test: /\.styl$/,
                loader: 'style-loader!css-loader!stylus-loader?paths=node_modules/bootstrap-stylus/stylus/'
            }
        ]
    },
    devServer: {
        compress: false,
        host: "0.0.0.0",
        port: 9001,
        openPage: 'http://127.0.0.1:9001/index.html'
    },
    plugins: [
        new HtmlWebpackPlugin({
            chunks: ["display"],
            template: 'demo/display.html',
            filename: 'display.html',
            minify: false
        }),
        new HtmlWebpackPlugin({
            chunks: ["index"],
            template: 'demo/index.html',
            filename: 'index.html',
            minify: false
        })
    ]
};
