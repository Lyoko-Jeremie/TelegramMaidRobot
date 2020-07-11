import {asyncSleep, git_pull, restart_service, tsc_build, yarn_update_dependence} from "./self_upgrade_command";
import {BotBase, ContextMessageUpdateCustom, UserChatInfo} from "./bot-base";
import {Database} from "./database";
import * as Loki from "lokijs";
import {isNil} from "lodash";

export class BotAdmin {
    public adminListDB: Loki.Collection<UserChatInfo> =
        this.db.collectionGetter("adminList", {unique: ['id']});

    public isAdmin(ui: UserChatInfo): boolean {
        return !isNil(this.adminListDB.by('id', ui.id));
    }

    constructor(private botBase: BotBase, private db: Database) {
        if (!db.databaseInitialize.getValue()) {
            console.error("Must Init & Load Database before construct BotAdmin");
            throw "Must Init & Load Database before construct BotAdmin";
        }

        botBase.botHelpEvent.subscribe(ctx => {
            ctx.getChat().then(T => {
                const ui = new UserChatInfo(T);

                if (this.adminListDB.by('id', ui.id)) {
                    ctx.reply(''
                        + 'Oh~~ I see you are Master.'
                        + '\nSo~ you can use Master Only Command:'
                        + '\n Command me "/un_admin" to exit Master chat level'
                        + '\n Command me "/self_upgrade" to tell me to do a self upgrade'
                    );
                    return;
                }
            }).catch(E => {
                console.error("botHelpEvent Error:", E);
            });
        });


        botBase.bot.command(process.env.AdminPasswd || "AdminPassword", (ctx) => {
            ctx.getChat().then(T => {
                const ui = new UserChatInfo(T);
                console.log(ui.print());

                if (this.adminListDB.by('id', ui.id)) {
                    ctx.reply('Em? Master.(⊙_⊙)？'
                        + '\nMaster~~ you can use /un_admin to exit this chat level. ');
                    return;
                }
                this.adminListDB.insert(ui);

                ctx.reply('Hey Master !!!'
                    + '\nMaster~~ you can use /un_admin to exit this chat level. ');
            }).catch(E => {
                ctx.reply('error, try again. you need use this on private chat.');
            });
        });
        botBase.bot.command('un_admin', (ctx: ContextMessageUpdateCustom) => {
            ctx.getChat().then(T => {
                const ui = new UserChatInfo(T);
                console.log(ui.print());

                this.adminListDB.chain().find({id: ui.id}).remove();

                ctx.reply('Good-Bye Master~~\n ヾ(￣▽￣)Bye~Bye~');
            }).catch(E => {
                ctx.reply('error, try again. you need use this on private chat.');
            });
        });

        botBase.bot.command('self_upgrade', (ctx: ContextMessageUpdateCustom) => {
            ctx.getChat().then(T => {
                if (!this.adminListDB.by('id', T.id)) {
                    ctx.reply("error, i don't know how you are. \n **only** my master can use this.");
                    return;
                }

                ctx.reply('Hai! Master~~~(っ●ω●)っ .');
                git_pull().then(T => {
                    ctx.reply('Git Pull OK! Master~~~(っ●ω●)っ .' +
                        '\nfollow is the log:\n'
                        + '\ncode:' + T.code
                        + '\nout:' + T.out
                        + '\nerror:' + T.err
                        + '\n\n\nNow~~ I will update dependence.'
                    );
                    return yarn_update_dependence();
                }).then(T => {
                    ctx.reply('Yarn Update Dependence OK! Master~~~(っ●ω●)っ .' +
                        '\nfollow is the log:\n'
                        + '\ncode:' + T.code
                        + '\nout:' + T.out
                        + '\nerror:' + T.err
                        + '\n\n\nNow~~ I will build it.'
                    );
                    return tsc_build();
                }).then(T => {
                    ctx.reply('Tsc Build OK! Master~~~(っ●ω●)っ .' +
                        '\nfollow is the log:\n'
                        + '\ncode:' + T.code
                        + '\nout:' + T.out
                        + '\nerror:' + T.err
                        + '\n\n\nNow~~ I will restart myself. \nsee you later, Master~~◝(　ﾟ∀ ﾟ )◟ .'
                    );
                    return asyncSleep(1000 * 3);
                }).then(T => {
                    return restart_service();
                }).then(T => {
                    ctx.reply('restart command OK! Master~~~(っ●ω●)っ .' +
                        '\nfollow is the log:\n'
                        + '\ncode:' + T.code
                        + '\nout:' + T.out
                        + '\nerror:' + T.err
                    );
                }).catch(E => {
                    ctx.reply('Something Wrong! Master~~~(>ω<).' +
                        '\nfollow is the log:\n'
                        + '\ncode:' + E.code
                        + '\nout:' + E.out
                        + '\nerror:' + E.err
                    );
                });
            }).catch(E => {
                ctx.reply('error, try again. you need use this on private chat.');
            });
        });

    }

    public start() {
        this.adminListDB.data.forEach((v) => {
            this.botBase.bot.telegram.sendMessage(v.id,
                "Hi~ Master~~ I coming~~\n(^u^) Always serving for you Master~~");
        });
    }


}
