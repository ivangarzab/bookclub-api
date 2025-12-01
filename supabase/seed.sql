-- Set data for local testing
-- seed.sql for Book Club Database (Multi-Server Version)
-- This file populates the local development database with sample data

-- Insert sample Discord servers (using text for Snowflake IDs)
INSERT INTO Servers (id, name) VALUES
('1039326367428395038', 'Production Server'),
('1234567890123456789', 'Test Server Alpha'),
('987654321098765432', 'Test Server Beta');

-- Insert sample book clubs (using text for Snowflake IDs)
INSERT INTO Clubs (id, name, discord_channel, server_id, founded_date) VALUES
('club-1', 'Freaks & Geeks', '987654321098765432', '1039326367428395038', '2024-01-15'),
('club-2', 'Blingers Pilingers', '876543210987654321', '1039326367428395038', '2024-02-20'),
('club-3', 'Trifecta', '765432109876543210', '1234567890123456789', '2024-03-10'),
('club-4', 'Mystery Readers', '555666777888999000', '1234567890123456789', '2024-04-05'),
('club-5', 'Sci-Fi Enthusiasts', '111222333444555666', '987654321098765432', '2024-05-12');

-- Insert sample members (now with user_id, role, and created_at)
-- Note: created_at has DEFAULT NOW() in schema, but we can override for consistent test data
INSERT INTO Members (id, name, points, books_read, user_id, role, created_at) VALUES
(1, 'Ivan Garza', 250, 20, '550e8400-e29b-41d4-a716-446655440000', 'admin', '2024-01-15T10:30:00+00:00'),
(2, 'Monica Morales', 120, 8, NULL, 'member', '2024-01-20T14:15:00+00:00'),
(3, 'Marco Rivera', 150, 12, NULL, 'member', '2024-02-01T09:00:00+00:00'),
(4, 'Anacleto Longoria', 60, 4, NULL, 'member', '2024-02-10T16:45:00+00:00'),
(5, 'Joel Salinas', 200, 15, '550e8400-e29b-41d4-a716-446655440001', 'admin', '2024-02-15T11:20:00+00:00'),
(6, 'Jorge Longoria', 75, 5, NULL, 'member', '2024-03-01T13:30:00+00:00'),
(7, 'Test User Alpha', 50, 3, '550e8400-e29b-41d4-a716-446655440002', 'member', '2024-03-15T08:45:00+00:00'),
(8, 'Test User Beta', 180, 11, '550e8400-e29b-41d4-a716-446655440003', 'member', '2024-04-01T15:00:00+00:00');

-- Connect members to clubs
INSERT INTO MemberClubs (member_id, club_id) VALUES
-- Production Server clubs
(1, 'club-1'),
(1, 'club-2'),
(2, 'club-1'),
(2, 'club-2'),
(5, 'club-1'),
(5, 'club-2'),
-- Test Server Alpha clubs
(3, 'club-3'),
(4, 'club-3'),
(4, 'club-4'),
(7, 'club-3'),
(7, 'club-4'),
-- Test Server Beta clubs
(6, 'club-5'),
(8, 'club-5');

-- Insert sample books (now with page_count)
INSERT INTO Books (id, title, author, edition, year, ISBN, page_count) VALUES
(1, 'The Republic', 'Plato', 'Reeve Edition', -380, '978-0872207363', 416),
(2, 'Das Kapital', 'Karl Marx', 'Penguin Classics', 1867, '978-0140445688', 1152),
(3, 'My Birth Day', 'Ivan Garza Bermea', 'Illustrated', 1992, '978-0618260300', 32),
(4, 'Nicomachean Ethics', 'Aristotle', 'Mass Market Paperback', -2000, '978-0553293357', 368),
(5, '1984', 'George Orwell', 'Eye Edition', 1948, '978-0062073488', 328),
(6, 'Our First Day With Her', 'Skye Garza Morales', 'Boxed Set', 2021, '978-0618640157', 24),
(7, 'Dune', 'Frank Herbert', 'Paperback', 1965, '978-0441013593', 688),
(8, 'The Murder of Roger Ackroyd', 'Agatha Christie', 'Mass Market', 1926, '978-0062073563', 288);

-- Insert sample reading sessions
INSERT INTO Sessions (id, club_id, book_id, due_date) VALUES
-- Production Server sessions
('session-1', 'club-1', 1, '2025-04-15'),
('session-2', 'club-2', 2, '2025-04-20'),
('session-7', 'club-1', 4, '2025-05-10'),
('session-8', 'club-2', 5, '2025-05-15'),
-- Test Server Alpha sessions
('session-3', 'club-3', 3, '2025-04-25'),
('session-4', 'club-4', 8, '2025-05-05'),
-- Test Server Beta sessions
('session-5', 'club-5', 7, '2025-05-01'),
('session-6', 'club-5', 6, '2025-05-20');

-- Insert sample discussions
INSERT INTO Discussions (id, session_id, title, date, location) VALUES
('disc-1', 'session-1', 'Looking outside of the Cave', '2025-04-15', 'Discord Voice Channel'),
('disc-2', 'session-2', 'Communism 101', '2025-04-20', 'Discord Text Channel'),
('disc-3', 'session-3', 'First Day Ever', '2025-04-25', 'Discord Voice Channel'),
('disc-4', 'session-7', 'Looking Past the Academy', '2025-05-10', 'Discord Voice Channel'),
('disc-5', 'session-8', 'Big Brother is watching', '2025-05-15', 'Discord Text Channel'),
('disc-6', 'session-6', 'The cutest thing to ever live!', '2025-05-20', 'Discord Voice Channel'),
('disc-7', 'session-4', 'Whodunit Discussion', '2025-05-05', 'Discord Voice Channel'),
('disc-8', 'session-5', 'Spice Must Flow', '2025-05-01', 'Discord Text Channel');

-- Insert shame list (members who didn't complete readings) - now club-based
INSERT INTO ShameList (club_id, member_id) VALUES
-- Production Server shame
('club-1', 2),
('club-2', 1),
('club-1', 5),
('club-2', 2),
-- Test Server Alpha shame
('club-3', 4),
('club-4', 7),
-- Test Server Beta shame
('club-5', 6);

-- Reset the Books sequence to continue from our manually inserted IDs
SELECT setval('books_id_seq', (SELECT MAX(id) FROM Books), true);