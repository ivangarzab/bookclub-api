-- Test data fixtures for integration tests
-- This file can be used to seed the test database with known data

-- Clean up any existing test data
DELETE FROM discussions WHERE session_id IN (SELECT id FROM sessions WHERE club_id LIKE 'test-%');
DELETE FROM sessions WHERE club_id LIKE 'test-%';
DELETE FROM books WHERE title LIKE 'Test Book%';
DELETE FROM shamelist WHERE club_id LIKE 'test-%';
DELETE FROM memberclubs WHERE club_id LIKE 'test-%';
DELETE FROM members WHERE name LIKE 'Test Member%';
DELETE FROM clubs WHERE id LIKE 'test-%';
DELETE FROM servers WHERE id >= 9999999999999999990;

-- Insert test servers
INSERT INTO servers (id, name) VALUES
  (9999999999999999991, 'Test Server 1'),
  (9999999999999999992, 'Test Server 2')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- Insert test clubs
INSERT INTO clubs (id, name, discord_channel, server_id) VALUES
  ('test-club-1', 'Test Club 1', 1111111111111111111, 9999999999999999991),
  ('test-club-2', 'Test Club 2', 2222222222222222222, 9999999999999999991)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  discord_channel = EXCLUDED.discord_channel,
  server_id = EXCLUDED.server_id;

-- Insert test members
INSERT INTO members (id, name, points, books_read) VALUES
  (9001, 'Test Member 1', 100, 5),
  (9002, 'Test Member 2', 50, 2)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  points = EXCLUDED.points,
  books_read = EXCLUDED.books_read;

-- Associate members with clubs
INSERT INTO memberclubs (member_id, club_id) VALUES
  (9001, 'test-club-1'),
  (9002, 'test-club-1')
ON CONFLICT DO NOTHING;

-- Insert test books
INSERT INTO books (id, title, author, edition, year, isbn) VALUES
  (9001, 'Test Book 1', 'Test Author 1', '1st Edition', 2020, '978-0000000001'),
  (9002, 'Test Book 2', 'Test Author 2', '2nd Edition', 2021, '978-0000000002')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  author = EXCLUDED.author,
  edition = EXCLUDED.edition,
  year = EXCLUDED.year,
  isbn = EXCLUDED.isbn;

-- Insert test sessions
INSERT INTO sessions (id, club_id, book_id, due_date) VALUES
  ('test-session-1', 'test-club-1', 9001, '2025-12-31'),
  ('test-session-2', 'test-club-2', 9002, '2025-11-30')
ON CONFLICT (id) DO UPDATE SET
  club_id = EXCLUDED.club_id,
  book_id = EXCLUDED.book_id,
  due_date = EXCLUDED.due_date;

-- Insert test discussions
INSERT INTO discussions (id, session_id, title, date, location) VALUES
  ('test-discussion-1', 'test-session-1', 'Test Discussion 1', '2025-11-15', 'Discord'),
  ('test-discussion-2', 'test-session-1', 'Test Discussion 2', '2025-11-22', 'Discord')
ON CONFLICT (id) DO UPDATE SET
  session_id = EXCLUDED.session_id,
  title = EXCLUDED.title,
  date = EXCLUDED.date,
  location = EXCLUDED.location;

-- Insert shame list entries
INSERT INTO shamelist (club_id, member_id) VALUES
  ('test-club-1', 9001)
ON CONFLICT DO NOTHING;
