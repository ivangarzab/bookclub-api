#!/bin/bash
# Cleanup dry run artifacts and reset branches
# Usage: ./cleanup-dryrun.sh <version>

if [ -z "$1" ]; then
  echo "Usage: $0 <version>"
  echo "Example: $0 1.0.0"
  exit 1
fi

VERSION_NAME="$1"
DRYRUN_BRANCH="dryrun/$VERSION_NAME"

echo "🧹 Cleaning up dry run artifacts for version $VERSION_NAME..."

# Delete dry run branch if it exists
if git show-ref --verify --quiet refs/heads/"$DRYRUN_BRANCH"; then
  echo "🗑️  Deleting branch $DRYRUN_BRANCH..."
  git branch -D "$DRYRUN_BRANCH"
else
  echo "ℹ️  Branch $DRYRUN_BRANCH not found (already deleted?)"
fi

# Delete tag if it exists
if git tag -l | grep -q "^$VERSION_NAME$"; then
  echo "🗑️  Deleting tag $VERSION_NAME..."
  git tag -d "$VERSION_NAME"
else
  echo "ℹ️  Tag $VERSION_NAME not found (already deleted?)"
fi

# Reset main to origin/main
echo "↩️  Resetting main to origin/main..."
git checkout main
git reset --hard origin/main

# Reset develop to origin/develop
echo "↩️  Resetting develop to origin/develop..."
git checkout develop
git reset --hard origin/develop

echo ""
echo "✅ Cleanup complete!"
echo "📍 You are now on the develop branch"
echo ""
echo "🚀 Ready to run the real release:"
echo "   ./tools/release-process.sh $VERSION_NAME"