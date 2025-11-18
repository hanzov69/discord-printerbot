import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { setAdminRole, getAdminRole, isAdministrator } from '../config/administrators.js';
import { setChannel } from '../config/channels.js';

export default {
  data: new SlashCommandBuilder()
    .setName('pbadmin')
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
    ),
  
  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const isOwner = interaction.guild.ownerId === interaction.member.id;
    const isAdmin = isAdministrator(interaction.guild.id, interaction.member);
    
    if (!isOwner && !isAdmin) {
      const embed = new EmbedBuilder()
        .setTitle('❌ Permission Denied')
        .setDescription('Only server owners and administrators can configure bot settings.')
        .setColor(0xDC3545)
        .setTimestamp()
        .setFooter({ text: 'Prusa Better Discord' });

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
          .setFooter({ text: 'Prusa Better Discord' });

        await interaction.reply({ embeds: [embed] });
      } else {
        // Clear the admin role
        await setAdminRole(guildId, null);
        
        const embed = new EmbedBuilder()
          .setTitle('✅ Admin Role Cleared')
          .setDescription('The administrator role has been cleared. Only the server owner will have administrator access.')
          .setColor(0x5865F2)
          .setTimestamp()
          .setFooter({ text: 'Prusa Better Discord' });

        await interaction.reply({ embeds: [embed] });
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
          .setFooter({ text: 'Prusa Better Discord' });

        return await interaction.reply({ embeds: [embed], ephemeral: true });
      }

      // Store the announce channel for this guild and save to storage
      await setChannel(guildId, channel.id);
      
      const embed = new EmbedBuilder()
        .setTitle('✅ Announce Channel Set')
        .setDescription(`The channel <#${channel.id}> is now set as the announce channel for webhook messages.`)
        .setColor(0x5865F2)
        .setTimestamp()
        .setFooter({ text: 'Prusa Better Discord' });

      await interaction.reply({ embeds: [embed] });
    }
  }
};

