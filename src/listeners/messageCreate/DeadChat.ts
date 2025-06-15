// ./src/listeners/messageCreate/DeadChat.ts

// ? This listener will assign @Dead Chat to a guild member if they send a message in #🚀｜general
// ? after it has been inactive for 10 minutes.

import {ApplyOptions} from '@sapphire/decorators';
import {Events, Listener, UserError} from '@sapphire/framework';
import {Guild, GuildMember, Message} from 'discord.js';
import {MessageType} from 'discord.js';
import {Time} from '@sapphire/duration';
import 'dotenv/config';

const listenerOptions = {
  event: Events.MessageCreate,
};

@ApplyOptions<Listener.Options>(listenerOptions)
export class DeadChat extends Listener {
  private canReviveAt = Date.now() + Time.Minute * 10;
  private previousReply?: Message;

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
      console.error('Missing GENREAL ID or Dead Chat Role ID in .env');
      return;
    }

    // Ignore messages that are:
    // • From bots.
    // • Not in #🚀｜general.
    // • User join messages.
    if (messageAuthor.bot) {
      return;
    } else if (messageChannelId !== GENERAL_CHANNEL_ID) {
      return;
    } else if (messageType === MessageType.UserJoin) {
      return;
    }

    // Type-check(s) — they will never be thrown.
    if (!(messageGuild instanceof Guild)) {
      throw new UserError({
        identifier: __filename,
        message: '"messageGuild" must be a Guild.',
      });
    } else if (!(messageMember instanceof GuildMember)) {
      throw new UserError({
        identifier: __filename,
        message: '"messageMember" must be a GuildMember.',
      });
    }

    // Check if #🚀｜general was revived.
    const chatWasRevived = messageCreatedTimestamp >= this.canReviveAt;

    // Update the next revive timestamp.
    this.canReviveAt = messageCreatedTimestamp + Time.Minute * 1;

    // Go no further if #🚀｜general was not revived.
    if (!chatWasRevived) {
      return;
    }

    // Check if the member already has @Dead Chat.
    const memberHasDeadChat = messageMember.roles.cache.has(DEADCHAT_ROLE);

    // Go no further if the member already has @Dead Chat.
    if (memberHasDeadChat) {
      return;
    }

    const [reply] = await Promise.all([
      // Provide feedback.
      eMessage.reply({
        content: 'Hang on a second…',
      }),

      // Delete the previous reply, if one exists.
      this.previousReply?.delete().catch(error => (console.error(error), null)),
    ]);

    // Get all guild members with @Dead Chat.
    const guildMembersWithDeadChat = messageGuild.members.cache.filter(
      guildMember => guildMember.roles.cache.has(DEADCHAT_ROLE),
    );

    // Assign @Dead Chat to the author of the message.
    const assignDeadChat = (async () => {
      await messageMember.roles.add(DEADCHAT_ROLE);
    })();

    // If anyone has @Dead Chat, remove it from them.
    const removeDeadChat = (async () => {
      await Promise.all(
        guildMembersWithDeadChat.map(
          guildMemberWithDeadChat =>
            guildMemberWithDeadChat.roles.remove(DEADCHAT_ROLE), // Prettier is stubborn.
        ),
      );
    })();

    // Wait for both of the above tasks to complete.
    await Promise.all([assignDeadChat, removeDeadChat]);

    // Provide feedback.
    await reply.edit({
      content: `You've stolen the <@&${DEADCHAT_ROLE}> role.`, // prettier-ignore
    });

    this.previousReply = reply;
  }
}
