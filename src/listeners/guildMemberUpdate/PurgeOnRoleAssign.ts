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
    oldMember: GuildMember | PartialGuildMember,
    newMember: GuildMember,
  ) {
    const justReceivedRole =
      !oldMember.roles.cache.has(this.TARGET_ROLE_ID) &&
      newMember.roles.cache.has(this.TARGET_ROLE_ID);

    if (!justReceivedRole) return;

    const channel = await newMember.guild.channels.fetch(this.CHANNEL_ID);
    if (!channel?.isTextBased()) return;

    const messages = await channel.messages.fetch({limit: 100});

    const botMessage = messages.find(
      msg => msg.author.id === newMember.client.user?.id,
    );

    if (!botMessage) return;

    // Collect all messages before and including the bot message
    const messagesToDelete = messages.filter(
      msg => msg.createdTimestamp <= botMessage.createdTimestamp,
    );

    // Bulk delete (can only delete messages under 14 days old)
    const deletable = messagesToDelete.filter(
      msg => Date.now() - msg.createdTimestamp < 14 * 24 * 60 * 60 * 1000,
    );

    if (deletable.size > 0) {
      await (channel as TextChannel).bulkDelete(deletable, true);
    }
  }
}
