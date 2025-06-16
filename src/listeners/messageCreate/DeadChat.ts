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
  private previousReply?: Message;
  private revivalTimeout?: NodeJS.Timeout;

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
    // Ignore messages from a specific user.

    if (messageAuthor.id === process.env.IGNORE_USER_ID) {
      console.log(
        `Ignoring message from user ${messageAuthor.tag} in #general channel.`,
      );
      return;
    }
    // Ignore messages that only contain emojis or are whitespace
    const content = eMessage.content.trim();

    // Regex to check if the message contains only emojis, emotes, or whitespace.
    // This regex matches:
    // - Custom emotes in the format <a:emote_name:id> or <:emote_name:id>
    // - Unicode emojis (including extended pictographic characters)
    // - Whitespace characters
    // It does not match any other characters, ensuring that the message is purely emojis or whitespace.
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
    // Ensure that messageGuild and messageMember are valid Guild and GuildMember instances.
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

    // We check if the chat was revived by comparing the message's created timestamp
    // with the time we can revive the chat. If the message was created after
    // the revival time, we consider it a revival.
    // We also set the revival time to 30 minutes after the message was created.
    // This means that the chat can be revived every 30 minutes.
    // If the chat was revived, we start a timer that will send a hint in the #general channel
    // after 60 minutes of inactivity.

    const chatWasRevived = messageCreatedTimestamp >= this.canReviveAt;
    this.canReviveAt = messageCreatedTimestamp + Time.Minute * 30;

    // Clear any existing inactivity timeout and set a new one
    if (this.revivalTimeout) {
      clearTimeout(this.revivalTimeout);
      this.revivalTimeout = undefined;
    }
    this.revivalTimeout = setTimeout(async () => {
      try {
        const generalChannel =
          await messageGuild.channels.fetch(GENERAL_CHANNEL_ID);
        if (generalChannel?.isTextBased()) {
          console.log(
            `Sending hint in #general channel: ${generalChannel.name}`,
          );
          const hints = [
            '👀',
            '<:rexx_pwease:1352306779412893747>',
            '<:bobacatsip:1274756500740374528>',
            '<:SoftieArrive:1338954851371192372>',
            '<:nko_wave:1275443699035148410>',
            '<:nko_think_confused:1275470067567558666>',
            '<:Rain:1383245182429958335>',
            '<:nko_arrive:1275443671621308477>',
            '<:nko_leave:1275439040358780930>',
            '<:nko_cry:1275439040358780930>',
            '<:BMODancing:1303882670702596187>',
            // Lastly a funny hint to make it more engaging
            "Guys I got softie's credit card <:nko_yay:1275470075314311272>",
          ];
          const randomHint = hints[Math.floor(Math.random() * hints.length)];
          await generalChannel.send(randomHint);
        }
      } catch (err) {
        console.error('Error sending hint:', err);
      } finally {
        this.revivalTimeout = undefined;
      }
    }, Time.Minute * 30);
    // If the user has the DEADCHAT role, we do nothing.
    // If the user does not have the DEADCHAT role, we assign it to them and remove it from all others.
    if (!chatWasRevived) {
      console.log(
        `Chat was not revived. Can revive at: ${new Date(this.canReviveAt).toLocaleTimeString()}`,
      );
      return;
    }

    const memberHasDeadChat = messageMember.roles.cache.has(DEADCHAT_ROLE);
    if (memberHasDeadChat) {
      console.log(
        `User ${messageAuthor.tag} already has the DEADCHAT role. No action taken.`,
      );
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
    // Assign the DEADCHAT role to the user and remove it from all others.
    const removeDeadChat = Promise.all(
      [...guildMembersWithDeadChat.values()].map(member => {
        console.log(`Removed DEADCHAT role from user ${member.user.tag}`);
        return member.roles.remove(DEADCHAT_ROLE);
      }),
    );
    // Assign the DEADCHAT role to the user and remove it from all others.

    await Promise.all([assignDeadChat, removeDeadChat]);

    await reply.edit({
      content: `You've stolen the <@&${DEADCHAT_ROLE}> role.`,
    });

    this.previousReply = reply;
  }
}
