// src/listener/messageCreate/SecretChannelCloner.ts
// this is a listener that takes messages from a specific channel and clones them to another channel using a webhook

import {ApplyOptions} from '@sapphire/decorators';
import {Listener, Events} from '@sapphire/framework';
import {Message, TextChannel, Webhook} from 'discord.js';
import 'dotenv/config';

@ApplyOptions<Listener.Options>({
  event: Events.MessageCreate,
})
export class CloneMessagesToAnotherChannel extends Listener {
  private readonly SOURCE_CHANNEL_ID = process.env.SOURCE_CHANNEL_ID!;
  private readonly TARGET_CHANNEL_ID = process.env.TARGET_CHANNEL_ID!;

  public async run(message: Message) {
    // Ignore bots and messages outside the source channel
    if (message.author.bot || message.channel.id !== this.SOURCE_CHANNEL_ID)
      return;

    const targetChannel = await message.guild?.channels.fetch(
      this.TARGET_CHANNEL_ID,
    );

    if (!targetChannel?.isTextBased()) return;

    // Find or create a webhook in the target channel
    let webhook: Webhook | undefined;

    const existingWebhooks = await (
      targetChannel as TextChannel
    ).fetchWebhooks();
    webhook = existingWebhooks.find(wh => wh.name === 'Message Cloner');

    if (!webhook) {
      webhook = await (targetChannel as TextChannel).createWebhook({
        name: 'Message Cloner',
        avatar: message.client.user?.displayAvatarURL(),
      });
    }

    // Send the message through the webhook
    await webhook.send({
      content: message.content || '*[No content to clone]*',
      username: message.member?.displayName || message.author.username,
      avatarURL: message.author.displayAvatarURL(),
      files: Array.from(message.attachments.values()),
    });
  }
}
