# Prusa Better Discord Bot

A Discord bot for Prusa Connect notifications and more, featuring slash commands with the `pb` prefix.

## Features

- 🤖 Discord bot with slash commands
- 📝 All commands prefixed with `pb` (e.g., `/pbabout`)
- 🔧 Easy to extend with new commands
- ⚡ Built with Discord.js v14

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

All commands are prefixed with `pb` to avoid conflicts with other bots.

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

- `DISCORD_TOKEN` (required): Your Discord bot token
- `DISCORD_CLIENT_ID` (required): Your Discord application client ID

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
