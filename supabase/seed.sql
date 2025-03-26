-- Set data for local testing
-- seed.sql for Book Club Database
-- This file populates the local development database with sample data

-- Insert sample book clubs
INSERT INTO Clubs (id, name, discord_channel) VALUES
('club-1', 'Freaks & Geeks', 987654321098765432),
('club-2', 'Blingers Pilingers', 876543210987654321),
('club-3', 'Trifecta', 765432109876543210);

-- Insert sample members
INSERT INTO Members (id, name, points, books_read) VALUES
(1, 'Ivan Garza Bermea', 120, 8),
(2, 'Monica M. Morales', 95, 6),
(3, 'Marco Rivera', 150, 12),
(4, 'Anacleto Longoria', 60, 4),
(5, 'Joel Salinas', 200, 15),
(6, 'Jorge Longoria', 75, 5);

-- Connect members to clubs
INSERT INTO MemberClubs (member_id, club_id) VALUES
(1, 'club-1'),
(1, 'club-3'),
(2, 'club-1'),
(2, 'club-2'),
(3, 'club-2'),
(4, 'club-3'),
(5, 'club-1'),
(5, 'club-2'),
(5, 'club-3'),
(6, 'club-2');

-- Insert sample books
INSERT INTO Books (id, title, author, edition, year, ISBN) VALUES
(1, 'The Republic', 'Plato', 'Deluxe Edition', -2500, '978-0441172719'),
(2, 'Capital: Vol. 1', 'Karl Marx', 'Reprint', 1864, '978-0062693662'),
(3, 'My Birth Day', 'Ivan Garza Bermea', 'Illustrated', 1992, '978-0618260300'),
(4, 'Nicomachean Ethics', 'Aristotle', 'Mass Market Paperback', -2000, '978-0553293357'),
(5, '1984', 'George Orwell', 'Eye Edition', 1948, '978-0062073488'),
(6, 'Our First Day With Her', 'Skye Garza Morales', 'Boxed Set', 2021, '978-0618640157');

-- Insert sample reading sessions
INSERT INTO Sessions (id, club_id, book_id, due_date) VALUES
('session-1', 'club-1', 1, '2025-04-15'),
('session-2', 'club-2', 2, '2025-04-20'),
('session-3', 'club-3', 3, '2025-04-25'),
('session-4', 'club-1', 4, '2025-05-10'),
('session-5', 'club-2', 5, '2025-05-15'),
('session-6', 'club-3', 6, '2025-05-20');

-- Insert sample discussions
INSERT INTO Discussions (id, session_id, title, date, location) VALUES
('disc-1', 'session-1', 'Looking outside of the Cave', '2025-04-15', 'Discord Voice Channel'),
('disc-2', 'session-2', 'Communism 101', '2025-04-20', 'Discord Text Channel'),
('disc-3', 'session-3', 'First Day Ever', '2025-04-25', 'Discord Voice Channel'),
('disc-4', 'session-4', 'Looking Past the Academy', '2025-05-10', 'Discord Voice Channel'),
('disc-5', 'session-5', 'Big Brother is watching', '2025-05-15', 'Discord Text Channel'),
('disc-6', 'session-6', 'The cutest thing to ever live!', '2025-05-20', 'Discord Voice Channel');

-- Insert shame list (members who didn't complete readings)
INSERT INTO ShameList (club_id, member_id) VALUES
('club-1', 2),
('club-2', 1),
('club-3', 4),
('club-1', 5),
('club-2', 6),
('club-3', 3);

-- Reset the Books sequence to continue from our manually inserted IDs
SELECT setval('books_id_seq', (SELECT MAX(id) FROM Books), true);
