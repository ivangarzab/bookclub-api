-- Migration: Create clubs_with_server view
-- This view joins clubs with their server information for easier querying

CREATE OR REPLACE VIEW "public"."clubs_with_server" AS
SELECT
    c.id,
    c.name,
    c.discord_channel,
    c.server_id,
    s.name AS server_name
FROM clubs c
JOIN servers s ON c.server_id = s.id;

-- Grant permissions on the view
GRANT SELECT ON "public"."clubs_with_server" TO "anon";
GRANT SELECT ON "public"."clubs_with_server" TO "authenticated";
GRANT SELECT ON "public"."clubs_with_server" TO "service_role";
