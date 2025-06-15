import {SapphireClient} from '@sapphire/framework';
import {GatewayIntentBits} from 'discord.js';
import 'dotenv/config';

const client = new SapphireClient({
  intents: [
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
  ],
  loadMessageCommandListeners: true,
});

void client.login(process.env.DISCORD_BOT_TOKEN);
