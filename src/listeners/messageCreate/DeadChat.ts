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
  private canReviveAt = Date.now() + Time.Minute * 0; // Initial time when the chat can be revived (15 minutes from now).
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
    // • Not in #🚀｜general.
    // • User join messages.
    // • Not a regular message (e.g. a thread starter).
    // • Not a message that can be revived.
    // • Not a message that can be revived
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

    // Send a reminder if someone could have stolen the role but didn't for more than 15 minutes
    const now = Date.now();
    const timeSinceCanRevive = now - this.canReviveAt;
    if (timeSinceCanRevive > Time.Minute * 15) {
      console.log("It's up for grabs!");
      if (
        'send' in eMessage.channel &&
        typeof eMessage.channel.send === 'function'
      ) {
        const hints = [
          '👀',
          '<:rexx_pwease:1352306779412893747>',
          ':bobacatsip:',
          ':SoftieArrive:',
          ':nko_wave:',
          '<:nko_think_confused:1275470067567558666>',
          ':Rain:',
          ':nko_arrive:',
          ':nko_leave:',
          ':nko_cry:',
          ':BMODancing:',
          // Lastly a funny hint to make it more engaging
          "Guys I got softie's credit card <:nko_yay:1275470075314311272>",
        ];
        const randomHint = hints[Math.floor(Math.random() * hints.length)];

        eMessage.channel.send(randomHint).catch(console.error);
      }
    }
    //ignore messages from a specific user
    if (messageAuthor.id === process.env.IGNORE_USER_ID) {
      console.log('A message came in from someone I want to ignore');
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

    // Go no further if #🚀｜general was not revived.
    if (!chatWasRevived) {
      console.log(
        'Main was not actually dead. Chat will be dead if no reply by ' +
          new Date(this.canReviveAt).toLocaleTimeString(),
      );
      return;
    }

    // Update the next revive timestamp to a random time between 15 and 60 minutes.

    this.canReviveAt =
      messageCreatedTimestamp +
      Time.Minute * (Math.floor(Math.random() * 46) + 15);
    console.log(
      `The chat has been revived! Now the next revive can happen at ${new Date(this.canReviveAt).toLocaleTimeString()}`,
    );

    // The chat was revived; proceed to assign the role.

    // Check if the member already has @Dead Chat.
    const memberHasDeadChat = messageMember.roles.cache.has(DEADCHAT_ROLE_ID);

    // Go no further if the member already has @Dead Chat.
    if (memberHasDeadChat) {
      console.log(
        `${messageMember.user.tag} (${messageMember.id}) already has @Dead Chat. Now the next revive can happen at ${new Date(this.canReviveAt).toLocaleTimeString()}`,
      );
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
      guildMember => guildMember.roles.cache.has(DEADCHAT_ROLE_ID),
    );

    // Assign @Dead Chat to the author of the message.
    const assignDeadChat = messageMember.roles.add(DEADCHAT_ROLE_ID);

    // If anyone has @Dead Chat, remove it from them and output a message to console for error and success!
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
