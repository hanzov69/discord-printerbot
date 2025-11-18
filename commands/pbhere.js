import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { setChannel } from '../config/channels.js';

export default {
  data: new SlashCommandBuilder()
    .setName('pbhere')
    .setDescription('Sets this channel as the announce channel for webhook messages'),
  
  async execute(interaction) {
    const channelId = interaction.channel.id;
    const guildId = interaction.guild.id;
    
    // Store the announce channel for this guild and save to storage
    await setChannel(guildId, channelId);
    
    const embed = new EmbedBuilder()
      .setTitle('✅ Announce Channel Set')
      .setDescription(`This channel (<#${channelId}>) is now set as the announce channel for webhook messages.`)
      .setColor(0x5865F2)
      .setTimestamp()
      .setFooter({ text: 'Prusa Better Discord' });

    await interaction.reply({ embeds: [embed] });
  }
};

