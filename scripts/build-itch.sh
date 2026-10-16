#!/bin/sh
# Builds the zip to upload to itch.io: just the game (no admin dashboard, tests or docs).
# Usage: sh scripts/build-itch.sh   ->   dist/paintrunner-itch.zip
set -e
cd "$(dirname "$0")/.."
rm -rf dist/itch && mkdir -p dist/itch
cp index.html style.css config.js cloud.js characters.js shop.js levels.js achievements.js ghost.js art.js world.js audio.js ui.js main.js story.js splash.js dist/itch/
cp -R vendor music dist/itch/
rm -f dist/paintrunner-itch.zip
(cd dist/itch && zip -qr ../paintrunner-itch.zip .)
echo "dist/paintrunner-itch.zip  ($(du -h dist/paintrunner-itch.zip | cut -f1))"
