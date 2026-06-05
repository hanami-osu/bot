# Contributing

To start contributing, you need to install [Bun](https://bun.sh/)

1. Install Bun using curl
    - `curl -fsSL https://bun.sh/install | bash`
      or if you're on Windows:
    - `powershell -c "irm bun.sh/install.ps1 | iex"`

2. Clone the repository.
    - `git clone https://github.com/hanami-osu/bot`

3. Navigate inside the directory and install the dev, and normal dependencies.
    - `cd hanami && bun install`

4. Install ESLint and Prettier as an extension in your IDE to help with types and formatting.

5. Fill out `.env.local` with your API keys (see below to see how).

## Getting API keys

You need to fill `.env.local` with the appropriate API keys to make the bot work. Here's how:

### DISCORD_BOT_TOKEN (your bot's token)

1. Go to [Discord's developer portal](https://discord.com/developers/applications) and create a new application.

2. Navigate to the `Bot` tab, seen on the left.

3. Reset its token and get the new one.

4. You should also enable all 3 of the privileged intents for the bot to function.

### OSU_ACCESS_TOKEN (osu! key to make leaderboard commands function)

1. Go to [osu!'s home page](https://osu.ppy.sh/home) and press f12 to open up the developer page.

2. Navigate to the `Storage` tab. If you don't see it, click on the arrow and reveal the dropout box.

3. Inside `Storage` tab, click on `cookies` and `https://osu.ppy.sh`

4. Search for an item named `osu_session`

5. Copy its value, that's your `OSU_SESSION` key.

### OSU_CLIENT_SECRET and OSU_CLIENT_ID (osu! Auth)

1. Go to [osu! account settings](https://osu.ppy.sh/home/account/edit) and scroll until you see `OAuth` section.

2. Create a new OAuth application, give it a name (you can leave Callback URL part blank) and register it.

3. Edit your newly made application.

4. Copy its Client ID and Client secret, paste them into the env file and you're good to go.

### OSU_AUTH_URL (callback URL for /link command)

This one is a little tricky, because you will need to host the callback website (which runs a Bun server).

1. You can host this using platforms that support Docker or Bun, such as [Railway](https://railway.app), [Render](https://render.com), or your own VPS.

2. For example, on Railway or Render: create a new project, select "Deploy from GitHub repo", and input the template repo <https://github.com/hanami-osu/web>.

3. The platform will automatically detect the Dockerfile or Bun environment and build the website for you.

4. Once deployed, copy the provided URL, add it to `Application Callback URLs` in your osu! Application, and set it as `OSU_AUTH_URL` in your `.env.local` file.

### ERROR_CHANNEL_ID (Optional - for error logging)

1. Create a Discord server for development/testing if you don't have one.

2. Create a text channel specifically for error logs (e.g., `#error-logs`).

3. Right-click on the channel and select `Copy Channel ID` (you may need to enable Developer Mode in Discord settings first).

4. Paste the channel ID as the value for `ERROR_CHANNEL_ID`.

### OWNER_ID (Your Discord user ID)

1. In Discord, right-click on your username/avatar and select `Copy User ID` (Developer Mode must be enabled).

2. Paste your user ID as the value for `OWNER_ID`.

### DEV (Development mode)

Set this to `1` to enable development mode, or `0` for production. For local development, keep it as `1`.

### Database Configuration (MariaDB/MySQL)

Hanami uses MariaDB (MySQL) with Prisma as the ORM. You need to set this up for the bot to run properly:

1. Install MariaDB/MySQL on your system or use Docker.
2. Create a database for the bot (e.g., `CREATE DATABASE hanami;`).
3. Set the `DATABASE_URL` in your `.env.local` to point to your database (e.g., `DATABASE_URL="mysql://username:password@localhost:3306/hanami"`).

### Redis Configuration

This project uses Redis to remember button message data even after the bot was restarted:

1. Install Redis on your system:
    - **Linux/macOS**: `sudo apt install redis-server` or `brew install redis`
    - **Windows**: Download from [Redis for Windows](https://github.com/microsoftarchive/redis/releases)

2. Start the Redis server:
    - **Linux/macOS**: `redis-server`
    - **Windows**: Run the Redis server executable

3. Ensure the Redis connection string is configured in `.env.local`:
    - `REDIS_URL="redis://localhost:6379/0"` (this is the default and should work out of the box)

## Running the Bot

After setting up all the environment variables:

1. Copy `.env.example` to `.env.local`:

    ```bash
    cp .env.example .env.local
    ```

2. Fill in all the required values in `.env.local` according to the sections above.

3. Set up the database schema and generate the Prisma client:

    ```bash
    bunx prisma db push
    bunx prisma generate
    ```

4. Start the bot:
    ```bash
    bun start
    ```

## Development Guidelines

- Use ESLint and Prettier for code formatting
- Follow the existing code structure and patterns
- Test your changes thoroughly before submitting a pull request
- Make sure all environment variables are properly configured
