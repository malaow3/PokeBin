#!/bin/bash
./build.sh
cd ..
mkdir extension-build/
cp extension/build/pokebin-ext.chrome.zip extension-build/
cp extension/build/pokebin-ext.firefox.zip extension-build/

rm -rf extension/node_modules/
rm -rf extension/dist/
rm -rf extension/build/

cd extension
zip -r ../extension-build/pokebin-source.zip .
bun i
