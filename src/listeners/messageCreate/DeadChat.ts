// ./src/listeners/messageCreate/DeadChat.ts

import {ApplyOptions} from '@sapphire/decorators';
import {Events, Listener, UserError} from '@sapphire/framework';
import {Guild, GuildMember, Message, MessageType} from 'discord.js';
import {Time} from '@sapphire/duration';
import 'dotenv/config';

@ApplyOptions<Listener.Options>({
  event: Events.MessageCreate,
})
export class DeadChat extends Listener {
  private canReviveAt = Date.now() + Time.Minute * 30;
  private startedTimer = false;
  private previousReply?: Message;
  private revivalInterval?: NodeJS.Timeout;

  public async run(eMessage: Message) {
    const {
      author: messageAuthor,
      channelId: messageChannelId,
      createdTimestamp: messageCreatedTimestamp,
    } = eMessage;

    const {
      guild: messageGuild,
      member: messageMember,
      type: messageType,
    } = eMessage;

    const GENERAL_CHANNEL_ID = process.env.GENERAL_CHANNEL_ID;
    const DEADCHAT_ROLE = process.env.DEADCHAT_ROLE;

    if (!GENERAL_CHANNEL_ID || !DEADCHAT_ROLE) {
      console.error('Missing GENERAL_CHANNEL_ID or DEADCHAT_ROLE in .env');
      return;
    }

    // Ignore messages from bots, not in #general, or user join messages.
    if (
      messageAuthor.bot ||
      messageChannelId !== GENERAL_CHANNEL_ID ||
      messageType === MessageType.UserJoin
    ) {
      return;
    }
    // Ignore messages that only contain emojis or are whitespace
    const content = eMessage.content.trim();

    // Regex matches custom Discord emojis and unicode emojis
    const onlyEmotesRegex = /^(?:<a?:\w+:\d+>|\p{Extended_Pictographic}|\s)+$/u;

    if (content.length > 0 && onlyEmotesRegex.test(content)) {
      return;
    }

    if (!(messageGuild instanceof Guild)) {
      throw new UserError({
        identifier: __filename,
        message: '"messageGuild" must be a Guild.',
      });
    }

    if (!(messageMember instanceof GuildMember)) {
      throw new UserError({
        identifier: __filename,
        message: '"messageMember" must be a GuildMember.',
      });
    }

    const chatWasRevived = messageCreatedTimestamp >= this.canReviveAt;
    this.canReviveAt = messageCreatedTimestamp + Time.Minute * 30;

    if (!this.startedTimer) {
      this.startedTimer = true;

      this.revivalInterval = setInterval(async () => {
        if (Date.now() >= messageCreatedTimestamp + Time.Minute * 60) {
          try {
            const generalChannel =
              await messageGuild.channels.fetch(GENERAL_CHANNEL_ID);
            if (generalChannel?.isTextBased()) {
              await generalChannel.send('👀');
            }
          } catch (err) {
            console.error('Error sending hint:', err);
          } finally {
            clearInterval(this.revivalInterval);
            this.startedTimer = false;
            this.revivalInterval = undefined;
          }
        }
      }, 10_000);
    }

    if (!chatWasRevived) {
      return;
    }

    const memberHasDeadChat = messageMember.roles.cache.has(DEADCHAT_ROLE);
    if (memberHasDeadChat) {
      return;
    }

    const [reply] = await Promise.all([
      eMessage.reply({
        content: 'Hang on a second…',
      }),
      this.previousReply?.delete().catch(error => (console.error(error), null)),
    ]);

    const guildMembersWithDeadChat = messageGuild.members.cache.filter(member =>
      member.roles.cache.has(DEADCHAT_ROLE),
    );

    const assignDeadChat = messageMember.roles.add(DEADCHAT_ROLE);
    const removeDeadChat = Promise.all(
      [...guildMembersWithDeadChat.values()].map(member =>
        member.roles.remove(DEADCHAT_ROLE),
      ),
    );
    // Assign the DEADCHAT role to the user and remove it from all others.

    await Promise.all([assignDeadChat, removeDeadChat]);

    await reply.edit({
      content: `You've stolen the <@&${DEADCHAT_ROLE}> role.`,
    });

    this.previousReply = reply;
  }
}
