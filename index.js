import { Client, GatewayIntentBits, Collection, REST, Routes } from 'discord.js';
import dotenv from 'dotenv';
import express from 'express';
import { readdirSync } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join } from 'path';
import { announceChannels, loadChannels } from './config/channels.js';

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

// Middleware to parse JSON and URL-encoded bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
  
  // Register commands when bot is ready
  await registerCommands();
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

// Webhook endpoint
app.post('/webhook', async (req, res) => {
  try {
    console.log('Received webhook:', {
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

    if (announceChannels.size === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'No announce channel set. Use /pbhere in a Discord channel first.' 
      });
    }

    // Send message to all announce channels (or you could modify to send to specific guild)
    const sendPromises = [];
    for (const [guildId, channelId] of announceChannels.entries()) {
      try {
        const channel = await client.channels.fetch(channelId);
        if (channel && channel.isTextBased()) {
          sendPromises.push(channel.send(bodyContent));
        }
      } catch (error) {
        console.error(`Error sending to channel ${channelId} in guild ${guildId}:`, error.message);
      }
    }

    await Promise.all(sendPromises);

    console.log('Successfully forwarded webhook to Discord');
    res.status(200).json({ 
      success: true, 
      message: 'Webhook forwarded to Discord',
      channelsNotified: announceChannels.size
    });

  } catch (error) {
    console.error('Error processing webhook:', error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error',
      details: error.message 
    });
  }
});

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
  
  // Load commands
  await loadCommands();
  
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
  });
}

init().catch(console.error);
