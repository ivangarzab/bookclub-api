// Mock Supabase client for testing
import { SupabaseClient } from 'npm:@supabase/supabase-js@2.76.1';

/**
 * Mock data store for testing
 */
export class MockDatabase {
  servers: Map<string, any> = new Map();
  clubs: Map<string, any> = new Map();
  members: Map<number, any> = new Map();
  sessions: Map<string, any> = new Map();
  books: Map<number, any> = new Map();
  discussions: Map<string, any> = new Map();
  memberClubs: Array<{ member_id: number; club_id: string }> = [];
  shameList: Array<{ member_id: number; club_id: string }> = [];

  private bookIdCounter = 1;

  clear() {
    this.servers.clear();
    this.clubs.clear();
    this.members.clear();
    this.sessions.clear();
    this.books.clear();
    this.discussions.clear();
    this.memberClubs = [];
    this.shameList = [];
    this.bookIdCounter = 1;
  }

  getNextBookId(): number {
    return this.bookIdCounter++;
  }
}

/**
 * Creates a mock Supabase client for testing
 */
export function createMockSupabaseClient(db: MockDatabase): Partial<SupabaseClient> {
  const mockFrom = (table: string) => {
    const query = {
      _filters: [] as Array<{ field: string; value: any; operator: string }>,
      _single: false,
      _select: '*',
      _order: null as { field: string; ascending: boolean } | null,
      _limit: null as number | null,
      _range: null as { from: number; to: number } | null,

      select(columns = '*') {
        query._select = columns;
        return query;
      },

      eq(field: string, value: any) {
        query._filters.push({ field, value, operator: 'eq' });
        return query;
      },

      in(field: string, values: any[]) {
        query._filters.push({ field, value: values, operator: 'in' });
        return query;
      },

      single() {
        query._single = true;
        return query;
      },

      order(field: string, options: { ascending: boolean }) {
        query._order = { field, ascending: options.ascending };
        return query;
      },

      limit(count: number) {
        query._limit = count;
        return query;
      },

      range(from: number, to: number) {
        query._range = { from, to };
        return query;
      },

      insert(data: any) {
        const insertData = Array.isArray(data) ? data : [data];
        const result: any[] = [];

        for (const item of insertData) {
          let newItem = { ...item };

          if (table === 'books' && !item.id) {
            newItem.id = db.getNextBookId();
          }

          switch (table) {
            case 'servers':
              db.servers.set(item.id, newItem);
              break;
            case 'clubs':
              db.clubs.set(item.id, newItem);
              break;
            case 'members':
              db.members.set(item.id, newItem);
              break;
            case 'sessions':
              db.sessions.set(item.id, newItem);
              break;
            case 'books':
              db.books.set(newItem.id, newItem);
              break;
            case 'discussions':
              db.discussions.set(item.id, newItem);
              break;
            case 'memberclubs':
              db.memberClubs.push(item);
              break;
            case 'shamelist':
              db.shameList.push(item);
              break;
          }

          result.push(newItem);
        }

        // Return a chainable object that supports .select()
        return {
          data: result,
          error: null,
          select: () => Promise.resolve({ data: result, error: null })
        };
      },

      update(data: any) {
        const results: any[] = [];
        const collection = getCollection(table);

        if (Array.isArray(collection) || collection instanceof Map) {
          const items = getFilteredItems(table, query._filters, collection);

          for (const item of items) {
            const updated = { ...item, ...data };
            updateItem(table, item, updated);
            results.push(updated);
          }
        }

        // Create a new query-like object for chaining
        const chainable = {
          data: results,
          error: null,
          select: () => Promise.resolve({ data: results, error: null }),
          eq: (field: string, value: any) => chainable,
          then: (resolve: any) => resolve({ data: results, error: null })
        };

        return chainable;
      },

      upsert(data: any) {
        const upsertData = Array.isArray(data) ? data : [data];
        const result: any[] = [];

        for (const item of upsertData) {
          let newItem = { ...item };

          // Check if item already exists
          const collection = getCollection(table);
          let existingItem = null;

          if (collection instanceof Map && item.id !== undefined) {
            existingItem = collection.get(item.id);
          }

          // If exists, update it; otherwise insert it
          if (existingItem) {
            const updated = { ...existingItem, ...newItem };
            updateItem(table, existingItem, updated);
            result.push(updated);
          } else {
            // Handle auto-generated IDs for books
            if (table === 'books' && !item.id) {
              newItem.id = db.getNextBookId();
            }

            // Insert the new item
            switch (table) {
              case 'servers':
                db.servers.set(newItem.id, newItem);
                break;
              case 'clubs':
                db.clubs.set(newItem.id, newItem);
                break;
              case 'members':
                db.members.set(newItem.id, newItem);
                break;
              case 'sessions':
                db.sessions.set(newItem.id, newItem);
                break;
              case 'books':
                db.books.set(newItem.id, newItem);
                break;
              case 'discussions':
                db.discussions.set(newItem.id, newItem);
                break;
              case 'memberclubs':
                db.memberClubs.push(newItem);
                break;
              case 'shamelist':
                db.shameList.push(newItem);
                break;
            }
            result.push(newItem);
          }
        }

        // Return a promise-like object
        return {
          data: result,
          error: null,
          then: (resolve: any) => resolve({ data: result, error: null })
        };
      },

      delete() {
        const collection = getCollection(table);
        const itemsToDelete = getFilteredItems(table, query._filters, collection);

        for (const item of itemsToDelete) {
          deleteItem(table, item);
        }

        // Create a new query-like object for chaining (needed for .eq() and .in() after .delete())
        const chainable = {
          data: null,
          error: null,
          eq: (field: string, value: any) => chainable,
          in: (field: string, values: any[]) => chainable,
          then: (resolve: any) => resolve({ data: null, error: null })
        };

        return chainable;
      },

      async then(resolve: any) {
        const collection = getCollection(table);
        let items = getFilteredItems(table, query._filters, collection);

        // Apply ordering
        if (query._order) {
          items.sort((a, b) => {
            const aVal = a[query._order!.field];
            const bVal = b[query._order!.field];
            const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
            return query._order!.ascending ? comparison : -comparison;
          });
        }

        // Apply limit
        if (query._limit !== null) {
          items = items.slice(0, query._limit);
        }

        // Apply range
        if (query._range !== null) {
          items = items.slice(query._range.from, query._range.to + 1);
        }

        // Return single or array
        if (query._single) {
          const result = items.length > 0 ? items[0] : null;
          return resolve({ data: result, error: result ? null : { message: 'Not found' } });
        }

        return resolve({ data: items, error: null });
      },
    };

    return query;
  };

  const getCollection = (table: string) => {
    switch (table) {
      case 'servers': return db.servers;
      case 'clubs': return db.clubs;
      case 'members': return db.members;
      case 'sessions': return db.sessions;
      case 'books': return db.books;
      case 'discussions': return db.discussions;
      case 'memberclubs': return db.memberClubs;
      case 'shamelist': return db.shameList;
      default: return new Map();
    }
  };

  const getFilteredItems = (table: string, filters: any[], collection: any) => {
    let items: any[] = [];

    if (collection instanceof Map) {
      items = Array.from(collection.values());
    } else if (Array.isArray(collection)) {
      items = [...collection];
    }

    for (const filter of filters) {
      if (filter.operator === 'eq') {
        items = items.filter(item => {
          // Use loose equality to handle string/number mismatches (like real Supabase)
          return item[filter.field] == filter.value;
        });
      } else if (filter.operator === 'in') {
        items = items.filter(item => filter.value.includes(item[filter.field]));
      }
    }

    return items;
  };

  const updateItem = (table: string, oldItem: any, newItem: any) => {
    switch (table) {
      case 'servers':
        db.servers.set(oldItem.id, newItem);
        break;
      case 'clubs':
        db.clubs.set(oldItem.id, newItem);
        break;
      case 'members':
        db.members.set(oldItem.id, newItem);
        break;
      case 'sessions':
        db.sessions.set(oldItem.id, newItem);
        break;
      case 'books':
        db.books.set(oldItem.id, newItem);
        break;
      case 'discussions':
        db.discussions.set(oldItem.id, newItem);
        break;
    }
  };

  const deleteItem = (table: string, item: any) => {
    switch (table) {
      case 'servers':
        db.servers.delete(item.id);
        break;
      case 'clubs':
        db.clubs.delete(item.id);
        break;
      case 'members':
        db.members.delete(item.id);
        break;
      case 'sessions':
        db.sessions.delete(item.id);
        break;
      case 'books':
        db.books.delete(item.id);
        break;
      case 'discussions':
        db.discussions.delete(item.id);
        break;
      case 'memberclubs':
        const mcIndex = db.memberClubs.findIndex(mc =>
          mc.member_id === item.member_id && mc.club_id === item.club_id
        );
        if (mcIndex !== -1) db.memberClubs.splice(mcIndex, 1);
        break;
      case 'shamelist':
        const slIndex = db.shameList.findIndex(sl =>
          sl.member_id === item.member_id && sl.club_id === item.club_id
        );
        if (slIndex !== -1) db.shameList.splice(slIndex, 1);
        break;
    }
  };

  return {
    from: mockFrom,
  } as any;
}
