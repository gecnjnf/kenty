# KENTY AI — Discord bot

An isolated Discord bot package. It does not change the KENTY web app.

## Current features
- Replies in text channels when someone mentions the bot.
- Keeps a short rolling conversation context per text channel (in memory only).
- `/join` joins the command user's current voice channel.
- `/say <text>` speaks text using a configurable Russian female neural voice.
- `/leave` leaves the voice channel.
- `/reset` clears the current channel's in-memory conversation context.

**Not implemented yet:** continuous voice listening, speech recognition, and real-time two-way voice conversation. The bot only transmits generated speech after `/say`.

## Requirements
- Python 3.11+
- FFmpeg installed and available on PATH
- A Discord bot token
- An OpenAI API key. API usage is billed separately from a ChatGPT subscription.
- Outbound internet access for Discord, OpenAI, and the Edge TTS speech service.

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

The container runs as an unprivileged user. Do not commit `.env` or paste its contents into chat.

## Hosting
This bot needs a continuously running worker because it maintains a persistent Discord Gateway and voice connection. Vercel serverless functions are not suitable. Choose an always-on host or a computer that stays on; check the provider's current free-tier limits before relying on it.

## Operational notes
- Conversation history is stored only in process memory and is lost on restart.
- Slash commands are registered when the bot connects.
- Voice playback requires FFmpeg and the bot's **Connect** and **Speak** permissions.
- No real Discord voice session or paid API request has been performed by repository checks alone.
