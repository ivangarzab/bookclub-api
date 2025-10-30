#!/bin/bash
# Update version in deno.json
# Usage: ./update-version.sh <version>

if [ -z "$1" ]; then
  echo "Usage: $0 <version>"
  echo "Example: $0 1.0.0"
  exit 1
fi

VERSION_NAME="$1"
VERSION_FILE="deno.json"

if [ ! -f "$VERSION_FILE" ]; then
  echo "Error: $VERSION_FILE not found!"
  exit 1
fi

echo "Updating version to: $VERSION_NAME"

if [[ "$OSTYPE" == "darwin"* ]]; then
  sed -i '' "s/\"version\": \".*\"/\"version\": \"$VERSION_NAME\"/" "$VERSION_FILE"
else
  sed -i "s/\"version\": \".*\"/\"version\": \"$VERSION_NAME\"/" "$VERSION_FILE"
fi

echo "✅ Version updated in $VERSION_FILE"