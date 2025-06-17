// ./src/listeners/messageCreate/DeadChat.ts

// ? This listener will assign @DEADCHAT_ROLE to a guild member if they send a message in #GENERAL_CHANNEL_ID
// ? after it has been inactive for INACTIVITY_TIME minutes.

import {ApplyOptions} from '@sapphire/decorators';
import {Events, Listener, UserError} from '@sapphire/framework';
import {Guild, GuildMember, Message, MessageType} from 'discord.js';
import {Time} from '@sapphire/duration';
import 'dotenv/config';

const DEADCHAT_ROLE_ID = process.env.DEADCHAT_ROLE_ID as string;

const listenerOptions = {
  event: Events.MessageCreate,
};

@ApplyOptions<Listener.Options>(listenerOptions)
export class DeadChat extends Listener {
  // Initial time when the chat is considered dead so thatcan be revived (15 minutes from now).
  private timeOfDeath = Date.now() + Time.Minute * 2;
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

    // Ignore messages that are:
    // • From bots.
    // • Not in specified channel.
    // • User join messages.
    if (messageAuthor.bot) {
      return;
    } else if (messageChannelId !== process.env.GENERAL_CHANNEL_ID) {
      return;
    } else if (messageType === MessageType.UserJoin) {
      return;
    }

    // Ignore messages that only contain emojis, attachments, or stickers
    const content = eMessage.content.trim();

    // Regex to match only emojis (Unicode or custom Discord ones)
    const onlyEmotesRegex = /^(?:<a?:\w+:\d+>|\p{Extended_Pictographic}|\s)+$/u;

    const hasOnlyEmojis = content.length > 0 && onlyEmotesRegex.test(content);
    const hasOnlyAttachments =
      eMessage.attachments.size > 0 &&
      content === '' &&
      eMessage.stickers.size === 0;
    const hasOnlyStickers =
      eMessage.stickers.size > 0 &&
      content === '' &&
      eMessage.attachments.size === 0;

    if (hasOnlyEmojis || hasOnlyAttachments || hasOnlyStickers) {
      return;
    }
    // Ignore messages from a user who already has @Dead Chat.
    if (!messageMember || messageMember.roles.cache.has(DEADCHAT_ROLE_ID)) {
      return;
    }

    //ignore messages from a specific user
    if (messageAuthor.id === process.env.IGNORE_USER_ID) {
      console.log('Chat is still dying, ignored user.');
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
    const wasChatDead = messageCreatedTimestamp >= this.timeOfDeath;

    // Update the next revive timestamp to 15 from no.

    this.timeOfDeath = Date.now() + Time.Minute * 15;

    // Go no further if #🚀｜general was not revived.
    if (!wasChatDead) {
      console.log(
        'Main is alive for now! Chat will be dead if no reply by ' +
          new Date(this.timeOfDeath).toLocaleTimeString(),
      );
      return;
    }

    // CONGRATULATIONS! THE CHAT WAS DEAD BUT NOW IT HAS BEEN REVIVED!
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
      guildMember => guildMember.roles.cache.has(DEADCHAT_ROLE_ID),
    );

    // Assign @Dead Chat to the author of the message.
    const assignDeadChat = messageMember.roles.add(DEADCHAT_ROLE_ID);

    // Get a list of all the users with @deadchat role, iterate through themm and remove the role from thema and log success. If there are any errors, log them too!
    const removeDeadChat = Promise.all(
      guildMembersWithDeadChat.map(guildMember =>
        guildMember.roles
          .remove(DEADCHAT_ROLE_ID)
          .then(() => {
            console.log(
              `Removed @Dead Chat from ${guildMember.user.tag} (${guildMember.id})`,
            );
          })
          .catch(error => {
            console.error(
              `Failed to remove @Dead Chat from ${guildMember.user.tag} (${guildMember.id}): ${error.message}`,
            );
          }),
      ),
    );

    // Wait for both of the above tasks to complete.
    await Promise.all([assignDeadChat, removeDeadChat]);

    // Provide feedback.
    await reply.edit({
      content: `You've stolen the <@&${DEADCHAT_ROLE_ID}> role.`, // prettier-ignore
    });

    this.previousReply = reply;
  }
}
