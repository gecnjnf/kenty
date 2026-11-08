# KENTY AI — Discord bot

A small, isolated Discord bot package. It does not change the KENTY web app.

## What it does
- Replies in text channels when someone mentions the bot.
- Keeps a short rolling conversation context per text channel (in memory only).
- `/join` joins the command user's current voice channel.
- `/say <text>` speaks text using a high-pitched Russian female neural voice.
- `/leave` leaves the voice channel.
- `/reset` clears the current channel's in-memory conversation context.

**Current limitation:** this starter version speaks when invoked with `/say`; it does not yet continuously listen to voice participants or transcribe live conversation.

## Requirements
- Python 3.11+
- FFmpeg installed and available on PATH
- A Discord bot token
- An OpenAI API key. API usage is billed separately from a ChatGPT subscription.

## Discord Developer Portal setup
1. In **Bot**, enable **Message Content Intent**.
2. In **OAuth2 → URL Generator**, select scopes `bot` and `applications.commands`.
3. Grant only: View Channels, Send Messages, Read Message History, Use Application Commands, Connect, Speak.
4. Open the generated URL and add the bot to your server.
5. Never share the bot token. If it was exposed, reset it immediately.

## Run locally
1. Copy `.env.example` to `.env`.
2. Fill in `DISCORD_BOT_TOKEN` and `OPENAI_API_KEY`.
3. Install dependencies: `pip install -r requirements.txt`.
4. Run: `python bot.py`.

## Docker
Build and run from this directory after creating a local `.env` file:
```sh
docker build -t kenty-discord-bot .
docker run --env-file .env --restart unless-stopped kenty-discord-bot
```

Do not commit `.env` or paste its contents into chat. Vercel serverless functions are not suitable for maintaining Discord's persistent Gateway voice connection; run this worker on an always-on host or a computer that stays on.
