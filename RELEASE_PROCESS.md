# Release Process

This document describes the release process for bookclub-api using conventional commits and automated deployment.

## Overview

The release process follows **Git Flow** and includes:
1. Creating a release branch from `develop`
2. Generating a changelog from conventional commits
3. Running tests to ensure stability
4. Deploying database migrations and edge functions
5. Merging to `main`, tagging, and pushing

## Prerequisites

- `develop` branch is checked out
- Clean working directory (no uncommitted changes)
- All tests passing on `develop`
- Conventional commit messages since last release
- Supabase CLI authenticated and configured

## Quick Start

```bash
# Run the entire release process
./tools/release-process.sh 1.2.0
```

That's it! The script will:
- ✅ Create release branch
- ✅ Run tests
- ✅ Generate changelog
- ✅ Update version in `deno.json`
- ✅ Deploy migrations and functions
- ✅ Merge, tag, and push everything

## Conventional Commits

We use conventional commits to auto-generate changelogs:

### Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat`: New feature (appears in changelog)
- `fix`: Bug fix (appears in changelog)
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

### Scopes

- `club`: Club endpoint
- `member`: Member endpoint
- `session`: Session endpoint
- `server`: Server endpoint
- `db`: Database migrations
- `api`: General API changes

### Examples

```bash
# Feature
git commit -m "feat(club): add search by channel functionality"

# Bug fix
git commit -m "fix(member): prevent duplicate member creation"

# Database change
git commit -m "feat(db): add index on clubs.channel_id"

# Breaking change
git commit -m "feat(server): rename server_name to discord_name

BREAKING CHANGE: server_name field removed. Use discord_name instead."
```

## Manual Steps (if needed)

If you need to run individual steps:

```bash
# Step 1: Create release branch
./tools/release/release-step1.sh 1.2.0

# Step 2: Update version and generate changelog
./tools/release/release-step2.sh 1.2.0

# Step 3: Merge and tag
./tools/release/release-step3.sh 1.2.0

# Step 4: Deploy and push
./tools/release/release-step4.sh 1.2.0
```

## Version Numbering

We use semantic versioning: `MAJOR.MINOR.PATCH`

- **MAJOR**: Breaking changes (e.g., 1.0.0 → 2.0.0)
- **MINOR**: New features (e.g., 1.1.0 → 1.2.0)
- **PATCH**: Bug fixes (e.g., 1.1.1 → 1.1.2)

## Deployment Order

The deployment happens in this order for safety:

1. **Database migrations** (`supabase db push`)
   - Ensures schema is ready before code uses it
   - Migrations should be backwards-compatible when possible

2. **Edge functions** (`supabase functions deploy`)
   - Deploys all updated functions
   - New code can now use new schema

## What Gets Deployed

- **All functions**: `club`, `member`, `session`, `server`
- **All pending migrations**: Any new SQL files in `supabase/migrations/`

## Rollback (if needed)

If a deployment breaks production:

```bash
# Find the last working version
git tag

# Checkout that version
git checkout v1.1.0

# Redeploy functions from that version
supabase functions deploy

# Return to main
git checkout main
```

**Note**: Database migrations are NOT rolled back automatically. You'd need to write reverse migrations if needed.

## Changelog

The changelog is automatically generated from commit messages and stored in `CHANGELOG.md`.

Example changelog entry:

```markdown
# [1.2.0] - 2025-10-29

## Features
- **club**: add search by channel functionality
- **session**: support pagination for large result sets

## Bug Fixes
- **member**: prevent duplicate member creation
- **auth**: fix token validation edge case

## Database Changes
- **db**: add index on clubs.channel_id for performance
```

## Troubleshooting

### Tests fail during release

```bash
# Fix the failing tests
deno task test

# Commit the fix
git commit -m "fix(test): resolve failing test"

# Re-run the release step
./tools/release/release-step2.sh 1.2.0
```

### Deployment fails

The script will stop at the failed step. Fix the issue and re-run that specific step:

```bash
# If migrations failed
supabase db push

# If functions failed
supabase functions deploy

# Then continue with step 4
./tools/release/release-step4.sh 1.2.0
```

### Need to abort release

```bash
# Delete the release branch locally
git checkout develop
git branch -D release/1.2.0

# If already pushed to origin
git push origin --delete release/1.2.0
```

## Best Practices

1. **Commit often with good messages** - Better changelogs
2. **Test before releasing** - Tests run automatically in step 2
3. **Use scopes consistently** - Makes changelogs clearer
4. **Keep migrations backwards-compatible** - Avoid deployment issues
5. **Release frequently** - Smaller, safer deployments
6. **Check deployment status** - Verify in Supabase dashboard after release

## Future Improvements

Potential enhancements to consider:

- Slack/Discord notifications on release
- Automated rollback script
- Staging environment for pre-production testing
- GitHub release creation with release notes
- Deployment status checks before merging