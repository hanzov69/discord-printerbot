import { Strategy as OAuth2Strategy } from 'passport-oauth2';
import axios from 'axios';

export class DiscordStrategy extends OAuth2Strategy {
  constructor(options, verify) {
    const oauth2Options = {
      authorizationURL: 'https://discord.com/api/oauth2/authorize',
      tokenURL: 'https://discord.com/api/oauth2/token',
      clientID: options.clientID,
      clientSecret: options.clientSecret,
      callbackURL: options.callbackURL,
      scope: options.scope || ['identify']
    };

    // Wrap verify to fetch profile first
    const wrappedVerify = async (accessToken, refreshToken, params, profile, done) => {
      try {
        // Fetch user profile
        const userResponse = await axios.get('https://discord.com/api/users/@me', {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        });

        const userProfile = {
          provider: 'discord',
          id: userResponse.data.id,
          username: userResponse.data.username,
          discriminator: userResponse.data.discriminator,
          avatar: userResponse.data.avatar,
          email: userResponse.data.email,
          verified: userResponse.data.verified,
          _raw: JSON.stringify(userResponse.data),
          _json: userResponse.data
        };

        // Fetch guilds if scope includes 'guilds'
        if (options.scope && options.scope.includes('guilds')) {
          try {
            const guildsResponse = await axios.get('https://discord.com/api/users/@me/guilds', {
              headers: {
                Authorization: `Bearer ${accessToken}`
              }
            });
            userProfile.guilds = guildsResponse.data;
          } catch (err) {
            console.error('Error fetching guilds:', err.message);
            userProfile.guilds = [];
          }
        } else {
          userProfile.guilds = [];
        }

        // Call original verify with the fetched profile
        return verify(accessToken, refreshToken, userProfile, done);
      } catch (err) {
        return done(err);
      }
    };

    super(oauth2Options, wrappedVerify);
    
    this.name = 'discord';
  }
}

