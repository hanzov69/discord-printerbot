# Prusa Better Discord Bot

A Discord bot for Prusa Connect notifications and more, featuring slash commands with the `pb` prefix.

## Features

- 🤖 Discord bot with slash commands
- 📝 All commands prefixed with `pb` (e.g., `/pbabout`)
- 🔧 Easy to extend with new commands
- ⚡ Built with Discord.js v14
- 📡 Webhook endpoint for receiving external notifications
- 💾 Persistent storage for announce channels (file or PostgreSQL)

## Prerequisites

- Node.js (v18 or higher recommended)
- A Discord Bot Token
- Discord Application Client ID

## Setup

1. **Create a Discord Application:**
   - Go to https://discord.com/developers/applications
   - Click "New Application" and give it a name
   - Go to the "Bot" section
   - Click "Add Bot" and confirm
   - Under "Token", click "Reset Token" and copy the token
   - Go to "OAuth2" → "URL Generator"
   - Select scopes: `bot` and `applications.commands`
   - Select bot permissions: `Send Messages`, `Use Slash Commands`
   - Copy the generated URL and open it in your browser to invite the bot to your server

2. **Get your Client ID:**
   - In the Discord Developer Portal, go to "General Information"
   - Copy the "Application ID" (this is your Client ID)

3. **Install dependencies:**
   ```bash
   npm install
   ```

4. **Configure environment variables:**
   - Copy `env.example` to `.env`
   - Add your Discord bot token and client ID:
     ```
     DISCORD_TOKEN=your_bot_token_here
     DISCORD_CLIENT_ID=your_client_id_here
     ```
   - Configure storage (see [Storage Configuration](#storage-configuration) below)

5. **Start the bot:**
   ```bash
   npm start
   ```
   
   Or for development with auto-reload:
   ```bash
   npm run dev
   ```

## Usage

Once the bot is running and invited to your server, you can use slash commands:

- `/pbabout` - Shows basic information about the bot
- `/pbadmin` - Configure bot administrator settings
  - `/pbadmin role` - Set or clear the administrator role for the bot
  - `/pbadmin channel` - Set the announce channel for webhook messages (can specify a channel or use current channel)

All commands are prefixed with `pb` to avoid conflicts with other bots.

### Webhook Integration

The bot listens for webhook POST requests at `http://localhost:3000/webhook` (or your deployed URL). 

1. **Set an announce channel**: Use `/pbadmin channel` in the Discord channel where you want webhook messages posted, or specify a channel
2. **Send webhooks**: POST to the webhook endpoint with your notification data
3. **Messages are posted**: The bot extracts the body content and posts it to the announce channel

Example webhook request:
```bash
curl -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -d '{"message": "Print job completed!"}'
```

## Adding New Commands

To add a new command:

1. Create a new file in the `commands` folder (e.g., `commands/pbping.js`)
2. Follow this structure:

```javascript
import { SlashCommandBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('pbping')
    .setDescription('Replies with Pong!'),
  
  async execute(interaction) {
    await interaction.reply('Pong!');
  }
};
```

3. Restart the bot - commands are automatically registered on startup

## Command Structure

All commands should:
- Have a name starting with `pb` (e.g., `pbabout`, `pbping`, `pbstatus`)
- Export a default object with `data` and `execute` properties
- Use `SlashCommandBuilder` for command definition
- Handle interactions in the `execute` function

## Configuration

### Environment Variables

**Required:**
- `DISCORD_TOKEN` (required): Your Discord bot token
- `DISCORD_CLIENT_ID` (required): Your Discord application client ID

**Optional:**
- `PORT` (optional): Webhook server port (default: 3000)

### Storage Configuration

The bot supports two storage backends for persisting announce channel settings. Configure storage using environment variables in your `.env` file.

#### File Storage (Default)

File storage is the simplest option and requires no additional setup. Data is stored in a JSON file.

```env
STORAGE_TYPE=file
STORAGE_FILE=./data/channels.json
```

- `STORAGE_TYPE`: Set to `file` (or omit, as this is the default)
- `STORAGE_FILE`: Path to the JSON file (default: `./data/channels.json`)

The `data/` directory will be created automatically if it doesn't exist.

#### PostgreSQL Storage

For production deployments or when you need shared storage across multiple instances, use PostgreSQL.

**Prerequisites:**
- PostgreSQL database server
- Database created for the bot
- Connection credentials

**Configuration:**
```env
STORAGE_TYPE=postgres
DATABASE_URL=postgresql://username:password@localhost:5432/database_name
DATABASE_SSL=false
```

- `STORAGE_TYPE`: Set to `postgres` or `postgresql`
- `DATABASE_URL`: PostgreSQL connection string
  - Format: `postgresql://user:password@host:port/database`
  - Example: `postgresql://myuser:mypass@localhost:5432/prusa_bot`
- `DATABASE_SSL`: Set to `true` if your database requires SSL (e.g., cloud providers like Heroku, Railway)

**Database Setup:**
The bot will automatically create the required table (`announce_channels`) on first run. No manual database setup is needed.

**PostgreSQL Connection String Examples:**
- Local: `postgresql://postgres:password@localhost:5432/prusa_better_discord`
- Heroku: `postgresql://user:pass@ec2-xx-xx-xx-xx.compute-1.amazonaws.com:5432/dbname` (set `DATABASE_SSL=true`)
- Railway: `postgresql://postgres:password@containers-us-west-xxx.railway.app:5432/railway` (set `DATABASE_SSL=true`)

**Note:** If `STORAGE_TYPE` is set to `postgres` but `DATABASE_URL` is missing, the bot will fall back to file storage with a warning.

## Deployment

### Local Development
- Use `npm start` or `npm run dev`

### Production
- Set environment variables on your hosting platform
- Use a process manager like PM2:
  ```bash
  pm2 start index.js --name prusa-better-discord
  ```

### Hosting Options
- **VPS/Cloud Server**: Deploy on any Node.js-compatible hosting
- **Heroku**: Set environment variables in Heroku dashboard
- **Railway/Render**: Connect your repo and set environment variables

## License

GNU General Public License v3.0
