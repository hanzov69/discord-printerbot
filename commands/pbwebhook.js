import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { createWebhook, getUserWebhooks, deleteWebhook, updateWebhookPrivacy } from '../config/webhooks.js';
import { isAdministrator } from '../config/administrators.js';

export default {
  data: new SlashCommandBuilder()
    .setName('pbwebhook')
    .setDescription('Manage custom webhook endpoints')
    .addSubcommand(subcommand =>
      subcommand
        .setName('create')
        .setDescription('Create a new custom webhook endpoint')
        .addStringOption(option =>
          option
            .setName('identifier')
            .setDescription('Unique identifier for your webhook (3-50 chars, alphanumeric and hyphens only)')
            .setRequired(true)
        )
        .addBooleanOption(option =>
          option
            .setName('public')
            .setDescription('Whether the webhook is public (default: true). Private webhooks send DMs only to you.')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('List all your custom webhook endpoints')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('delete')
        .setDescription('Delete a custom webhook endpoint')
        .addStringOption(option =>
          option
            .setName('identifier')
            .setDescription('Identifier of the webhook to delete')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('privacy')
        .setDescription('Toggle webhook privacy (public/private)')
        .addStringOption(option =>
          option
            .setName('identifier')
            .setDescription('Identifier of the webhook')
            .setRequired(true)
        )
        .addBooleanOption(option =>
          option
            .setName('public')
            .setDescription('Set to true for public, false for private')
            .setRequired(true)
        )
    ),
  
  async execute(interaction) {
    // Check if user is administrator
    if (!isAdministrator(interaction.guild.id, interaction.member)) {
      const embed = new EmbedBuilder()
        .setTitle('❌ Permission Denied')
        .setDescription('You must be an administrator to use this command.')
        .setColor(0xDC3545)
        .setTimestamp()
        .setFooter({ text: 'Prusa Better Discord' });

      return await interaction.reply({ embeds: [embed], ephemeral: true });
    }

    const subcommand = interaction.options.getSubcommand();
    const userId = interaction.user.id;
    const guildId = interaction.guild.id;
    const baseUrl = process.env.WEBHOOK_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;

    if (subcommand === 'create') {
      const identifier = interaction.options.getString('identifier');
      const isPublic = interaction.options.getBoolean('public') !== false; // Default to true
      
      try {
        await createWebhook(userId, guildId, identifier, isPublic);
        
        const webhookUrl = `${baseUrl}/webhook/${identifier}`;
        
        const embed = new EmbedBuilder()
          .setTitle('✅ Webhook Created')
          .setDescription(`Your custom webhook endpoint has been created!`)
          .addFields(
            {
              name: 'Identifier',
              value: `\`${identifier}\``,
              inline: true
            },
            {
              name: 'Privacy',
              value: isPublic ? '🔓 Public' : '🔒 Private',
              inline: true
            },
            {
              name: 'Webhook URL',
              value: `\`${webhookUrl}\``,
              inline: false
            },
            {
              name: 'Note',
              value: isPublic 
                ? 'Messages will be posted in the announce channel.'
                : 'Messages will be sent as a private DM only to you.',
              inline: false
            }
          )
          .setColor(0x5865F2)
          .setTimestamp()
          .setFooter({ text: 'Prusa Better Discord' });

        await interaction.reply({ embeds: [embed], ephemeral: true });
      } catch (error) {
        const embed = new EmbedBuilder()
          .setTitle('❌ Error')
          .setDescription(error.message)
          .setColor(0xDC3545)
          .setTimestamp()
          .setFooter({ text: 'Prusa Better Discord' });

        await interaction.reply({ embeds: [embed], ephemeral: true });
      }
    } else if (subcommand === 'list') {
      const webhooks = getUserWebhooks(userId).filter(w => w.guildId === guildId);
      
      if (webhooks.length === 0) {
        const embed = new EmbedBuilder()
          .setTitle('📋 Your Webhooks')
          .setDescription('You have no custom webhook endpoints for this server.')
          .setColor(0x5865F2)
          .setTimestamp()
          .setFooter({ text: 'Prusa Better Discord' });

        return await interaction.reply({ embeds: [embed], ephemeral: true });
      }

      const webhookList = webhooks.map(w => {
        const url = `${baseUrl}/webhook/${w.identifier}`;
        const privacy = w.isPublic !== false ? '🔓 Public' : '🔒 Private';
        return `**${w.identifier}** ${privacy}\n\`${url}\``;
      }).join('\n\n');

      const embed = new EmbedBuilder()
        .setTitle('📋 Your Webhooks')
        .setDescription(webhookList)
        .setColor(0x5865F2)
        .setTimestamp()
        .setFooter({ text: 'Prusa Better Discord' });

      await interaction.reply({ embeds: [embed], ephemeral: true });
    } else if (subcommand === 'delete') {
      const identifier = interaction.options.getString('identifier');
      
      try {
        await deleteWebhook(identifier, userId);
        
        const embed = new EmbedBuilder()
          .setTitle('✅ Webhook Deleted')
          .setDescription(`The webhook endpoint \`${identifier}\` has been deleted.`)
          .setColor(0x5865F2)
          .setTimestamp()
          .setFooter({ text: 'Prusa Better Discord' });

        await interaction.reply({ embeds: [embed], ephemeral: true });
      } catch (error) {
        const embed = new EmbedBuilder()
          .setTitle('❌ Error')
          .setDescription(error.message)
          .setColor(0xDC3545)
          .setTimestamp()
          .setFooter({ text: 'Prusa Better Discord' });

        await interaction.reply({ embeds: [embed], ephemeral: true });
      }
    } else if (subcommand === 'privacy') {
      const identifier = interaction.options.getString('identifier');
      const isPublic = interaction.options.getBoolean('public');
      
      try {
        await updateWebhookPrivacy(identifier, userId, isPublic);
        
        const embed = new EmbedBuilder()
          .setTitle('✅ Privacy Updated')
          .setDescription(`Webhook \`${identifier}\` is now ${isPublic ? 'public' : 'private'}.`)
          .addFields(
            {
              name: 'Privacy Setting',
              value: isPublic ? '🔓 Public' : '🔒 Private',
              inline: true
            },
            {
              name: 'Behavior',
              value: isPublic 
                ? 'Messages will be posted in the announce channel for everyone to see.'
                : 'Messages will be sent as a private DM only to you.',
              inline: false
            }
          )
          .setColor(0x5865F2)
          .setTimestamp()
          .setFooter({ text: 'Prusa Better Discord' });

        await interaction.reply({ embeds: [embed], ephemeral: true });
      } catch (error) {
        const embed = new EmbedBuilder()
          .setTitle('❌ Error')
          .setDescription(error.message)
          .setColor(0xDC3545)
          .setTimestamp()
          .setFooter({ text: 'Prusa Better Discord' });

        await interaction.reply({ embeds: [embed], ephemeral: true });
      }
    }
  }
};

