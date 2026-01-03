import { plainToInstance } from 'class-transformer';
import type { DatabaseSync } from 'node:sqlite';
import { Injectable } from '@nestjs/common';
import { User } from './user';
import { Tokens } from '../tokens';
import { Inject } from '@nestjs/common';

export type CreateUser = Omit<
  User,
  'id' | 'createdAt' | 'updatedAt' | 'version'
>;
export type UpdateUser = Partial<Omit<User, 'id' | 'createdAt' | 'version'>>;

interface UserRow {
  id: string;
  user_name: string;
  manager_id: string | null;
  email: string;
  alternate_email: string | null;
  first_name: string;
  last_name: string | null;
  phone: string | null;
  alternate_phone: string | null;
  street_address: string | null;
  street_address2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  attributes: string | null;
  created_at: string;
  updated_at: string | null;
  version: string;
}

/**
 * Service for managing users.
 * Users are stored in a SQLite database.
 */
@Injectable()
export class UserRepository {
  constructor(@Inject(Tokens.Sqlite) private readonly db: DatabaseSync) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        user_name TEXT NOT NULL,
        manager_id TEXT,
        email TEXT NOT NULL,
        alternate_email TEXT NULL,
        first_name TEXT NOT NULL,
        last_name TEXT,
        phone TEXT,
        alternate_phone TEXT,
        street_address TEXT,
        street_address2 TEXT,
        city TEXT,
        state TEXT,
        postal_code TEXT,
        country TEXT,
        attributes BLOB NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NULL,
        version TEXT NOT NULL
      )
    `);
  }

  /**
   * Create a new user
   */
  create(user: CreateUser): User {
    const now = new Date();
    const id = this.generateId();
    const row = this.userToRow(
      {
        ...user,
        id,
        createdAt: now,
        version: '1',
      },
      now,
    );

    const stmt = this.db.prepare(`
      INSERT INTO users (
        id, user_name, manager_id, email, alternate_email,
        first_name, last_name, mobile_phone, home_phone, office_phone,
        street_address, street_address2, city, state, postal_code, country,
        attributes, created_at, version
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?
      )
    `);

    stmt.run(
      row.id,
      row.user_name,
      row.manager_id,
      row.email,
      row.alternate_email,
      row.first_name,
      row.last_name,
      row.phone,
      row.alternate_phone,
      row.street_address,
      row.street_address2,
      row.city,
      row.state,
      row.postal_code,
      row.country,
      row.attributes,
      row.created_at,
      row.version,
    );

    return this.findById(id)!;
  }

  /**
   * Find a user by ID
   */
  findById(id: string): User | null {
    const stmt = this.db.prepare('SELECT * FROM users WHERE id = ?');
    const row = stmt.get(id) as UserRow | undefined;
    return row ? this.rowToUser(row) : null;
  }

  /**
   * Find all users
   */
  findAll(): User[] {
    const stmt = this.db.prepare('SELECT * FROM users');
    const rows = stmt.all() as unknown as UserRow[];
    return rows.map((row) => this.rowToUser(row));
  }

  /**
   * Find a user by username
   */
  findByUserName(userName: string): User | null {
    const stmt = this.db.prepare('SELECT * FROM users WHERE user_name = ?');
    const row = stmt.get(userName) as UserRow | undefined;
    return row ? this.rowToUser(row) : null;
  }

  /**
   * Find users by email (primary or alternate)
   */
  findByEmail(email: string): User[] {
    const stmt = this.db.prepare(
      'SELECT * FROM users WHERE email = ? OR alternate_email = ?',
    );
    const rows = stmt.all(email, email) as unknown as UserRow[];
    return rows.map((row) => this.rowToUser(row));
  }

  /**
   * Find users by manager ID
   */
  findByManager(managerId: string): User[] {
    const stmt = this.db.prepare('SELECT * FROM users WHERE manager_id = ?');
    const rows = stmt.all(managerId) as unknown as UserRow[];
    return rows.map((row) => this.rowToUser(row));
  }

  /**
   * Update an existing user
   */
  update(id: string, updates: UpdateUser): User | null {
    const existing = this.findById(id);
    if (!existing) {
      return null;
    }

    const updatedUser = plainToInstance(User, {
      ...existing,
      ...updates,
      id: existing.id, // Ensure ID cannot be changed
      createdAt: existing.createdAt, // Ensure createdAt cannot be changed
      updatedAt: new Date(),
      version: String(parseInt(existing.version ?? '0', 10) + 1), // Increment version
    });

    const row = this.userToRow(updatedUser, updatedUser.updatedAt);

    const stmt = this.db.prepare(`
      UPDATE users SET
        user_name = ?,
        manager_id = ?,
        email = ?,
        alternate_email = ?,
        first_name = ?,
        last_name = ?,
        phone = ?,
        alternate_phone = ?,
        street_address = ?,
        street_address2 = ?,
        city = ?,
        state = ?,
        postal_code = ?,
        country = ?,
        attributes = ?,
        updated_at = ?,
        version = ?
      WHERE id = ?
    `);

    stmt.run(
      row.user_name,
      row.manager_id,
      row.email,
      row.alternate_email,
      row.first_name,
      row.last_name,
      row.phone,
      row.alternate_phone,
      row.street_address,
      row.street_address2,
      row.city,
      row.state,
      row.postal_code,
      row.country,
      row.attributes,
      row.updated_at,
      row.version,
      id,
    );

    return this.findById(id)!;
  }

  /**
   * Delete a user by ID
   */
  delete(id: string): boolean {
    const user = this.findById(id);
    if (!user) {
      return false;
    }

    const stmt = this.db.prepare('DELETE FROM users WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  /**
   * Convert User object to database row
   */
  private userToRow(user: User, updatedAt?: Date): UserRow {
    return {
      id: user.id,
      user_name: user.userName,
      manager_id: user.managerId ?? null,
      email: user.email.primary,
      alternate_email: user.email.alternate ?? null,
      first_name: user.name.firstName,
      last_name: user.name.lastName ?? null,
      phone: user.phone?.primary ?? null,
      alternate_phone: user.phone?.alternate ?? null,
      street_address: user.address?.street || null,
      street_address2: user.address?.street2 || null,
      city: user.address?.city || null,
      state: user.address?.state || null,
      postal_code: user.address?.postalCode || null,
      country: user.address?.country || null,
      attributes: user.attributes ? JSON.stringify(user.attributes) : null,
      created_at: user.createdAt.toISOString(),
      updated_at: updatedAt
        ? updatedAt.toISOString()
        : user.updatedAt?.toISOString() || null,
      version: user.version,
    };
  }

  /**
   * Convert database row to User object
   */
  private rowToUser(row: UserRow): User {
    const user = new User();
    user.id = row.id;
    user.userName = row.user_name;
    user.managerId = row.manager_id ?? undefined;
    user.email = {
      primary: row.email,
      alternate: row.alternate_email ?? undefined,
    };
    user.name = {
      firstName: row.first_name,
      lastName: row.last_name ?? undefined,
    };
    if (row.phone) {
      user.phone = {
        primary: row.phone,
        alternate: row.alternate_phone ?? undefined,
      };
    }
    if (
      row.street_address ||
      row.city ||
      row.state ||
      row.postal_code ||
      row.country
    ) {
      user.address = {
        street: row.street_address!,
        street2: row.street_address2 || undefined,
        city: row.city!,
        state: row.state!,
        postalCode: row.postal_code!,
        country: row.country!,
      };
    }
    user.attributes = row.attributes
      ? (JSON.parse(row.attributes) as Record<
          string,
          string | number | boolean
        >)
      : undefined;
    user.createdAt = new Date(row.created_at);
    user.updatedAt = row.updated_at ? new Date(row.updated_at) : undefined;
    user.version = row.version;
    return user;
  }

  /**
   * Generate a unique ID for new users
   */
  private generateId(): string {
    return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
