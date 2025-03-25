#!/bin/bash
# refresh-local-env.sh

# Pull latest from production
supabase link --project-ref ugmntxfkvrnpbmdosdge
supabase db pull

# Reset local environment
supabase stop
supabase start 
supabase db reset

# Apply seed data -- this command might not be needed
#psql "postgresql://postgres:postgres@localhost:5432/postgres" -f seed.sql

echo "Local environment refreshed with latest production schema and seed data!"
