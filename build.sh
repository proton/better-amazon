#!/bin/sh

zip -r -FS better-amazon.zip * --exclude '*.git*' --exclude '*.zip' --exclude '*/.DS_Store' --exclude 'screenshots/*' --exclude '*.sh' .
