const CopyWebpackPlugin = require("copy-webpack-plugin");
const prod = { mode: "production", suffix: "min" };

const bundleConfig = ({ mode, suffix }) => {
  return {
    mode,
    entry: { index: "./dist/index.js" },
    module: {
      rules: [
        {
          test: /\.onnx$/, // 添加此规则以处理 .onnx 文件
          type: 'asset/resource', // 使用 Webpack 5 的内置资源处理
          generator: {
            filename: '[name][ext]', // 输出文件名保持不变
          },
        },
        {
          test: /vad\.\worklet\.bundle\..*\.js/,
          type: "asset/resource",
          generator: {
            filename: "[name][ext]",
          },
        },
        {
          test: /\.js$/, // 添加这个规则来处理 JS 文件
          exclude: /node_modules/, // 排除 node_modules 目录
          use: {
            loader: 'babel-loader', // 使用 babel-loader
          },
        },
      ],
    },
    // externals: {
    //   "onnxruntime-web": {
    //     commonjs: "onnxruntime-web",
    //     commonjs2: "onnxruntime-web",
    //     amd: "onnxruntime-web",
    //     root: "ort",
    //   },
    // },
    output: {
      filename: `bundle.${suffix}.js`,
      library: { name: "vad", type: "umd" },
    },
    plugins: [
      new CopyWebpackPlugin({
        patterns: [
          {
            from: "node_modules/onnxruntime-web/**/*.wasm",
            to: "[name][ext]",
          },
        ],
      }),
    ],
  };
};

module.exports = [bundleConfig(prod)];