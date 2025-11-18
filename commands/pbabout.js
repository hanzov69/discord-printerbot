import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getChannel } from '../config/channels.js';

export default {
  data: new SlashCommandBuilder()
    .setName('pbabout')
    .setDescription('Shows basic information about the Prusa Better Discord bot'),
  
  async execute(interaction) {
    const guildId = interaction.guild.id;
    const announceChannelId = getChannel(guildId);
    const announceChannelText = announceChannelId 
      ? `<#${announceChannelId}>` 
      : 'Not set (use `/pbhere` to set)';

    const embed = new EmbedBuilder()
      .setTitle('🤖 Prusa Better Discord')
      .setDescription('A Discord bot for Prusa Connect notifications and more')
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
      .setFooter({ text: 'Prusa Better Discord' });

    await interaction.reply({ embeds: [embed] });
  }
};

