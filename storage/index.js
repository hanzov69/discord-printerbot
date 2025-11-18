import dotenv from 'dotenv';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const STORAGE_TYPE = process.env.STORAGE_TYPE || 'file';
const STORAGE_FILE = process.env.STORAGE_FILE || join(process.cwd(), 'data', 'channels.json');
const DATABASE_URL = process.env.DATABASE_URL;

// File storage implementation
class FileStorage {
  constructor(filePath) {
    this.filePath = filePath;
    this.ensureDirectory();
  }

  ensureDirectory() {
    const dir = dirname(this.filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  async load() {
    try {
      if (existsSync(this.filePath)) {
        const data = readFileSync(this.filePath, 'utf-8');
        return JSON.parse(data);
      }
      return {};
    } catch (error) {
      console.error('Error loading from file storage:', error.message);
      return {};
    }
  }

  async save(data) {
    try {
      this.ensureDirectory();
      writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf-8');
      return true;
    } catch (error) {
      console.error('Error saving to file storage:', error.message);
      return false;
    }
  }
}

// PostgreSQL storage implementation
class PostgreSQLStorage {
  constructor(connectionString) {
    this.pool = new pg.Pool({
      connectionString: connectionString,
      ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false
    });
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    try {
      const client = await this.pool.connect();
      await client.query(`
        CREATE TABLE IF NOT EXISTS announce_channels (
          guild_id VARCHAR(255) PRIMARY KEY,
          channel_id VARCHAR(255) NOT NULL,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      client.release();
      this.initialized = true;
      console.log('✅ PostgreSQL storage initialized');
    } catch (error) {
      console.error('❌ Error initializing PostgreSQL storage:', error.message);
      throw error;
    }
  }

  async load() {
    try {
      await this.initialize();
      const client = await this.pool.connect();
      const result = await client.query('SELECT guild_id, channel_id FROM announce_channels');
      client.release();

      const data = {};
      for (const row of result.rows) {
        data[row.guild_id] = row.channel_id;
      }
      return data;
    } catch (error) {
      console.error('Error loading from PostgreSQL storage:', error.message);
      return {};
    }
  }

  async save(data) {
    const client = await this.pool.connect();
    try {
      await this.initialize();

      // Use transaction for atomic updates
      await client.query('BEGIN');

      // Clear existing data
      await client.query('TRUNCATE TABLE announce_channels');

      // Insert all entries using parameterized queries
      if (Object.keys(data).length > 0) {
        for (const [guildId, channelId] of Object.entries(data)) {
          await client.query(
            `INSERT INTO announce_channels (guild_id, channel_id) 
             VALUES ($1, $2)
             ON CONFLICT (guild_id) DO UPDATE SET channel_id = EXCLUDED.channel_id, updated_at = CURRENT_TIMESTAMP`,
            [guildId, channelId]
          );
        }
      }

      await client.query('COMMIT');
      client.release();
      return true;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      client.release();
      console.error('Error saving to PostgreSQL storage:', error.message);
      return false;
    }
  }

  async close() {
    await this.pool.end();
  }
}

// Create storage instance based on configuration
let storage;

if (STORAGE_TYPE === 'postgres' || STORAGE_TYPE === 'postgresql') {
  if (!DATABASE_URL) {
    console.error('❌ ERROR: DATABASE_URL is required when using PostgreSQL storage');
    console.error('Falling back to file storage');
    storage = new FileStorage(STORAGE_FILE);
  } else {
    storage = new PostgreSQLStorage(DATABASE_URL);
  }
} else {
  storage = new FileStorage(STORAGE_FILE);
}

export { storage };

