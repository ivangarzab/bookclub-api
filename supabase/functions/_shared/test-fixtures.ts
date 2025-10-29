// Test fixtures and sample data for edge function tests

export const TEST_SERVER_ID = "123456789012345678";
export const TEST_SERVER_ID_2 = "987654321098765432";

export const mockServer = {
  id: TEST_SERVER_ID,
  name: "Test Discord Server"
};

export const mockServer2 = {
  id: TEST_SERVER_ID_2,
  name: "Test Discord Server 2"
};

export const mockClub = {
  id: "club-1",
  name: "Science Fiction Book Club",
  discord_channel: "sci-fi-club",
  server_id: TEST_SERVER_ID
};

export const mockClub2 = {
  id: "club-2",
  name: "Fantasy Book Club",
  discord_channel: "fantasy-club",
  server_id: TEST_SERVER_ID
};

export const mockMember = {
  id: 1,
  name: "Alice Johnson",
  points: 100,
  books_read: 5,
  user_id: null,
  role: null
};

export const mockMember2 = {
  id: 2,
  name: "Bob Smith",
  points: 50,
  books_read: 2,
  user_id: null,
  role: null
};

export const mockBook = {
  id: 1,
  title: "Dune",
  author: "Frank Herbert",
  edition: "First Edition",
  year: 1965,
  isbn: "978-0441172719"
};

export const mockBook2 = {
  id: 2,
  title: "Foundation",
  author: "Isaac Asimov",
  edition: null,
  year: 1951,
  isbn: "978-0553293357"
};

export const mockSession = {
  id: "session-1",
  club_id: "club-1",
  book_id: 1,
  due_date: "2025-12-31"
};

export const mockDiscussion = {
  id: "discussion-1",
  session_id: "session-1",
  title: "Part 1: Chapters 1-5",
  date: "2025-11-15",
  location: "Discord Voice Channel"
};

export const mockDiscussion2 = {
  id: "discussion-2",
  session_id: "session-1",
  title: "Part 2: Chapters 6-10",
  date: "2025-11-22",
  location: "Discord Voice Channel"
};

/**
 * Creates a complete club with members, session, and discussions
 */
export function createFullClubData(serverId = TEST_SERVER_ID) {
  return {
    id: "full-club-1",
    name: "Complete Book Club",
    discord_channel: "complete-club",
    server_id: serverId,
    members: [
      {
        id: 10,
        name: "Member One",
        points: 100,
        books_read: 3
      },
      {
        id: 11,
        name: "Member Two",
        points: 50,
        books_read: 1
      }
    ],
    active_session: {
      id: "full-session-1",
      book: {
        title: "The Hobbit",
        author: "J.R.R. Tolkien",
        edition: "Anniversary Edition",
        year: 1937,
        isbn: "978-0547928227"
      },
      due_date: "2025-12-15",
      discussions: [
        {
          id: "full-disc-1",
          title: "Introduction Discussion",
          date: "2025-11-01",
          location: "Discord"
        }
      ]
    },
    shame_list: [10]
  };
}

/**
 * Creates test data for session creation
 */
export function createSessionData(clubId = "club-1") {
  return {
    club_id: clubId,
    book: {
      title: "Neuromancer",
      author: "William Gibson",
      edition: "First Edition",
      year: 1984,
      isbn: "978-0441569595"
    },
    due_date: "2025-12-01",
    discussions: [
      {
        title: "Opening Discussion",
        date: "2025-11-10",
        location: "Discord"
      }
    ]
  };
}

/**
 * Creates test data for member creation
 */
export function createMemberData(name = "Test Member") {
  return {
    name,
    points: 0,
    books_read: 0,
    clubs: []
  };
}
