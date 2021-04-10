const router = require("express-promise-router")();
const passport = require("passport");
const { DiscordAPIError } = require("discord.js");

const Logger = require("../../../../Logger.js");
const DiscordClient = require("../../../../DiscordClient.js")();
const config = require("../../../../../../config.json");
const { isDatabaseAvailable, isAuthenticated } = require("../../../../middlewares.js");
const ErrorCode = require("../../../../models/ErrorCodes.js");


let logger = Logger.get("AuthDiscordRouter");


router.get("/", isDatabaseAvailable, isAuthenticated, passport.authenticate("discord", { scope: ['identify', 'guilds.join'] }));

router.get("/callback", isDatabaseAvailable, isAuthenticated, passport.authenticate("discord", { failureRedirect: "/" }) , async (req, res) => {
    
    let discordMember = await DiscordClient.fetchMember(req.user.discord.userId, true);
    
    if (!discordMember) {
        try {
            await DiscordClient.discordGuild.addMember(req.user.discord.userId, {
                accessToken: req.user.discord.accessToken,
                nick: req.user.osu.username,
                roles: [config.discord.roles.verifiedRole]
            });
        } catch(err) {
            if(!(err instanceof DiscordAPIError && err.code === 30001))
                throw err;
        }
    }

    await req.user.osu.fetchUser();
    await req.user.discord.updateUser();
    
    res.redirect("/");
});

router.get("/delink", isDatabaseAvailable, isAuthenticated, async (req, res) => {
    if(Date.now() - req.user.discord.dateAdded.getTime() > 86400000) { 
        const osuID = req.user.osu.userId;
        const discordID = req.user.discord.userId;
    

        await req.user.discord.delink();
        req.user.discord = null;
        await req.user.save();

        logger.info(`**${req.user.getUsername()}** \`osu ID: ${osuID}\` \`Discord ID: ${discordID}\` has delinked their Discord account.`);
        return res.json({ error: false });
    } else {
        throw ErrorCode.FORBIDDEN;
    }
})

module.exports = router;