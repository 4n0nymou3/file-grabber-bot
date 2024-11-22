# File Grabber Bot 📥

A Telegram bot that downloads and sends small files directly to your chat. Built with Cloudflare Pages and supports both English and Persian languages.

## Live Demo 🚀

- **Bot Link**: [File Grabber Bot](https://t.me/File_Grabberbot)
- **Developer Contact**: [BXAMbot](https://t.me/BXAMbot)

## Features ✨

- Download files from direct URLs
- Support for files up to 49.9 MB
- Bilingual interface (Persian/English)
- Clean and user-friendly design
- No ads or promotional content
- Fast and reliable file downloading
- Built on Cloudflare's global network

## Prerequisites 🧰

- Telegram account
- Cloudflare account
- Github
- Basic understanding of Cloudflare Pages and Telegram Bots

## Setup 🛠

1. Fork this repository
2. Create a new Telegram bot:
   - Start a chat with [@BotFather](https://t.me/botfather)
   - Send `/newbot` command
   - Follow the instructions to create your bot
   - Save your bot token for the next steps
3. Set up Cloudflare Pages:
   - Sign in to your Cloudflare account
   - Go to Pages section
   - Click "Create a project"
   - Choose "Connect to Github"
   - Select your forked repository
   - Configure build settings:
     - Framework preset: `None`
     - Build command: (leave empty)
     - Build output directory: `functions`
     - Root directory: (leave empty)
     - Environment variable:
       - Key: `TELEGRAM_TOKEN`
       - Value: Your Telegram bot token from step 2
4. After deployment, set up your Telegram webhook:
   ```bash
   https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=https://<YOUR_PAGES_URL>
   ```
   Replace `<YOUR_BOT_TOKEN>` with your actual bot token and `<YOUR_PAGES_URL>` with your Cloudflare Pages URL

## Project Structure 📁

```
file-grabber-bot/
├── functions/
│   └── _worker.js     # Main bot logic
├── LICENSE            # MIT License
└── README.md          # Project documentation
```

## Usage 📝

1. Start a chat with your bot on Telegram
2. Send a direct URL of the file you want to download
3. Bot will:
   - Verify the file URL
   - Check file size (max 49.9 MB)
   - Download and send the file to you

## Technical Details 🔧

- Built with Cloudflare Pages
- Uses Cloudflare Workers for serverless functionality
- Integrates with Telegram Bot API
- Stateless architecture for reliability
- Environment variables for secure token management

## Limitations ⚠️

- Maximum file size: 49.9 MB
- Supports direct file URL downloads
- Requires a stable internet connection

## Performance 📊

- Low latency due to Cloudflare's global network
- Minimal resource consumption
- Quick file downloading and sending

## Security 🔒

- No user data storage
- Serverless architecture
- Uses secure, encrypted file and API connections
- Validates file URLs before downloading

## License 📄

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Contributing 🤝

Contributions are welcome! Here's how you can help:

1. Fork the repository
2. Create a new branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Issues 🐛

Found a bug or have a suggestion? Please check the following:

1. Search existing issues to avoid duplicates
2. Create a new issue with a clear description
3. Include steps to reproduce (for bugs)
4. Add relevant screenshots if applicable

## Support 💬

If you need help with setup or usage:

1. Check existing issues for solutions
2. Create a new issue for support questions
3. Be specific about your problem
4. Include your setup details

## Acknowledgments 🙏

- [Telegram Bot API](https://core.telegram.org/bots/api)
- [Cloudflare Pages](https://pages.cloudflare.com/)

---

Made with ❤️ for the open-source community