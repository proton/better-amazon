#!/bin/sh

zip -r -FS better-amazon.zip \
  manifest.json \
  background.js \
  content.js \
  popup.html \
  popup.js \
  README.md \
  images \
  --exclude '*/.DS_Store'
