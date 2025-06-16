import {SapphireClient} from '@sapphire/framework';
import {GatewayIntentBits} from 'discord.js';
const express = require('express');
import 'dotenv/config';

const client = new SapphireClient({
  intents: [
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
  ],
  loadMessageCommandListeners: true,
});

void client.login(process.env.DISCORD_BOT_TOKEN);

const app = express();
app.get('/', (_: unknown, res: {send: (arg0: string) => unknown}) =>
  res.send('Bot is alive!'),
);
app.listen(3000, () => console.log('Keep-alive server running'));
