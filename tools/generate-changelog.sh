#!/bin/bash
# Simple changelog generator from conventional commits
# Usage: ./generate-changelog.sh <from-tag> <to-tag>

if [ -z "$1" ] || [ -z "$2" ]; then
  echo "Usage: $0 <from-tag> <to-tag>"
  echo "Example: $0 v1.0.0 v1.1.0"
  exit 1
fi

FROM_TAG="$1"
TO_TAG="$2"
DATE=$(date +"%Y-%m-%d")

echo "# [$TO_TAG] - $DATE"
echo ""

# Features
FEATURES=$(git log "$FROM_TAG".."$TO_TAG" --oneline --no-merges | grep "^[a-f0-9]* feat" | grep -v "^[a-f0-9]* feat(db)" || true)
if [ -n "$FEATURES" ]; then
  echo "## Features"
  echo ""
  echo "$FEATURES" | sed -E 's/^[a-f0-9]+ feat(\([^)]+\))?: /- \1 /' | sed 's/^- () /- /' | sed 's/^-  /- /'
  echo ""
fi

# Fixes
FIXES=$(git log "$FROM_TAG".."$TO_TAG" --oneline --no-merges | grep "^[a-f0-9]* fix" | grep -v "^[a-f0-9]* fix(db)" || true)
if [ -n "$FIXES" ]; then
  echo "## Bug Fixes"
  echo ""
  echo "$FIXES" | sed -E 's/^[a-f0-9]+ fix(\([^)]+\))?: /- \1 /' | sed 's/^- () /- /' | sed 's/^-  /- /'
  echo ""
fi

# Database changes
DB_CHANGES=$(git log "$FROM_TAG".."$TO_TAG" --oneline --no-merges | grep "^[a-f0-9]* feat(db)\\|^[a-f0-9]* fix(db)" || true)
if [ -n "$DB_CHANGES" ]; then
  echo "## Database Changes"
  echo ""
  echo "$DB_CHANGES" | sed -E 's/^[a-f0-9]+ (feat|fix)\(db\): /- /'
  echo ""
fi

# Other
OTHER=$(git log "$FROM_TAG".."$TO_TAG" --oneline --no-merges | grep -v "^[a-f0-9]* feat" | grep -v "^[a-f0-9]* fix" | grep -v "chore(release)" || true)
if [ -n "$OTHER" ]; then
  echo "## Other Changes"
  echo ""
  echo "$OTHER" | sed 's/^[a-f0-9]* /- /'
  echo ""
fi