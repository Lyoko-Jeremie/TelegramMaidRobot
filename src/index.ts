// polyfill
import 'core-js';

import * as express from "express";
import * as Loki from "lokijs";
import {isNil} from "lodash";
import {get} from "lodash";
import {has} from "lodash";
import {ContextMessageUpdate} from "telegraf";
import moment = require("moment");
import {git_pull, restart_service, tsc_build} from "./self_upgrade_command";

moment.locale('zh-CN');

const LokiFsStructuredAdapter = require('lokijs/src/loki-fs-structured-adapter.js');
const lokiFsStructuredAdapter = new LokiFsStructuredAdapter();
let databaseInitialize: () => void;
const DB: Loki = new Loki("db/DB.json", {
    adapter: lokiFsStructuredAdapter,
    autoload: true,
    autoloadCallback: () => {
        databaseInitialize && databaseInitialize();
    },
    autosave: true,
    autosaveInterval: 4000
});


async function main() {

    const collectionGetter = <E extends object = any>(name: string, options?: Partial<CollectionOptions<E>>) => {
        let dbc: Loki.Collection<E> = DB.getCollection(name);
        if (dbc === null) {
            dbc = DB.addCollection(name, options);
        }
        return dbc;
    };

    const Telegraf = require('telegraf');

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

    const bot = new Telegraf(process.env.BOT_TOKEN, {
        telegram: {agent: socksAgent}
    });


    bot.telegram.getMe().then((botInfo) => {
        bot.options.username = botInfo.username
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

        ctx.getChat().then(T => {
            const ui = new UserChatInfo(T);

            if (adminListDB.by('id', ui.id)) {
                ctx.reply(''
                    + 'Oh~~ I see you are Master.'
                    + '\nSo~ you can use Master Only Command:'
                    + '\n Command me "/un_admin" to exit Master chat level'
                    + '\n Command me "/self_upgrade" to tell me to do a self upgrade'
                );
                return;
            }
        }).catch(E => {
        });

    };

    bot.use((ctx: ContextMessageUpdate, next: () => any) => {
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

    class UserChatInfo {
        id: number;
        type: string;
        username: string;
        first_name: string;
        last_name: string;

        constructor(c) {
            this.id = c.id;
            this.type = c.type;
            this.username = c.username;
            this.first_name = c.first_name;
            this.last_name = c.last_name;
        }

        print() {
            return ""
                + "======================================"
                + "\nid:" + this.id
                + "\ntype:" + this.type
                + "\nusername:" + this.username
                + "\nfirst_name:" + this.first_name
                + "\nlast_name:" + this.last_name
                + "\n"
                + "======================================";
        }
    }

    bot.start((ctx: ContextMessageUpdate) => {
        ctx.reply('Welcome!\nYou can send me "/help" to see the action list.');
        ctx.getChat().then(T => {
            const ui = new UserChatInfo(T);
            console.log("a new /start with:" + ui.print());
        });
    });

    bot.help(helpFunc);
    bot.command("help", helpFunc);
    bot.on('sticker', (ctx) => ctx.reply('👍'));
    bot.hears('hi', (ctx) => ctx.reply('Hey there'));
    bot.command('oldschool', (ctx) => ctx.reply('Hello'));
    bot.command('modern', ({reply}) => reply('Yo'));
    bot.command('hipster', Telegraf.reply('λ'));
    bot.command('getDatetime', (ctx) => ctx.reply(moment().format()));

    let startTime = moment();
    bot.command('liveTime', (ctx) => {
        ctx.reply(''
            + ' \n' + 'alive time: ' + moment().from(startTime)
            + ' \n' + 'last boot time: ' + startTime.format('YYYY-MM-DD HH:mm:ss')
        );
    });

    const adminListDB: Loki.Collection<UserChatInfo> =
        collectionGetter("adminList", {unique: ['id']});

    bot.command(process.env.AdminPasswd || "AdminPassword", (ctx) => {
        ctx.getChat().then(T => {
            const ui = new UserChatInfo(T);
            console.log(ui.print());

            if (adminListDB.by('id', ui.id)) {
                ctx.reply('Em? Master.(⊙_⊙)？'
                    + '\nMaster~~ you can use /un_admin to exit this chat level. ');
                return;
            }
            adminListDB.insert(ui);

            ctx.reply('Hey Master !!!'
                + '\nMaster~~ you can use /un_admin to exit this chat level. ');
        }).catch(E => {
            ctx.reply('error, try again. you need use this on private chat.');
        });
    });
    bot.command('un_admin', (ctx: ContextMessageUpdate) => {
        ctx.getChat().then(T => {
            const ui = new UserChatInfo(T);
            console.log(ui.print());

            adminListDB.chain().find({id: ui.id}).remove();

            ctx.reply('Good-Bye Master~~\n ヾ(￣▽￣)Bye~Bye~');
        }).catch(E => {
            ctx.reply('error, try again. you need use this on private chat.');
        });
    });

    bot.command('self_upgrade', (ctx: ContextMessageUpdate) => {
        ctx.getChat().then(T => {
            if (!adminListDB.by('id', T.id)) {
                ctx.reply("error, i don't know how you are. \n **only** my master can use this.");
                return;
            }

            ctx.reply('Hai! Master~~~(っ●ω●)っ .');
            git_pull().then(T => {
                ctx.reply('Git Pull OK! Master~~~(っ●ω●)っ .' +
                    '\nfollow is the log:\n'
                    + '\n\ncode:' + T.code
                    + '\n\nout:' + T.out
                    + '\n\nerror:' + T.err
                    + '\n\n\nNow~~ I will build it.'
                );
                return tsc_build();
            }).then(T => {
                ctx.reply('Tsc Build OK! Master~~~(っ●ω●)っ .' +
                    '\nfollow is the log:\n'
                    + '\n\ncode:' + T.code
                    + '\n\nout:' + T.out
                    + '\n\nerror:' + T.err
                    + '\n\n\nNow~~ I will restart myself. see you later, Master~~◝(　ﾟ∀ ﾟ )◟ .'
                );
                return restart_service();
            }).then(T => {
                ctx.reply('restart command OK! Master~~~(っ●ω●)っ .' +
                    '\nfollow is the log:\n'
                    + '\n\ncode:' + T.code
                    + '\n\nout:' + T.out
                    + '\n\nerror:' + T.err
                );
            }).catch(E => {
                ctx.reply('Something Wrong! Master~~~(>ω<).' +
                    '\nfollow is the log:\n'
                    + '\n\ncode:' + E.code
                    + '\n\nout:' + E.out
                    + '\n\nerror:' + E.err
                );
            });
        }).catch(E => {
            ctx.reply('error, try again. you need use this on private chat.');
        });
    });

    class WebHookEventItem {
        event: string;
        date: string;
        text: string;
    }

    class WebHookListenerIdItem {
        count: number = 0;
        start: string;
        tick: number = 0;
        ui: UserChatInfo;
        cid: number;
        eventList: WebHookEventItem[] = [];

        constructor() {
        }
    }

    const hookListenerListDB: Loki.Collection<WebHookListenerIdItem> =
        collectionGetter("hookListenerList", {unique: ['cid']});


    bot.command('register', (ctx: ContextMessageUpdate) => {
        ctx.getChat().then(T => {
            const ui = new UserChatInfo(T);
            console.log(ui.print());

            if (!adminListDB.by('id', T.id)) {
                ctx.reply("error, i don't know how you are. \n **only** my master can use this.");
                return;
            }

            let isRegistered = false;
            if (hookListenerListDB.by('cid', ui.id)) {
                ctx.reply('Em? Master.(⊙_⊙)？' + '\nMaster~~ you are registered. ');
                isRegistered = true;
            } else {
                let it = new WebHookListenerIdItem();
                it.start = moment().format();
                it.ui = ui;
                it.cid = ui.id;
                hookListenerListDB.insert(it);
            }

            ctx.reply('' +
                (isRegistered ? 'registered.' : 'register OK.') +
                ' \ncommand "/count" to get event count.' +
                ' \ncommand "/tick" to get tick from you last register.' +
                ' \ncommand "/get" to list all listener. ' +
                ' \ncommand "/resetAllRegisterEvent" to reset all event. ' +
                ' \ncommand "/unregister" to unregister. ' +
                ''
            );
        }).catch(E => {
            ctx.reply('error, try again. you need use this on private chat.');
        });
    });

    bot.command('unregister', (ctx: ContextMessageUpdate) => {
        ctx.getChat().then(T => {
            const ui = new UserChatInfo(T);
            console.log(ui.print());

            hookListenerListDB.chain().find({cid: ui.id}).remove();

            ctx.reply('unregister OK.');
        }).catch(E => {
            ctx.reply('error, try again. you need use this on private chat.');
        });
    });

    bot.command('get', (ctx: ContextMessageUpdate) => {
        ctx.getChat().then(T => {
            if (!adminListDB.by('id', T.id)) {
                ctx.reply("error, i don't know how you are. \n **only** my master can use this.");
                return;
            }
            ctx.reply('' + JSON.stringify(hookListenerListDB.data));
        }).catch(E => {
            ctx.reply('error, try again. you need use this on private chat.');
        });
    });
    bot.command('resetAllRegisterEvent', (ctx: ContextMessageUpdate) => {
        ctx.getChat().then(T => {
            if (!adminListDB.by('id', T.id)) {
                ctx.reply("error, i don't know how you are. \n **only** my master can use this.");
                return;
            }
            hookListenerListDB.data.forEach((v) => {
                v.count = 0;
                v.eventList = [];
                bot.telegram.sendMessage(v.cid, "Muuu~~ " +
                    "\nMaster tell me to reset ALL THE EVENT. " +
                    "\nSo, I reset It !!!"
                );
                hookListenerListDB.update(v);
            });
            ctx.reply('OK~~ Master~~(≧▽≦)');
        }).catch(E => {
            ctx.reply('error, try again. you need use this on private chat.');
        });
    });
    bot.command('count', (ctx: ContextMessageUpdate) => {
        ctx.getChat().then(T => {
            const nd = hookListenerListDB.by('cid', T.id);
            if (!isNil(nd)) {
                ctx.reply('count:' + nd.count);
            } else {
                ctx.reply('not find. \ncommand me "/register" to listen WebHook event.');
            }
        }).catch(E => {
            ctx.reply('error, try again. you need use this on private chat.');
        });
    });
    bot.command('tick', (ctx: ContextMessageUpdate) => {
        ctx.getChat().then(T => {
            const nd = hookListenerListDB.by('cid', T.id);
            if (!isNil(nd)) {
                ctx.reply('tick:' + nd.tick +
                    ' \n' + moment.duration(nd.tick, 'seconds').humanize()
                );
            } else {
                ctx.reply('not find. \ncommand me "/register" to listen WebHook event.');
            }
        }).catch(E => {
            ctx.reply('error, try again. you need use this on private chat.');
        });
    });


    setInterval(() => {
        hookListenerListDB.data.forEach((v) => {
            ++v.tick;
            hookListenerListDB.update(v);
        });
    }, 1000);


    const expressApp = express();
    const bodyParser = require('body-parser');
    expressApp.use(bodyParser.json({limit: '50mb'}));
    expressApp.use(bodyParser.urlencoded({limit: '50mb', extended: true}));
    expressApp.all('/test', (req, res) => {
        if (has(req.body, "event")) {
            hookListenerListDB.data.forEach((v) => {
                ++v.count;

                let ev = new WebHookEventItem();
                ev.event = get(req.body, "event");
                ev.text = get(req.body, "text");
                ev.date = moment().format();
                v.eventList.push(ev);

                hookListenerListDB.update(v);

                bot.telegram.sendMessage(v.cid, "WebHook event Coming!!!!!!!!!!!!!!\n" +
                    get(req.body, "event") + "\n" +
                    get(req.body, "text") + "\n" +
                    ""
                );
            });
        }
        res.send('Hello World!');
    });
    expressApp.listen(process.env.HttpListenPort || 10050, () => {
        console.log('Example app listening on port 10050!')
    });


    bot.startPolling();


}

databaseInitialize = () => {
    console.log("databaseInitialize");
    main().then(() => {
        console.log("main ok");
    }).catch(E => {
        console.error("main error", E);
        process.exit(-1);
    });
};


