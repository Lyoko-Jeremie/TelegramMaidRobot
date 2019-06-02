import Telegraf, {ContextMessageUpdate} from "telegraf";
import {Chat, ChatPhoto, Message} from "telegraf/typings/telegram-types";
import * as moment from "moment";
import {Subject} from "rxjs";


export class UserChatInfo implements Chat {

    /**
     * Unique identifier for this chat. This number may be greater than 32 bits
     * and some programming languages may have difficulty/silent defects in
     * interpreting it. But it is smaller than 52 bits, so a signed 64 bit
     * integer or double-precision float type are safe for storing this identifier.
     */
    id: number;
    /**
     * Type of chat, can be either “private”, “group”, “supergroup” or “channel”
     */
    type: string;
    first_name?: string;
    last_name?: string;
    username?: string;
    title?: string;
    description?: string;
    invite_link?: string;
    sticker_set_name?: string;
    photo?: ChatPhoto;
    pinned_message?: Message;
    all_members_are_administrators?: boolean;
    can_set_sticker_set?: boolean;

    constructor(c: Chat) {
        this.id = c.id;
        this.type = c.type;
        this.first_name = c.first_name;
        this.last_name = c.last_name;
        this.username = c.username;
        this.title = c.title;
        this.description = c.description;
        this.invite_link = c.invite_link;
        this.sticker_set_name = c.sticker_set_name;
        this.photo = c.photo;
        this.pinned_message = c.pinned_message;
        this.all_members_are_administrators = c.all_members_are_administrators;
        this.can_set_sticker_set = c.can_set_sticker_set;
    }

    print() {
        return ""
            + "======================================"
            + "\nid:" + this.id
            + "\ntype:" + this.type
            + "\ntitle:" + this.title
            + "\nusername:" + this.username
            + "\nfirst_name:" + this.first_name
            + "\nlast_name:" + this.last_name
            + "\n"
            + "======================================";
    }

}

export interface ContextMessageUpdateCustom extends ContextMessageUpdate {
    chatInfo: Chat;
    userChatInfo: UserChatInfo;
}

export class BotBase {
    public bot: Telegraf<ContextMessageUpdate>;
    public botHelpEvent: Subject<ContextMessageUpdate> = new Subject<ContextMessageUpdate>();

    constructor() {
        let socksAgent;
        if (process.env.socksPort) {
            console.log("find socksPort, use SocksAgent");

            const SocksAgent = require('socks5-https-client/lib/Agent');

            socksAgent = new SocksAgent({
                // socksHost: config.proxy.host,
                // socksPort: config.proxy.port,
                // socksUsername: config.proxy.login,
                // socksPassword: config.proxy.psswd,
                socksHost: process.env.socksHost,
                socksPort: process.env.socksPort,
            });

        } else {
            console.log("not find socksPort, not use SocksAgent");
        }

        this.bot = new Telegraf(process.env.BOT_TOKEN, {
            telegram: {agent: socksAgent}
        });


        // https://telegraf.js.org/#/?id=recipes
        this.bot.telegram.getMe().then((botInfo) => {
            // issue https://github.com/telegraf/telegraf/issues/587
            (<any>this.bot).options.username = botInfo.username;
        });


        this.bot.use((ctx: ContextMessageUpdateCustom, next: () => any) => {
            ctx.getChat().then(T => {
                const ui = new UserChatInfo(T);
                console.log(ui.print());
                // console.log("Last received non text message ARE come from:\n" + ui.print());
                ctx.chatInfo = T;
                ctx.userChatInfo = ui;
                return next();
            }).catch(E => {
                // console.error("received non text message getChat ERROR.", E);

                return next();
            });
        });

        this.bot.use((ctx: ContextMessageUpdate, next: () => any) => {
            if (ctx.message && ctx.message.text) {
                console.log("=received : ", ctx.message.text);
            } else {
                ctx.getChat().then(T => {
                    const ui = new UserChatInfo(T);
                    // console.log(ui.print());
                    console.log("Last received non text message ARE come from:\n" + ui.print());
                }).catch(E => {
                    console.error("received non text message getChat ERROR.", E);
                });
                console.log("=received non text message.");
            }
            return next()
        });


        const helpFunc = (ctx: ContextMessageUpdate) => {
            let s: string = `How to use me :`;
            const sList: string[] = [
                'Send me a sticker',
                'tell me "hi"',
                'command me "/oldschool"',
                'command me "/modern"',
                'command me "/hipster"',
                'command me "/getDatetime"',
                'command me "/register" to listen WebHook event',
                'command me "/unregister" to un-listen WebHook event',
                'command me "/liveTime" to get my live time info',
            ];
            for (let i = 0; i != sList.length; ++i) {
                s += "\n" + (i + 1) + " " + sList[i];
            }
            ctx.reply(s);

            this.botHelpEvent.next(ctx);

        };

        this.bot.help(helpFunc);
        this.bot.command("help", helpFunc);

        this.bot.start((ctx: ContextMessageUpdate) => {
            ctx.reply('Welcome!\nYou can send me "/help" to see the action list.');
            ctx.getChat().then(T => {
                const ui = new UserChatInfo(T);
                console.log("a new /start with:" + ui.print());
            });
        });


        this.bot.on('sticker', (ctx) => ctx.reply('👍'));
        this.bot.hears('hi', (ctx) => ctx.reply('Hey there'));
        this.bot.command('oldschool', (ctx) => ctx.reply('Hello'));
        this.bot.command('modern', ({reply}) => reply('Yo'));
        this.bot.command('hipster', (ctx) => ctx.reply('λ'));
        this.bot.command('getDatetime', (ctx) => ctx.reply(moment().format()));


        let startTime = moment();
        this.bot.command('liveTime', (ctx) => {
            ctx.reply(''
                + ' \n' + 'alive time: ' + moment().from(startTime)
                + ' \n' + 'last boot time: ' + startTime.format('YYYY-MM-DD HH:mm:ss')
            );
        });


    }


    public start() {
        this.bot.startPolling();
    }


}


