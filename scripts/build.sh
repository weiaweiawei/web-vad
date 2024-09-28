#!/usr/bin/env bash

rm -rf dist
mkdir dist
npx tsc
# echo "Current working directory: $(pwd)"
# cp ./silero_vad.onnx dist
cp ./ort-wasm-simd-threaded.mjs dist
cp ./ort-wasm-simd-threaded.wasm dist
npx webpack -c webpack.config.worklet.js
npx webpack -c webpack.config.index.js
