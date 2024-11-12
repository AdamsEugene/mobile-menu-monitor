const path = require("path");

module.exports = {
  entry: "./src/index.ts",
  devtool: false,
  mode: "production",
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: "ts-loader",
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: [".tsx", ".ts", ".js"],
    fallback: {
      buffer: require.resolve("buffer"),
    },
  },
  output: {
    filename: "MobileMenuMonitor.js",
    path: path.resolve(__dirname, "dist"),
  },
  devServer: {
    static: {
      directory: path.join(__dirname, "dist"),
    },
    compress: true,
    port: 9000,
    watchFiles: ["src/**/*"],
    hot: true,
  },
};
