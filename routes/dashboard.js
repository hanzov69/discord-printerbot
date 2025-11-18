import express from 'express';
import { announceChannels, setChannel } from '../config/channels.js';
import { getAdminRole, getOwnerId, isAdministrator } from '../config/administrators.js';
import { getUserWebhooks, createWebhook, deleteWebhook, updateWebhookPrivacy } from '../config/webhooks.js';

const router = express.Router();

// Store Discord client reference (will be set from index.js)
let discordClient = null;

export function setDiscordClient(client) {
  discordClient = client;
}

// Middleware to check if user is authenticated
function isAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/');
}

router.get('/', isAuthenticated, async (req, res) => {
  const user = req.user;
  
  // Get bot's guild IDs (where bot is actually a member)
  const botGuildIds = discordClient && discordClient.isReady() 
    ? Array.from(discordClient.guilds.cache.keys())
    : Array.from(announceChannels.keys());
  
  // Get user's guilds from OAuth profile
  const userGuilds = user.guilds || [];
  
  // Find guilds where both user and bot are members
  const commonGuilds = userGuilds.filter(guild => 
    botGuildIds.includes(guild.id)
  );
  
  // Get invite URL
  const clientId = process.env.DISCORD_CLIENT_ID;
  const inviteUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&permissions=2048&scope=bot%20applications.commands`;
  
  // Get admin information and webhooks for each guild
  const guildsWithAdminInfo = await Promise.all(commonGuilds.map(async (guild) => {
    const guildObj = discordClient && discordClient.isReady() 
      ? discordClient.guilds.cache.get(guild.id)
      : null;
    
    const adminRoleId = getAdminRole(guild.id);
    const ownerId = getOwnerId(guild.id);
    let userIsAdmin = false;
    let userIsOwner = false;
    
    if (guildObj) {
      try {
        const member = await guildObj.members.fetch(user.id);
        userIsAdmin = isAdministrator(guild.id, member);
        userIsOwner = guildObj.ownerId === user.id;
      } catch (error) {
        // User is not a member of this guild
        userIsAdmin = false;
        userIsOwner = false;
      }
    }
    
    let adminRoleName = null;
    if (adminRoleId && guildObj) {
      const role = guildObj.roles.cache.get(adminRoleId);
      adminRoleName = role ? role.name : null;
    }
    
    // Get all roles for the server (excluding @everyone)
    let roles = [];
    if (guildObj) {
      roles = Array.from(guildObj.roles.cache.values())
        .filter(role => role.name !== '@everyone')
        .map(role => ({ 
          id: role.id, 
          name: role.name,
          color: role.hexColor,
          position: role.position,
          managed: role.managed
        }))
        .sort((a, b) => b.position - a.position); // Sort by position (highest first)
    }
    
    // Get all text-based channels the bot can access
    let channels = [];
    if (guildObj) {
      channels = Array.from(guildObj.channels.cache.values())
        .filter(channel => channel.isTextBased() && channel.viewable)
        .map(channel => ({
          id: channel.id,
          name: channel.name,
          type: channel.type,
          parent: channel.parent ? channel.parent.name : null
        }))
        .sort((a, b) => {
          // Sort by category first, then by name
          if (a.parent !== b.parent) {
            return (a.parent || '').localeCompare(b.parent || '');
          }
          return a.name.localeCompare(b.name);
        });
    }
    
    // Get user's webhooks for this guild
    const userWebhooks = getUserWebhooks(user.id).filter(w => w.guildId === guild.id);
    
    return {
      id: guild.id,
      name: guild.name,
      icon: guild.icon ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png` : null,
      channelId: announceChannels.get(guild.id),
      adminRoleId: adminRoleId,
      adminRoleName: adminRoleName,
      userIsAdmin: userIsAdmin,
      userIsOwner: userIsOwner,
      roles: roles,
      channels: channels,
      webhooks: userWebhooks
    };
  }));
  
  const baseUrl = process.env.WEBHOOK_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
  
  res.render('dashboard', {
    user: {
      id: user.id,
      username: user.username,
      discriminator: user.discriminator,
      avatar: user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : null
    },
    commonGuilds: guildsWithAdminInfo,
    hasBot: commonGuilds.length > 0,
    inviteUrl: inviteUrl,
    webhookBaseUrl: baseUrl
  });
});

// API endpoint to create webhook
router.post('/webhook', isAuthenticated, async (req, res) => {
  const { guildId, identifier, isPublic } = req.body;
  const user = req.user;
  
  if (!guildId || !identifier) {
    return res.status(400).json({ error: 'Guild ID and identifier are required' });
  }
  
  // Check if user is admin
  const guildObj = discordClient && discordClient.isReady() 
    ? discordClient.guilds.cache.get(guildId)
    : null;
  
  if (!guildObj) {
    return res.status(404).json({ error: 'Guild not found' });
  }
  
  const member = await guildObj.members.fetch(user.id).catch(() => null);
  if (!member) {
    return res.status(403).json({ error: 'You are not a member of this guild' });
  }
  
  const isAdmin = isAdministrator(guildId, member);
  if (!isAdmin) {
    return res.status(403).json({ error: 'Only administrators can create webhooks' });
  }
  
  try {
    await createWebhook(user.id, guildId, identifier, isPublic !== false);
    const baseUrl = process.env.WEBHOOK_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
    res.json({ 
      success: true, 
      message: 'Webhook created successfully',
      url: `${baseUrl}/webhook/${identifier}`
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// API endpoint to update webhook privacy
router.patch('/webhook/:identifier', isAuthenticated, async (req, res) => {
  const { identifier } = req.params;
  const { isPublic } = req.body;
  const user = req.user;
  
  if (typeof isPublic !== 'boolean') {
    return res.status(400).json({ error: 'isPublic must be a boolean value' });
  }
  
  try {
    await updateWebhookPrivacy(identifier, user.id, isPublic);
    res.json({ success: true, message: 'Webhook privacy updated successfully' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// API endpoint to delete webhook
router.delete('/webhook/:identifier', isAuthenticated, async (req, res) => {
  const { identifier } = req.params;
  const user = req.user;
  
  try {
    await deleteWebhook(identifier, user.id);
    res.json({ success: true, message: 'Webhook deleted successfully' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// API endpoint to update admin role
router.post('/admin-role', isAuthenticated, async (req, res) => {
  const { guildId, roleId } = req.body;
  const user = req.user;
  
  if (!guildId) {
    return res.status(400).json({ error: 'Guild ID is required' });
  }
  
  // Check if user is owner or admin
  const guildObj = discordClient && discordClient.isReady() 
    ? discordClient.guilds.cache.get(guildId)
    : null;
  
  if (!guildObj) {
    return res.status(404).json({ error: 'Guild not found' });
  }
  
  const member = await guildObj.members.fetch(user.id).catch(() => null);
  if (!member) {
    return res.status(403).json({ error: 'You are not a member of this guild' });
  }
  
  const isOwner = guildObj.ownerId === user.id;
  const isAdmin = isAdministrator(guildId, member);
  
  if (!isOwner && !isAdmin) {
    return res.status(403).json({ error: 'Only server owners and administrators can configure the admin role' });
  }
  
  // Update admin role
  const { setAdminRole } = await import('../config/administrators.js');
  await setAdminRole(guildId, roleId || null);
  
  res.json({ success: true, message: 'Admin role updated successfully' });
});

// API endpoint to update announce channel
router.post('/announce-channel', isAuthenticated, async (req, res) => {
  const { guildId, channelId } = req.body;
  const user = req.user;
  
  if (!guildId || !channelId) {
    return res.status(400).json({ error: 'Guild ID and channel ID are required' });
  }
  
  // Check if user is owner or admin
  const guildObj = discordClient && discordClient.isReady() 
    ? discordClient.guilds.cache.get(guildId)
    : null;
  
  if (!guildObj) {
    return res.status(404).json({ error: 'Guild not found' });
  }
  
  const member = await guildObj.members.fetch(user.id).catch(() => null);
  if (!member) {
    return res.status(403).json({ error: 'You are not a member of this guild' });
  }
  
  const isOwner = guildObj.ownerId === user.id;
  const isAdmin = isAdministrator(guildId, member);
  
  if (!isOwner && !isAdmin) {
    return res.status(403).json({ error: 'Only server owners and administrators can configure the announce channel' });
  }
  
  // Validate channel exists and is accessible
  const channel = guildObj.channels.cache.get(channelId);
  if (!channel || !channel.isTextBased() || !channel.viewable) {
    return res.status(400).json({ error: 'Invalid channel. Channel must be a text-based channel the bot can access.' });
  }
  
  // Update announce channel
  await setChannel(guildId, channelId);
  
  res.json({ success: true, message: 'Announce channel updated successfully' });
});

export default router;

