const path =  require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
    mode: 'development',
    entry: {
        demo: "./demo/index.js"
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
                        presets: ['@babel/preset-env'],
                        plugins: [
                            "@babel/plugin-proposal-class-properties"
                        ]
                    }
                }
            }
        ]
    },
    devServer: {
        compress: false,
        port: 9000,
        openPage: '/demo.html'
    },
    plugins: [
        new HtmlWebpackPlugin({
            template: 'demo/index.html',
            filename: 'demo.html',
            minify: false
        })
    ]
};
