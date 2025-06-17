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
      console.log(
        'Channel is not a text channel:',
        'id' in channel ? channel.id : 'unknown',
      );
      return;
    }

    const messages = await channel.messages.fetch({limit: 100});
    console.log(`Fetched ${messages.size} messages from channel ${channel.id}`);

    if (messages.size > 0) {
      await (channel as TextChannel).bulkDelete(messages, true);
      console.log('Deleted all messages in the channel');
    } else {
      console.log('No messages to delete');
    }
  }
}
