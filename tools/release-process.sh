#!/bin/bash
# Orchestrates the complete release process
# Usage: ./release-process.sh <version> [--dry-run]

if [ -z "$1" ]; then
  echo "Usage: $0 <version> [--dry-run]"
  echo "Example: $0 1.0.0"
  echo "Example: $0 1.0.0 --dry-run"
  exit 1
fi

VERSION_NAME="$1"
DRY_RUN_FLAG=""

# Check for dry-run flag
if [ "$2" = "--dry-run" ]; then
  DRY_RUN_FLAG="--dry-run"
  echo "🧪 DRY RUN MODE ENABLED"
  echo "   - Will create dryrun/$VERSION_NAME branch"
  echo "   - Will merge and tag locally"
  echo "   - Will NOT push to origin"
  echo ""
fi

# Ensure all scripts are executable
echo "🔧 Setting script permissions..."
chmod +x tools/release/release-step1.sh
chmod +x tools/release/release-step2.sh
chmod +x tools/release/release-step3.sh
chmod +x tools/generate-changelog.sh

echo "🚀 Starting release process for $VERSION_NAME"
echo "=================================================="

# Function to run a step and handle errors
run_step() {
  local step_script="$1"
  local step_name="$2"
  local extra_args="$3"

  echo ""
  echo "Running $step_name..."

  if ! "$step_script" "$VERSION_NAME" $extra_args; then
    echo "______________________________"
    echo "❌ Error: $step_name failed!"
    echo "Release process aborted."
    exit 1
  fi

  echo "✅ $step_name completed successfully"
}

# Execute steps
run_step "./tools/release/release-step1.sh" "Step 1: Validate & Setup" "$DRY_RUN_FLAG"
run_step "./tools/release/release-step2.sh" "Step 2: Merge & Tag" "$DRY_RUN_FLAG"

# Skip step 3 if dry-run
if [ "$2" = "--dry-run" ]; then
  echo ""
  echo "🧪 DRY RUN COMPLETED!"
  echo ""
  echo "✅ Local state:"
  echo "   - Branch: dryrun/$VERSION_NAME created"
  echo "   - Merged into main and develop locally"
  echo "   - Tag $VERSION_NAME created locally"
  echo ""
  echo "🔍 Review the changes:"
  echo "   git log --oneline --graph --all -10"
  echo ""
  echo "✨ If everything looks good:"
  echo "   ./tools/cleanup-dryrun.sh $VERSION_NAME"
  echo "   ./tools/release-process.sh $VERSION_NAME"
else
  run_step "./tools/release/release-step3.sh" "Step 3: Push to Origin"
  
  echo ""
  echo "🎉 Release process completed successfully!"
  echo "📦 bookclub-api $VERSION_NAME is being deployed!"
  echo ""
  echo "Next steps:"
  echo "  • GitHub Action is now deploying migrations and functions"
  echo "  • Check: https://github.com/ivangarzab/bookclub-api/actions"
  echo "  • GitHub Release will be created automatically"
fi