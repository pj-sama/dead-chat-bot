// ./src/listeners/guildMemberUpdate/PurgeOnRoleAssign.ts

import {ApplyOptions} from '@sapphire/decorators';
import {Events, Listener} from '@sapphire/framework';
import {GuildMember, PartialGuildMember, TextChannel} from 'discord.js';

@ApplyOptions<Listener.Options>({
  event: Events.GuildMemberUpdate,
})
export class PurgeOnRoleAssign extends Listener {
  private readonly TARGET_ROLE_ID = process.env.DEADCHAT_ROLE_ID!;
  private readonly CHANNEL_ID = process.env.SOURCE_CHANNEL_ID!;

  public async run(
    _oldMember: GuildMember | PartialGuildMember,
    newMember: GuildMember,
  ) {
    console.log('GuildMemberUpdate event fired');
    console.log(
      'New member roles:',
      newMember.roles.cache.map(r => r.id),
    );

    // Only proceed if the member now has the target role
    const hasRoleNow = newMember.roles.cache.has(this.TARGET_ROLE_ID);

    console.log('Has target role now:', hasRoleNow);
    if (!hasRoleNow) return;

    const channel = await newMember.guild.channels.fetch(this.CHANNEL_ID);
    if (!channel) {
      console.log('Channel not found:', this.CHANNEL_ID);
      return;
    }
    if (!channel.isTextBased() || !(channel instanceof TextChannel)) {
      console.log('Channel is not a text channel:', channel.id);
      return;
    }

    const messages = await channel.messages.fetch({limit: 100});
    console.log(`Fetched ${messages.size} messages from channel ${channel.id}`);

    const botMessage = messages.find(
      msg => msg.author.bot || msg.webhookId !== null,
    );

    // If no bot message is found, delete all messages in the channel - Usually needed for initial setup after deploying
    if (!botMessage) {
      console.log('No bot message found, deleting all messages in the channel');
      await (channel as TextChannel).bulkDelete(
        messages.map(m => m.id),
        true,
      );
      return;
    }

    console.log('Bot message found at timestamp:', botMessage.createdTimestamp);

    // Collect all messages before and including the bot message
    const messagesToDelete = messages.filter(
      msg => msg.createdTimestamp <= botMessage.createdTimestamp,
    );
    console.log(
      `Messages to delete (before and including bot message): ${messagesToDelete.size}`,
    );

    // Bulk delete (can only delete messages under 14 days old)
    const deletable = messagesToDelete.filter(
      msg => Date.now() - msg.createdTimestamp < 14 * 24 * 60 * 60 * 1000,
    );
    console.log(`Deletable messages (under 14 days old): ${deletable.size}`);

    if (deletable.size > 0) {
      await (channel as TextChannel).bulkDelete(deletable, true);
      console.log('Bulk deleted messages');
    } else {
      console.log('No messages to bulk delete');
    }
  }
}
