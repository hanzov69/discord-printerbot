import { storage } from '../storage/index.js';

// In-memory cache of custom webhook endpoints
// Structure: { identifier: { userId: string, guildId: string, isPublic: boolean, createdAt: timestamp } }
export const customWebhooks = new Map();

// Load webhooks from storage on startup
export async function loadWebhooks() {
  try {
    const data = await storage.loadWebhooks();
    customWebhooks.clear();
    for (const [identifier, webhookData] of Object.entries(data)) {
      // Ensure isPublic defaults to true for backward compatibility
      customWebhooks.set(identifier, {
        ...webhookData,
        isPublic: webhookData.isPublic !== false
      });
    }
    console.log(`✅ Loaded ${customWebhooks.size} custom webhook endpoint(s) from ${process.env.STORAGE_TYPE || 'file'} storage`);
  } catch (error) {
    console.error('❌ Error loading webhooks:', error.message);
  }
}

// Save webhooks to storage
export async function saveWebhooks() {
  try {
    const data = {};
    for (const [identifier, webhookData] of customWebhooks.entries()) {
      data[identifier] = webhookData;
    }
    const success = await storage.saveWebhooks(data);
    if (success) {
      console.log(`✅ Saved ${customWebhooks.size} custom webhook endpoint(s) to ${process.env.STORAGE_TYPE || 'file'} storage`);
    }
    return success;
  } catch (error) {
    console.error('❌ Error saving webhooks:', error.message);
    return false;
  }
}

// Create a new custom webhook endpoint
export async function createWebhook(userId, guildId, identifier, isPublic = true) {
  // Check if identifier already exists
  if (customWebhooks.has(identifier)) {
    throw new Error('This webhook identifier is already taken');
  }
  
  // Validate identifier (alphanumeric and hyphens only, 3-50 chars)
  if (!/^[a-zA-Z0-9-]{3,50}$/.test(identifier)) {
    throw new Error('Identifier must be 3-50 characters and contain only letters, numbers, and hyphens');
  }
  
  customWebhooks.set(identifier, {
    userId: userId,
    guildId: guildId,
    isPublic: isPublic !== false, // Default to true
    createdAt: new Date().toISOString()
  });
  
  await saveWebhooks();
  return identifier;
}

// Update webhook public/private status
export async function updateWebhookPrivacy(identifier, userId, isPublic) {
  const webhook = customWebhooks.get(identifier);
  if (!webhook) {
    throw new Error('Webhook not found');
  }
  
  if (webhook.userId !== userId) {
    throw new Error('You do not have permission to update this webhook');
  }
  
  webhook.isPublic = isPublic;
  await saveWebhooks();
  return true;
}

// Get webhook by identifier
export function getWebhook(identifier) {
  return customWebhooks.get(identifier);
}

// Get all webhooks for a user
export function getUserWebhooks(userId) {
  const userWebhooks = [];
  for (const [identifier, webhookData] of customWebhooks.entries()) {
    if (webhookData.userId === userId) {
      userWebhooks.push({
        identifier: identifier,
        ...webhookData
      });
    }
  }
  return userWebhooks;
}

// Get all webhooks for a guild
export function getGuildWebhooks(guildId) {
  const guildWebhooks = [];
  for (const [identifier, webhookData] of customWebhooks.entries()) {
    if (webhookData.guildId === guildId) {
      guildWebhooks.push({
        identifier: identifier,
        ...webhookData
      });
    }
  }
  return guildWebhooks;
}

// Delete a webhook
export async function deleteWebhook(identifier, userId) {
  const webhook = customWebhooks.get(identifier);
  if (!webhook) {
    throw new Error('Webhook not found');
  }
  
  if (webhook.userId !== userId) {
    throw new Error('You do not have permission to delete this webhook');
  }
  
  customWebhooks.delete(identifier);
  await saveWebhooks();
  return true;
}

