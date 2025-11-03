#!/bin/bash
# Display what's happening
echo "Refreshing local Supabase environment..."

# Link to production project
supabase link --project-ref ugmntxfkvrnpbmdosdge
echo "✅ Linked to production project"

# Pull the latest schema from production
supabase db pull
echo "✅ Pulled latest schema from production"

# Restart local Supabase with fresh schema
supabase stop
supabase start
echo "✅ Restarted local Supabase instance"

# Reset the database to apply the schema changes
supabase db reset
echo "✅ Reset database with new schema"

# Apply seed data
psql "postgresql://postgres:postgres@localhost:54322/postgres" -f seed.sql
echo "✅ Applied seed data"

# Display status
echo "✅ Local environment refresh complete!"
echo ""
echo "Your local Supabase is running at: http://localhost:54323"
echo "To serve Edge Functions locally: supabase functions serve"