#!/bin/bash
# Step 1: Validate and create release branch
# Usage: ./release-step1.sh <version> [--dry-run]

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
  echo "🧪 DRY RUN MODE - Branch will be: dryrun/$VERSION_NAME"
else
  BRANCH_PREFIX="release"
fi

BRANCH_NAME="$BRANCH_PREFIX/$VERSION_NAME"

# Ensure a clean working directory
if ! git diff-index --quiet HEAD --; then
  echo "Error: Working directory is not clean. Please commit or stash changes."
  exit 1
fi

# Ensure the branch doesn't exist already
if git show-ref --verify --quiet refs/heads/"$BRANCH_NAME"; then
  echo "Error: Branch $BRANCH_NAME already exists"
  echo "Delete it first with: git branch -D $BRANCH_NAME"
  exit 1
fi

echo "1️⃣ Validating and setting up release for version $VERSION_NAME..."

# Checkout develop and update
echo "📥 Updating develop branch..."
git checkout develop
git fetch
git pull

# Run tests BEFORE creating branch
echo "🧪 Running tests..."
if ! deno task test > /tmp/test-output.log 2>&1; then
  echo "❌ Tests failed! Output:"
  cat /tmp/test-output.log
  exit 1
fi
echo "✅ All tests passed"

# Create release branch
echo "🌿 Creating $BRANCH_NAME branch..."
git checkout -b "$BRANCH_NAME"

if [ "$DRY_RUN" = true ]; then
  echo "✅ Dry run branch created: $BRANCH_NAME"
else
  echo "✅ Release branch created: $BRANCH_NAME"
fi