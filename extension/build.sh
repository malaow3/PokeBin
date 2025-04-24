#!/bin/bash

bun run build:internal;
mkdir -p build/chrome/dist;
cp dist/static/js/inject_chrome.js build/chrome/dist/inject.js;
cp dist/static/js/main.js build/chrome/dist/main.js;
cp -r icons build/chrome;
cp chrome_manifest.json build/chrome/manifest.json;
pushd build/chrome;
zip -r ../pokebin-ext.chrome.zip .;
popd;

mkdir -p build/firefox/dist;
cp dist/static/js/inject_firefox.js build/firefox/dist/inject.js;
cp dist/static/js/main.js build/firefox/dist/main.js;
cp -r icons build/firefox;
cp firefox_manifest.json build/firefox/manifest.json;
pushd build/firefox;
rm ../pokebin-ext.user.zip;
zip -r ../pokebin-ext.firefox.zip .;
