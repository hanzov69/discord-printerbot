# PrinterBot

A Discord bot for 3D Printer notifications and more, featuring slash commands with the `pb` prefix.

## Features

- 🤖 Discord bot with slash commands
- 📝 All commands use the `/pb` command with subcommands (e.g., `/pb about`)
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

## If running from source 

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   - Copy `env.example` to `.env`
   - Add your Discord bot token and client ID:
     ```
     DISCORD_TOKEN=your_bot_token_here
     DISCORD_CLIENT_ID=your_client_id_here
     ```
   - Configure storage (see [Storage Configuration](#storage-configuration) below)

3. **Start the bot:**
   ```bash
   npm start
   ```
   
   Or for development with auto-reload:
   ```bash
   npm run dev
   ```
## If running from container (Docker)

  1. Pull the container, `docker pull ghcr.io/hanzov69/discord-printerbot:latest` (this will pull latest, use desired tag)

  2. In the directory with your `.env` and a `/data` directory, run with 
     `docker run -d name printerbot -p 3000:3000 --env-file .env -v ./data:/app/data ghcr.io/hanzov69/discord-printerbot:latest`

## Usage

Once the bot is running, you can connect to the web interface via
- http://localhost:3000 (or your deployed URL)

Once invited/joined to a server, you can use slash commands (in addition to web interface) to control:

- `/pb about` - Shows basic information about the bot
- `/pb admin` - Configure bot administrator settings
  - `/pb admin role` - Set or clear the administrator role for the bot
  - `/pb admin channel` - Set the announce channel for webhook messages (can specify a channel or use current channel)
- `/pb webhook` - Manage custom webhook endpoints
  - `/pb webhook create` - Create a new custom webhook endpoint
  - `/pb webhook list` - List all your custom webhook endpoints
  - `/pb webhook delete` - Delete a custom webhook endpoint
  - `/pb webhook privacy` - Toggle webhook privacy (public/private)

All commands use the `/pb` prefix to avoid conflicts with other bots.


### Webhook Integration

The bot listens for webhook POST requests at `http://localhost:3000/webhook/<custom webhook>` (or your deployed URL). 
You *must* create a custom webhook for yourself

1. **Set an announce channel**: Use `/pb admin channel` in the Discord channel where you want webhook messages posted, or specify a channel
2. **Send webhooks**: POST to the webhook endpoint with your notification data
3. **Messages are posted**: The bot extracts the body content and posts it to the announce channel

Example webhook request:
```bash
curl -X POST http://localhost:3000/webhook/customendpoint \
  -H "Content-Type: application/json" \
  -d '{"message": "Print job completed!"}'
```

Additional supported fields:

If you want to include an image snapshot in your webhook, include a `snapshot` element in your payload body, eg:
```bash
curl -X POST http://localhost:3000/webhook/customendpoint \
  -H "Content-Type: application/json" \
  -d '{"message": "Print job completed!","snapshot":"https://domain.com/picture.jpg" }'
```

Message formatting:

The bot will automatically include emoji/formatting for messages with specific text

- 🎉 `**finished**`
- ⚠️ `**requires your attention**`
- ✅ `**adjust**`

These are to support the inflexible Prusa Connect webhook posts


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
- Use the `/pb` command structure with subcommands (e.g., `/pb about`, `/pb admin role`)
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
  - Example: `postgresql://myuser:mypass@localhost:5432/printerbot`
- `DATABASE_SSL`: Set to `true` if your database requires SSL (e.g., cloud providers like Heroku, Railway)

**Database Setup:**
The bot will automatically create the required table (`announce_channels`) on first run. No manual database setup is needed.

**PostgreSQL Connection String Examples:**
- Local: `postgresql://postgres:password@localhost:5432/printerbot`
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
  pm2 start index.js --name printerbot
  ```

### Docker Deployment
The application includes a Dockerfile for containerized deployment.

**Build the Docker image:**
```bash
docker build -t printerbot .
```

**Run the container:**
```bash
docker run -d \
  --name printerbot \
  -p 3000:3000 \
  --env-file .env \
  -v $(pwd)/data:/app/data \
  printerbot
```

**Using Docker Compose:**
Create a `docker-compose.yml` file:
```yaml
version: '3.8'

services:
  printerbot:
    build: .
    container_name: printerbot
    restart: unless-stopped
    ports:
      - "3000:3000"
    env_file:
      - .env
    volumes:
      - ./data:/app/data
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 3s
      retries: 3
      start_period: 5s
```

Then run:
```bash
docker-compose up -d
```

**Note:** 
- The `data` volume mount is only needed if using file-based storage (`STORAGE_TYPE=file`)
- For PostgreSQL storage, ensure your database is accessible from the container
- Make sure to set all required environment variables in your `.env` file

### CI/CD with GitHub Actions

The repository includes a GitHub Actions workflow that automatically builds and releases Docker images to GitHub Container Registry (ghcr.io).

**How it works:**
- **On push to main/master**: Builds and pushes images tagged with the branch name and commit SHA
- **On tags (v* format)**: Builds and pushes versioned images (e.g., `v1.0.0`, `1.0.0`, `1.0`, `1`, `latest`)
- **On pull requests**: Builds images for testing (does not push to registry)
- **Manual trigger**: Can be triggered manually from the Actions tab

**Image tags:**
- `latest` - Latest build from default branch
- `main` or `master` - Latest build from that branch
- `v1.0.0` - Semantic version tag
- `1.0.0`, `1.0`, `1` - Version variants
- `main-<sha>` - Branch name with commit SHA

**Pulling the image:**
```bash
# Pull latest image
docker pull ghcr.io/hanzov69/discord-printerbot:latest

# Pull specific version
docker pull ghcr.io/hanzov69/discord-printerbot:v1.0.0

# Pull from specific branch
docker pull ghcr.io/hanzov69/discord-printerbot:main
```

### Hosting Options
- **VPS/Cloud Server**: Deploy on any Node.js-compatible hosting or use Docker
- **Heroku**: Set environment variables in Heroku dashboard
- **Railway/Render**: Connect your repo and set environment variables
- **Docker Platforms**: Deploy using Docker on platforms like DigitalOcean, AWS ECS, Google Cloud Run, etc.

## License

GNU General Public License v3.0
