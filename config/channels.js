import { storage } from '../storage/index.js';

// In-memory cache of announce channels
export const announceChannels = new Map();

// Load channels from storage on startup
export async function loadChannels() {
  try {
    const data = await storage.load();
    announceChannels.clear();
    for (const [guildId, channelId] of Object.entries(data)) {
      announceChannels.set(guildId, channelId);
    }
    console.log(`✅ Loaded ${announceChannels.size} announce channel(s) from ${process.env.STORAGE_TYPE || 'file'} storage`);
  } catch (error) {
    console.error('❌ Error loading channels:', error.message);
  }
}

// Save channels to storage
export async function saveChannels() {
  try {
    const data = {};
    for (const [guildId, channelId] of announceChannels.entries()) {
      data[guildId] = channelId;
    }
    const success = await storage.save(data);
    if (success) {
      console.log(`✅ Saved ${announceChannels.size} announce channel(s) to ${process.env.STORAGE_TYPE || 'file'} storage`);
    }
    return success;
  } catch (error) {
    console.error('❌ Error saving channels:', error.message);
    return false;
  }
}

// Set a channel and save
export async function setChannel(guildId, channelId) {
  announceChannels.set(guildId, channelId);
  await saveChannels();
}

// Get a channel
export function getChannel(guildId) {
  return announceChannels.get(guildId);
}
