import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getChannel, setChannel } from '../config/channels.js';
import { setAdminRole, isAdministrator } from '../config/administrators.js';
import { createWebhook, getUserWebhooks, deleteWebhook, updateWebhookPrivacy } from '../config/webhooks.js';

export default {
  data: new SlashCommandBuilder()
    .setName('pb')
    .setDescription('PrinterBot main command')
    // About subcommand
    .addSubcommand(subcommand =>
      subcommand
        .setName('about')
        .setDescription('Shows basic information about the PrinterBot bot')
    )
    // Admin subcommands
    .addSubcommandGroup(group =>
      group
        .setName('admin')
        .setDescription('Configure bot administrator settings')
        .addSubcommand(subcommand =>
          subcommand
            .setName('role')
            .setDescription('Configure administrator role for the bot')
            .addRoleOption(option =>
              option
                .setName('role')
                .setDescription('Discord role to grant administrator access (leave empty to clear)')
                .setRequired(false)
            )
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('channel')
            .setDescription('Set the announce channel for webhook messages')
            .addChannelOption(option =>
              option
                .setName('channel')
                .setDescription('Channel to set as announce channel (leave empty to use current channel)')
                .setRequired(false)
            )
        )
    )
    // Webhook subcommands
    .addSubcommandGroup(group =>
      group
        .setName('webhook')
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
        )
    ),
  
  async execute(interaction) {
    const subcommandGroup = interaction.options.getSubcommandGroup();
    const subcommand = interaction.options.getSubcommand();

    // Handle /pb about
    if (!subcommandGroup && subcommand === 'about') {
      const guildId = interaction.guild.id;
      const announceChannelId = getChannel(guildId);
      const announceChannelText = announceChannelId 
        ? `<#${announceChannelId}>` 
        : 'Not set (use `/pb admin channel` to set)';

      const embed = new EmbedBuilder()
        .setTitle('🤖 PrinterBot')
        .setDescription('A Discord bot for 3D printer notifications and more')
        .setColor(0x5865F2) // Discord blurple
        .addFields(
          {
            name: '📦 Version',
            value: '1.0.0',
            inline: true
          },
          {
            name: '🔧 Status',
            value: '✅ Online',
            inline: true
          },
          {
            name: '📡 Announce Channel',
            value: announceChannelText,
            inline: false
          }
        )
        .setTimestamp()
        .setFooter({ text: 'PrinterBot' });

      return await interaction.reply({ embeds: [embed] });
    }

    // Handle /pb admin subcommands
    if (subcommandGroup === 'admin') {
      const isOwner = interaction.guild.ownerId === interaction.member.id;
      const isAdmin = isAdministrator(interaction.guild.id, interaction.member);
      
      if (!isOwner && !isAdmin) {
        const embed = new EmbedBuilder()
          .setTitle('❌ Permission Denied')
          .setDescription('Only server owners and administrators can configure bot settings.')
          .setColor(0xDC3545)
          .setTimestamp()
          .setFooter({ text: 'PrinterBot' });

        return await interaction.reply({ embeds: [embed], ephemeral: true });
      }

      const guildId = interaction.guild.id;

      if (subcommand === 'role') {
        const role = interaction.options.getRole('role');

        if (role) {
          // Set the admin role
          await setAdminRole(guildId, role.id);
          
          const embed = new EmbedBuilder()
            .setTitle('✅ Admin Role Set')
            .setDescription(`The role <@&${role.id}> has been granted administrator access.`)
            .setColor(0x5865F2)
            .setTimestamp()
            .setFooter({ text: 'PrinterBot' });

          return await interaction.reply({ embeds: [embed] });
        } else {
          // Clear the admin role
          await setAdminRole(guildId, null);
          
          const embed = new EmbedBuilder()
            .setTitle('✅ Admin Role Cleared')
            .setDescription('The administrator role has been cleared. Only the server owner will have administrator access.')
            .setColor(0x5865F2)
            .setTimestamp()
            .setFooter({ text: 'PrinterBot' });

          return await interaction.reply({ embeds: [embed] });
        }
      } else if (subcommand === 'channel') {
        const channel = interaction.options.getChannel('channel') || interaction.channel;
        
        // Validate channel type
        if (!channel.isTextBased()) {
          const embed = new EmbedBuilder()
            .setTitle('❌ Invalid Channel')
            .setDescription('The selected channel must be a text-based channel.')
            .setColor(0xDC3545)
            .setTimestamp()
            .setFooter({ text: 'PrinterBot' });

          return await interaction.reply({ embeds: [embed], ephemeral: true });
        }

        // Store the announce channel for this guild and save to storage
        await setChannel(guildId, channel.id);
        
        const embed = new EmbedBuilder()
          .setTitle('✅ Announce Channel Set')
          .setDescription(`The channel <#${channel.id}> is now set as the announce channel for webhook messages.`)
          .setColor(0x5865F2)
          .setTimestamp()
          .setFooter({ text: 'PrinterBot' });

        return await interaction.reply({ embeds: [embed] });
      }
    }

    // Handle /pb webhook subcommands
    if (subcommandGroup === 'webhook') {
      // Check if user is administrator
      if (!isAdministrator(interaction.guild.id, interaction.member)) {
        const embed = new EmbedBuilder()
          .setTitle('❌ Permission Denied')
          .setDescription('You must be an administrator to use this command.')
          .setColor(0xDC3545)
          .setTimestamp()
          .setFooter({ text: 'PrinterBot' });

        return await interaction.reply({ embeds: [embed], ephemeral: true });
      }

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
            .setFooter({ text: 'PrinterBot' });

          return await interaction.reply({ embeds: [embed], ephemeral: true });
        } catch (error) {
          const embed = new EmbedBuilder()
            .setTitle('❌ Error')
            .setDescription(error.message)
            .setColor(0xDC3545)
            .setTimestamp()
            .setFooter({ text: 'PrinterBot' });

          return await interaction.reply({ embeds: [embed], ephemeral: true });
        }
      } else if (subcommand === 'list') {
        const webhooks = getUserWebhooks(userId).filter(w => w.guildId === guildId);
        
        if (webhooks.length === 0) {
          const embed = new EmbedBuilder()
            .setTitle('📋 Your Webhooks')
            .setDescription('You have no custom webhook endpoints for this server.')
            .setColor(0x5865F2)
            .setTimestamp()
            .setFooter({ text: 'PrinterBot' });

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
          .setFooter({ text: 'PrinterBot' });

        return await interaction.reply({ embeds: [embed], ephemeral: true });
      } else if (subcommand === 'delete') {
        const identifier = interaction.options.getString('identifier');
        
        try {
          await deleteWebhook(identifier, userId);
          
          const embed = new EmbedBuilder()
            .setTitle('✅ Webhook Deleted')
            .setDescription(`The webhook endpoint \`${identifier}\` has been deleted.`)
            .setColor(0x5865F2)
            .setTimestamp()
            .setFooter({ text: 'PrinterBot' });

          return await interaction.reply({ embeds: [embed], ephemeral: true });
        } catch (error) {
          const embed = new EmbedBuilder()
            .setTitle('❌ Error')
            .setDescription(error.message)
            .setColor(0xDC3545)
            .setTimestamp()
            .setFooter({ text: 'PrinterBot' });

          return await interaction.reply({ embeds: [embed], ephemeral: true });
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
            .setFooter({ text: 'PrinterBot' });

          return await interaction.reply({ embeds: [embed], ephemeral: true });
        } catch (error) {
          const embed = new EmbedBuilder()
            .setTitle('❌ Error')
            .setDescription(error.message)
            .setColor(0xDC3545)
            .setTimestamp()
            .setFooter({ text: 'PrinterBot' });

          return await interaction.reply({ embeds: [embed], ephemeral: true });
        }
      }
    }
  }
};

