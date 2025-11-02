#!/bin/bash
# Step 2: Merge release branch and create tag
# Usage: ./release-step2.sh <version> [--dry-run]

if [ -z "$1" ]; then
  echo "Usage: $0 <version> [--dry-run]"
  echo "Example: $0 1.0.0"
  echo "Example: $0 1.0.0 --dry-run"
  exit 1
fi

VERSION_NAME="$1"
DRY_RUN=false

# Check for dry-run flag
if [ "$2" = "--dry-run" ]; then
  DRY_RUN=true
  BRANCH_PREFIX="dryrun"
else
  BRANCH_PREFIX="release"
fi

BRANCH_NAME="$BRANCH_PREFIX/$VERSION_NAME"
DATE_TODAY=$(date +"%Y-%m-%d")

# Ensure the branch exists
if ! git show-ref --verify --quiet refs/heads/"$BRANCH_NAME"; then
  echo "Error: Branch $BRANCH_NAME does not exist"
  exit 1
fi

# Ensure a clean working directory
if ! git diff-index --quiet HEAD --; then
  echo "Error: Working directory is not clean. Please commit or stash changes."
  exit 1
fi

echo "2️⃣ Merging and tagging release $VERSION_NAME..."

# Merge release branch into main
echo "🔀 Merging $BRANCH_NAME into main..."
git checkout main
git merge --no-ff -m "Merge $BRANCH_NAME into main" "$BRANCH_NAME"

# Tag the release on main
echo "🏷️  Creating tag $VERSION_NAME..."
git tag -a "$VERSION_NAME" -m "Release $VERSION_NAME on $DATE_TODAY"

# Merge main back into develop
echo "🔀 Merging main into develop..."
git checkout develop
git merge --no-ff -m "Merge main into develop after release $VERSION_NAME" main

if [ "$DRY_RUN" = true ]; then
  echo "✅ Dry run: Merged and tagged locally (not pushed)"
else
  echo "✅ Release $VERSION_NAME merged and tagged locally"
fi