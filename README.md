# Hanami

A Discord bot written in TypeScript, using the Bun runtime engine.

I mainly wrote this bot for my friends, but a lot more people wanted to use it than I thought. So now, we're here. Hopefully it meets your expectations.

If you're here to contribute/look at the code, welcome! Although, the code is not very well documented, I tried my best!

Feel free to open up an issue/pull request at this [repository](https://github.com/hanami-osu/bot)

## What does it do?

Hanami is a comprehensive osu! Discord bot that provides detailed statistics and gameplay information. Features include:

- **Player Statistics**: View detailed profiles, rankings, and performance metrics
- **Recent Activity**: Track recent plays and scores
- **Score Analysis**: Compare scores, calculate performance points, and analyze plays
- **Beatmap Information**: Get detailed beatmap statistics, backgrounds, and metadata
- **Account Linking**: Link your osu! account with `/link` for personalized commands
- **Server Customization**: Custom prefixes and configuration options

The bot supports both slash commands and traditional prefix commands, with full osu! game mode support (Standard, Taiko, Catch, Mania).

Use `/help` to see all available commands.

## Invite the bot

[Add Hanami to your server](https://discord.com/oauth2/authorize?client_id=995999045157916763&permissions=347200&scope=bot%20applications.commands)

## Libraries

You can look at all of the libraries I use by going to `package.json` in the main branch, but mainly:

- [Lilybird](https://github.com/Didas-git/lilybird) to communicate with Discord's API.

- [osu-web.js](https://github.com/L-Mario564/osu.js) to communicate with osu!'s servers.

- [rosu-pp's JavaScript bind](https://github.com/MaxOhn/rosu-pp-js) to calculate pp, bpm values, other technical stuff of osu!

## Contributing

Read the [CONTRIBUTING.md](https://github.com/hanami-osu/bot/blob/main/CONTRIBUTING.md) file.

## Contact me

If you have any questions or just want to have someone to talk to, add me on discord (@yorunoken), or message me on twitter (@\_yorunoken)
