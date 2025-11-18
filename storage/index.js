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
const ADMIN_STORAGE_FILE = join(process.cwd(), 'data', 'administrators.json');
const WEBHOOKS_STORAGE_FILE = join(process.cwd(), 'data', 'webhooks.json');
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

  async loadAdministrators() {
    try {
      const adminFilePath = ADMIN_STORAGE_FILE;
      if (existsSync(adminFilePath)) {
        const data = readFileSync(adminFilePath, 'utf-8');
        return JSON.parse(data);
      }
      return {};
    } catch (error) {
      console.error('Error loading administrators from file storage:', error.message);
      return {};
    }
  }

  async saveAdministrators(data) {
    try {
      const adminFilePath = ADMIN_STORAGE_FILE;
      this.ensureDirectory();
      writeFileSync(adminFilePath, JSON.stringify(data, null, 2), 'utf-8');
      return true;
    } catch (error) {
      console.error('Error saving administrators to file storage:', error.message);
      return false;
    }
  }

  async loadWebhooks() {
    try {
      const webhooksFilePath = WEBHOOKS_STORAGE_FILE;
      if (existsSync(webhooksFilePath)) {
        const data = readFileSync(webhooksFilePath, 'utf-8');
        return JSON.parse(data);
      }
      return {};
    } catch (error) {
      console.error('Error loading webhooks from file storage:', error.message);
      return {};
    }
  }

  async saveWebhooks(data) {
    try {
      const webhooksFilePath = WEBHOOKS_STORAGE_FILE;
      this.ensureDirectory();
      writeFileSync(webhooksFilePath, JSON.stringify(data, null, 2), 'utf-8');
      return true;
    } catch (error) {
      console.error('Error saving webhooks to file storage:', error.message);
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
      await client.query(`
        CREATE TABLE IF NOT EXISTS administrators (
          guild_id VARCHAR(255) PRIMARY KEY,
          owner_id VARCHAR(255),
          admin_role_id VARCHAR(255),
          user_ids TEXT[],
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await client.query(`
        CREATE TABLE IF NOT EXISTS custom_webhooks (
          identifier VARCHAR(255) PRIMARY KEY,
          user_id VARCHAR(255) NOT NULL,
          guild_id VARCHAR(255) NOT NULL,
          is_public BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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

  async loadAdministrators() {
    try {
      await this.initialize();
      const client = await this.pool.connect();
      const result = await client.query('SELECT guild_id, owner_id, admin_role_id, user_ids FROM administrators');
      client.release();

      const data = {};
      for (const row of result.rows) {
        data[row.guild_id] = {
          ownerId: row.owner_id,
          adminRoleId: row.admin_role_id,
          userIds: row.user_ids || []
        };
      }
      return data;
    } catch (error) {
      console.error('Error loading administrators from PostgreSQL storage:', error.message);
      return {};
    }
  }

  async saveAdministrators(data) {
    const client = await this.pool.connect();
    try {
      await this.initialize();

      // Use transaction for atomic updates
      await client.query('BEGIN');

      // Clear existing data
      await client.query('TRUNCATE TABLE administrators');

      // Insert all entries using parameterized queries
      if (Object.keys(data).length > 0) {
        for (const [guildId, adminData] of Object.entries(data)) {
          await client.query(
            `INSERT INTO administrators (guild_id, owner_id, admin_role_id, user_ids) 
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (guild_id) DO UPDATE SET owner_id = EXCLUDED.owner_id, admin_role_id = EXCLUDED.admin_role_id, user_ids = EXCLUDED.user_ids, updated_at = CURRENT_TIMESTAMP`,
            [guildId, adminData.ownerId || null, adminData.adminRoleId || null, adminData.userIds || []]
          );
        }
      }

      await client.query('COMMIT');
      client.release();
      return true;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      client.release();
      console.error('Error saving administrators to PostgreSQL storage:', error.message);
      return false;
    }
  }

  async loadWebhooks() {
    try {
      await this.initialize();
      const client = await this.pool.connect();
      const result = await client.query('SELECT identifier, user_id, guild_id, is_public, created_at FROM custom_webhooks');
      client.release();

      const data = {};
      for (const row of result.rows) {
        data[row.identifier] = {
          userId: row.user_id,
          guildId: row.guild_id,
          isPublic: row.is_public !== false, // Default to true if null
          createdAt: row.created_at
        };
      }
      return data;
    } catch (error) {
      console.error('Error loading webhooks from PostgreSQL storage:', error.message);
      return {};
    }
  }

  async saveWebhooks(data) {
    const client = await this.pool.connect();
    try {
      await this.initialize();

      // Use transaction for atomic updates
      await client.query('BEGIN');

      // Clear existing data
      await client.query('TRUNCATE TABLE custom_webhooks');

      // Insert all entries using parameterized queries
      if (Object.keys(data).length > 0) {
        for (const [identifier, webhookData] of Object.entries(data)) {
          await client.query(
            `INSERT INTO custom_webhooks (identifier, user_id, guild_id, is_public, created_at) 
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (identifier) DO UPDATE SET user_id = EXCLUDED.user_id, guild_id = EXCLUDED.guild_id, is_public = EXCLUDED.is_public`,
            [identifier, webhookData.userId, webhookData.guildId, webhookData.isPublic !== false, webhookData.createdAt || new Date().toISOString()]
          );
        }
      }

      await client.query('COMMIT');
      client.release();
      return true;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      client.release();
      console.error('Error saving webhooks to PostgreSQL storage:', error.message);
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

