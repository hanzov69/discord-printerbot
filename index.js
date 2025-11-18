import { Client, GatewayIntentBits, Collection, REST, Routes, EmbedBuilder } from 'discord.js';
import dotenv from 'dotenv';
import express from 'express';
import session from 'express-session';
import passport from 'passport';
import { readdirSync } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join } from 'path';
import { announceChannels, loadChannels } from './config/channels.js';
import { loadAdministrators, initializeGuildAdmin } from './config/administrators.js';
import { loadWebhooks, getWebhook } from './config/webhooks.js';
import authRoutes from './routes/auth.js';
import dashboardRoutes, { setDiscordClient } from './routes/dashboard.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Command collection
client.commands = new Collection();

// Express app for webhook listening
const app = express();
const PORT = process.env.PORT || 3000;

// Set up EJS as view engine
app.set('view engine', 'ejs');
app.set('views', join(__dirname, 'views'));

// Middleware to parse JSON and URL-encoded bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Make sure JSON parsing is available for dashboard routes
app.use('/dashboard', express.json());

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key-change-this',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Load commands
async function loadCommands() {
  const commandsPath = join(__dirname, 'commands');
  const commandFiles = readdirSync(commandsPath).filter(file => file.endsWith('.js'));

  for (const file of commandFiles) {
    const filePath = join(commandsPath, file);
    const fileUrl = pathToFileURL(filePath).href;
    const command = await import(fileUrl);
    
    if ('data' in command.default && 'execute' in command.default) {
      client.commands.set(command.default.data.name, command.default);
      console.log(`✅ Loaded command: ${command.default.data.name}`);
    } else {
      console.log(`⚠️  Command at ${filePath} is missing required "data" or "execute" property.`);
    }
  }

  return commandFiles;
}

// Register slash commands
async function registerCommands() {
  const commandsPath = join(__dirname, 'commands');
  const commandFiles = readdirSync(commandsPath).filter(file => file.endsWith('.js'));
  const commands = [];
  
  for (const file of commandFiles) {
    const filePath = join(commandsPath, file);
    const fileUrl = pathToFileURL(filePath).href;
    const command = await import(fileUrl);
    if ('data' in command.default) {
      commands.push(command.default.data.toJSON());
    }
  }

  const rest = new REST().setToken(process.env.DISCORD_TOKEN);

  try {
    console.log(`🔄 Started refreshing ${commands.length} application (/) commands.`);

    // Register commands globally (can take up to 1 hour to propagate)
    const data = await rest.put(
      Routes.applicationCommands(process.env.DISCORD_CLIENT_ID),
      { body: commands }
    );

    console.log(`✅ Successfully registered ${data.length} application (/) commands.`);
  } catch (error) {
    console.error('❌ Error registering commands:', error);
  }
}

// Event: Bot ready
client.once('clientReady', async () => {
  console.log(`🤖 ${client.user.tag} is online!`);
  console.log(`📊 Bot is in ${client.guilds.cache.size} server(s)`);
  
  // Initialize administrators for existing guilds
  for (const guild of client.guilds.cache.values()) {
    await initializeGuildAdmin(guild.id, guild.ownerId);
  }
  
  // Register commands when bot is ready
  await registerCommands();
});

// Event: Bot joins a new guild
client.on('guildCreate', async (guild) => {
  console.log(`✅ Bot joined guild: ${guild.name} (${guild.id})`);
  // Initialize administrator for the guild owner
  await initializeGuildAdmin(guild.id, guild.ownerId);
});

// Event: Interaction (slash commands)
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);

  if (!command) {
    console.error(`❌ No command matching ${interaction.commandName} was found.`);
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`❌ Error executing ${interaction.commandName}:`, error);
    
    const errorMessage = { 
      content: '❌ There was an error while executing this command!', 
      ephemeral: true 
    };
    
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(errorMessage);
    } else {
      await interaction.reply(errorMessage);
    }
  }
});

// Function to extract body content from webhook
function extractBodyContent(body) {
  if (!body) {
    return null;
  }

  // If body is a string, return it directly
  if (typeof body === 'string') {
    return body;
  }

  // If body is an object, try to extract content fields
  if (typeof body === 'object') {
    // Try common content field names
    if (body.content) return body.content;
    if (body.message) return body.message;
    if (body.text) return body.text;
    if (body.description) return body.description;
    
    // If no content field found, stringify the entire body
    return JSON.stringify(body, null, 2);
  }

  // Fallback: convert to string
  return String(body);
}

// Function to determine emoji based on message content
function getEmojiForMessage(content) {
  if (!content || typeof content !== 'string') {
    return '';
  }

  const lowerContent = content.toLowerCase();
  
  if (lowerContent.includes('**requires your attention**')) {
    return '⚠️ ';
  }
  
  if (lowerContent.includes('**finished**')) {
    return '🎉 ';
  }

  if (lowerContent.includes('**adjust**')) {
    return '✅ ';
  }
  
  return '';
}

// Old webhook endpoint - disabled (returns 404)
app.post('/webhook', (req, res) => {
  res.status(404).json({ 
    success: false, 
    error: 'This endpoint is no longer available. Please use a custom webhook endpoint instead.' 
  });
});

// Custom webhook endpoint handler
app.post('/webhook/:identifier', async (req, res) => {
  try {
    const identifier = req.params.identifier;
    const webhook = getWebhook(identifier);

    if (!webhook) {
      return res.status(404).json({ 
        success: false, 
        error: 'Webhook endpoint not found' 
      });
    }

    console.log('Received custom webhook:', {
      identifier: identifier,
      userId: webhook.userId,
      guildId: webhook.guildId,
      body: req.body,
      timestamp: new Date().toISOString()
    });

    // Extract body content
    const bodyContent = extractBodyContent(req.body);

    if (!bodyContent) {
      return res.status(400).json({ 
        success: false, 
        error: 'No content found in webhook body' 
      });
    }

    // Get announce channel for this guild
    const channelId = announceChannels.get(webhook.guildId);
    
    if (!channelId) {
      return res.status(400).json({ 
        success: false, 
        error: 'No announce channel set for this server. Use /pb admin channel in a Discord channel first.' 
      });
    }

    // Determine emoji based on content
    const emoji = getEmojiForMessage(bodyContent);
    const messageWithEmoji = emoji + bodyContent;

    // Check if body contains a snapshot field
    const snapshotUrl = req.body?.snapshot || req.body?.snapshot_url || null;

    // Send message based on webhook privacy setting
    try {
      if (webhook.isPublic === false) {
        // Private webhook: send as DM to the user who created it
        try {
          const user = await client.users.fetch(webhook.userId);
          
          if (snapshotUrl) {
            // Send with image embed if snapshot exists
            const embed = new EmbedBuilder()
              .setDescription(messageWithEmoji)
              .setImage(snapshotUrl)
              .setTimestamp();
            
            await user.send({ embeds: [embed] });
          } else {
            // Send plain message if no snapshot
            await user.send(messageWithEmoji);
          }
          
          console.log(`Successfully forwarded private webhook ${identifier} to user ${webhook.userId}`);
          res.status(200).json({ 
            success: true, 
            message: 'Webhook forwarded to Discord (private message)'
          });
        } catch (error) {
          console.error(`Error sending DM to user ${webhook.userId}:`, error.message);
          res.status(500).json({ 
            success: false, 
            error: 'Failed to send private message. Make sure you have DMs enabled from server members.',
            details: error.message 
          });
        }
      } else {
        // Public webhook: send to announce channel
        const channel = await client.channels.fetch(channelId);
        if (channel && channel.isTextBased()) {
          if (snapshotUrl) {
            // Send with image embed if snapshot exists
            const embed = new EmbedBuilder()
              .setDescription(messageWithEmoji)
              .setImage(snapshotUrl)
              .setTimestamp();
            
            await channel.send({ embeds: [embed] });
          } else {
            // Send plain message if no snapshot
            await channel.send(messageWithEmoji);
          }
          
          console.log(`Successfully forwarded public webhook ${identifier} to Discord`);
          res.status(200).json({ 
            success: true, 
            message: 'Webhook forwarded to Discord'
          });
        } else {
          res.status(500).json({ 
            success: false, 
            error: 'Channel is not accessible' 
          });
        }
      }
    } catch (error) {
      console.error(`Error processing webhook ${identifier}:`, error.message);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to send message to Discord',
        details: error.message 
      });
    }

  } catch (error) {
    console.error('Error processing webhook:', error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error',
      details: error.message 
    });
  }
});

// Home page
app.get('/', (req, res) => {
  res.render('index', { user: req.user });
});

// Auth routes
app.use('/auth', authRoutes);

// Dashboard routes
app.use('/dashboard', dashboardRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Webhook server is running',
    botOnline: client.isReady()
  });
});

// Initialize bot
async function init() {
  // Load channels from storage first
  await loadChannels();
  
  // Load administrators from storage
  await loadAdministrators();
  
  // Load custom webhooks from storage
  await loadWebhooks();
  
  // Load commands
  await loadCommands();
  
  // Set Discord client reference for dashboard routes
  setDiscordClient(client);
  
  // Login to Discord
  const token = process.env.DISCORD_TOKEN;
  if (!token) {
    console.error('❌ ERROR: DISCORD_TOKEN environment variable is required!');
    console.error('Please set it in your .env file or environment variables.');
    process.exit(1);
  }

  await client.login(token);
  
  // Start Express server after bot is logged in
  app.listen(PORT, () => {
    console.log(`🌐 Webhook server running on port ${PORT}`);
    console.log(`📡 Listening for webhooks at: http://localhost:${PORT}/webhook`);
    console.log(`💚 Health check: http://localhost:${PORT}/health`);
    console.log(`🌍 Web interface: http://localhost:${PORT}`);
  });
}

init().catch(console.error);
