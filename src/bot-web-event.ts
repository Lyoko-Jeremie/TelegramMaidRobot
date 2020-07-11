import {BotBase, ContextMessageUpdateCustom, UserChatInfo} from "./bot-base";
import {Database} from "./database";
import * as Loki from "lokijs";
import * as moment from "moment";
import {isNil, get, has} from "lodash";
import {BotAdmin} from "./bot-admin";
import * as express from "express";
// import express from "express";
import * as bodyParser from "body-parser";

export class WebHookEventItem {
    event: string;
    date: string;
    text: string;
}

export class WebHookListenerIdItem {
    count: number = 0;
    start: string;
    tick: number = 0;
    ui: UserChatInfo;
    cid: number;
    eventList: WebHookEventItem[] = [];

    constructor() {
    }
}

export class BotWebEvent {
    public hookListenerListDB: Loki.Collection<WebHookListenerIdItem> =
        this.db.collectionGetter("hookListenerList", {unique: ['cid']});

    private expressApp = express();

    constructor(private botBase: BotBase, private db: Database, private botAdmin: BotAdmin) {
        if (!db.databaseInitialize.getValue()) {
            console.error("Must Init & Load Database before construct BotWebEvent");
            throw "Must Init & Load Database before construct BotWebEvent";
        }


        botBase.bot.command('register', (ctx: ContextMessageUpdateCustom) => {
            ctx.getChat().then(T => {
                const ui = new UserChatInfo(T);
                console.log(ui.print());

                if (!botAdmin.adminListDB.by('id', T.id)) {
                    ctx.reply("error, i don't know how you are. \n **only** my master can use this.");
                    return;
                }

                let isRegistered = false;
                if (this.hookListenerListDB.by('cid', ui.id)) {
                    ctx.reply('Em? Master.(⊙_⊙)？' + '\nMaster~~ you are registered. ');
                    isRegistered = true;
                } else {
                    let it = new WebHookListenerIdItem();
                    it.start = moment().format();
                    it.ui = ui;
                    it.cid = ui.id;
                    this.hookListenerListDB.insert(it);
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

        botBase.bot.command('unregister', (ctx: ContextMessageUpdateCustom) => {
            ctx.getChat().then(T => {
                const ui = new UserChatInfo(T);
                console.log(ui.print());

                this.hookListenerListDB.chain().find({cid: ui.id}).remove();

                ctx.reply('unregister OK.');
            }).catch(E => {
                ctx.reply('error, try again. you need use this on private chat.');
            });
        });

        botBase.bot.command('get', (ctx: ContextMessageUpdateCustom) => {
            ctx.getChat().then(T => {
                if (!botAdmin.adminListDB.by('id', T.id)) {
                    ctx.reply("error, i don't know how you are. \n **only** my master can use this.");
                    return;
                }
                ctx.reply('' + JSON.stringify(this.hookListenerListDB.data));
            }).catch(E => {
                ctx.reply('error, try again. you need use this on private chat.');
            });
        });
        botBase.bot.command('resetAllRegisterEvent', (ctx: ContextMessageUpdateCustom) => {
            ctx.getChat().then(T => {
                if (!botAdmin.adminListDB.by('id', T.id)) {
                    ctx.reply("error, i don't know how you are. \n **only** my master can use this.");
                    return;
                }
                this.hookListenerListDB.data.forEach((v) => {
                    v.count = 0;
                    v.eventList = [];
                    botBase.bot.telegram.sendMessage(v.cid, "Muuu~~ " +
                        "\nMaster tell me to reset ALL THE EVENT. " +
                        "\nSo, I reset It !!!"
                    );
                    this.hookListenerListDB.update(v);
                });
                ctx.reply('OK~~ Master~~(≧▽≦)');
            }).catch(E => {
                ctx.reply('error, try again. you need use this on private chat.');
            });
        });
        botBase.bot.command('count', (ctx: ContextMessageUpdateCustom) => {
            ctx.getChat().then(T => {
                const nd = this.hookListenerListDB.by('cid', T.id);
                if (!isNil(nd)) {
                    ctx.reply('count:' + nd.count);
                } else {
                    ctx.reply('not find. \ncommand me "/register" to listen WebHook event.');
                }
            }).catch(E => {
                ctx.reply('error, try again. you need use this on private chat.');
            });
        });
        botBase.bot.command('tick', (ctx: ContextMessageUpdateCustom) => {
            ctx.getChat().then(T => {
                const nd = this.hookListenerListDB.by('cid', T.id);
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


        this.expressApp.use(bodyParser.json({limit: '50mb'}));
        this.expressApp.use(bodyParser.urlencoded({limit: '50mb', extended: true}));
        this.expressApp.all('/test', (req, res) => {
            if (has(req.body, "event")) {
                this.hookListenerListDB.data.forEach((v) => {
                    ++v.count;

                    let ev = new WebHookEventItem();
                    ev.event = get(req.body, "event");
                    ev.text = get(req.body, "text");
                    ev.date = moment().format();
                    v.eventList.push(ev);

                    this.hookListenerListDB.update(v);

                    botBase.bot.telegram.sendMessage(v.cid, "WebHook event Coming!!!!!!!!!!!!!!\n" +
                        get(req.body, "event") + "\n" +
                        get(req.body, "text") + "\n" +
                        ""
                    );
                });
            }
            res.send('Hello World!');
        });


    }

    public start() {
        this.expressApp.listen(process.env.HttpListenPort || 10050, () => {
            console.log('Example app listening on port 10050!')
        });

        setInterval(() => {
            this.hookListenerListDB.data.forEach((v) => {
                ++v.tick;
                this.hookListenerListDB.update(v);
            });
        }, 1000);
    }
}
