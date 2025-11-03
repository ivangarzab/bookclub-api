#!/bin/bash
# Step 3: Push everything to origin
# Usage: ./release-step3.sh <version>

if [ -z "$1" ]; then
  echo "Usage: $0 <version>"
  echo "Example: $0 1.0.0"
  exit 1
fi

VERSION_NAME="$1"

# Verify tag exists
if ! git tag -l | grep -q "^$VERSION_NAME$"; then
  echo "Error: Tag $VERSION_NAME does not exist"
  exit 1
fi

echo "3️⃣ Pushing everything to origin..."

# Push main
echo "🔼 Pushing main..."
git checkout main
git push origin main

# Push develop
echo "🔼 Pushing develop..."
git checkout develop
git push origin develop

# Push tag
echo "🏷️ Pushing tag $VERSION_NAME..."
git push origin "$VERSION_NAME"

echo "✅ All changes and tag pushed to origin"
echo "🚀 GitHub Action will now deploy version $VERSION_NAME"