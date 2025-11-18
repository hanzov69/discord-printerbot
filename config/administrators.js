import { storage } from '../storage/index.js';

// In-memory cache of administrators
// Structure: { guildId: { ownerId: string, adminRoleId: string | null, userIds: string[] } }
export const administrators = new Map();

// Load administrators from storage on startup
export async function loadAdministrators() {
  try {
    const data = await storage.loadAdministrators();
    administrators.clear();
    for (const [guildId, adminData] of Object.entries(data)) {
      administrators.set(guildId, adminData);
    }
    console.log(`✅ Loaded administrators for ${administrators.size} guild(s) from ${process.env.STORAGE_TYPE || 'file'} storage`);
  } catch (error) {
    console.error('❌ Error loading administrators:', error.message);
  }
}

// Save administrators to storage
export async function saveAdministrators() {
  try {
    const data = {};
    for (const [guildId, adminData] of administrators.entries()) {
      data[guildId] = adminData;
    }
    const success = await storage.saveAdministrators(data);
    if (success) {
      console.log(`✅ Saved administrators for ${administrators.size} guild(s) to ${process.env.STORAGE_TYPE || 'file'} storage`);
    }
    return success;
  } catch (error) {
    console.error('❌ Error saving administrators:', error.message);
    return false;
  }
}

// Initialize administrator for a guild (set owner as admin)
export async function initializeGuildAdmin(guildId, ownerId) {
  if (!administrators.has(guildId)) {
    administrators.set(guildId, {
      ownerId: ownerId,
      adminRoleId: null,
      userIds: [ownerId]
    });
    await saveAdministrators();
  }
}

// Set admin role for a guild
export async function setAdminRole(guildId, roleId) {
  if (administrators.has(guildId)) {
    const adminData = administrators.get(guildId);
    adminData.adminRoleId = roleId;
    administrators.set(guildId, adminData);
    await saveAdministrators();
  } else {
    // Initialize if doesn't exist
    administrators.set(guildId, {
      ownerId: null,
      adminRoleId: roleId,
      userIds: []
    });
    await saveAdministrators();
  }
}

// Get admin role for a guild
export function getAdminRole(guildId) {
  const adminData = administrators.get(guildId);
  return adminData ? adminData.adminRoleId : null;
}

// Get owner ID for a guild
export function getOwnerId(guildId) {
  const adminData = administrators.get(guildId);
  return adminData ? adminData.ownerId : null;
}

// Check if a user is an administrator
export function isAdministrator(guildId, member) {
  if (!member) return false;
  
  const adminData = administrators.get(guildId);
  if (!adminData) return false;
  
  // Guild owner is always admin
  if (member.guild && member.guild.ownerId === member.id) return true;
  
  // Check if user is the tracked owner
  if (adminData.ownerId === member.id) return true;
  
  // Check if user has the admin role
  if (adminData.adminRoleId && member.roles && member.roles.cache.has(adminData.adminRoleId)) {
    return true;
  }
  
  // Check if user is in the userIds list
  if (adminData.userIds && adminData.userIds.includes(member.id)) {
    return true;
  }
  
  return false;
}

