import {BotBase, ContextMessageUpdateCustom, UserChatInfo} from "./bot-base";
import {Database} from "./database";
import * as Loki from "lokijs";
import {BotAdmin} from "./bot-admin";
import {sleepAwait} from "./sleep";
import {values, max, isNil, isString, assign, trimStart, trimEnd, parseInt, isNumber} from "lodash";
import * as moment from "moment";
import * as phantom from "phantom";
import * as fs from "fs";
import * as Bluebird from "bluebird";
import {PhantomJS} from "phantom";
import * as process from "process";

interface ProxyConfig {
    host: string,
    port: string,
    type: 'socks5' | 'http',
}

interface getPageConfig {
    url: string,
    viewportSize?: { width: number, height: number },
    proxy?: ProxyConfig,
}

const defaultViewportSize = {
    width: 800,
    height: 600,
};

let runningPhantomObject: Map<string, PhantomJS> = new Map<string, PhantomJS>();

async function getPage(config?: getPageConfig) {
    const createProxyParams = [];
    // ["--proxy=127.0.0.1:5000", "--proxy-type=socks5"]
    if (config.proxy) {
        createProxyParams.push(`--proxy=${config.proxy.host}:${config.proxy.port}`);
        switch (config.proxy.type) {
            case "http":
                createProxyParams.push("--proxy-type=http");
                break;
            case "socks5":
                createProxyParams.push("--proxy-type=socks5");
                break;
            default:
                break;
        }
    }
    const instance = await phantom.create(createProxyParams);

    const fileName = moment().format('YYYY_MM_DD_HH_mm_ss_SSS');
    runningPhantomObject.set(fileName, instance);

    const page = await instance.createPage();

    // dont work
    // // https://stackoverflow.com/questions/28571601/how-do-i-set-proxy-in-phantomjs
    // // https://github.com/ariya/phantomjs/blob/master/examples/openurlwithproxy.js
    // await (instance as any).setProxy('127.0.0.1', '5000', 'socks5', null, null);

    await page.on('onResourceRequested', function (requestData) {
        console.info('Requesting', requestData.url);
    });

    await page.property('viewportSize', assign(
        {
            width: 1920,
            height: 1080
        },
        config && config.viewportSize
    ));
    let viewportSize = await page.property('viewportSize');

    const status = await page.open(
        // 'https://mp.weixin.qq.com/s/MyvB-mMa0VF0pl_OxKcwIA'
        config.url
    );
    const content = await page.property('content');
    console.log("status", status);
    // console.log("content", content);


    const getPageHeight = async () => {
        let hList = JSON.parse(await page.evaluate(function () {
            return JSON.stringify({
                "document.body.scrollHeight": document.body.scrollHeight,
                "document.body.offsetHeight": document.body.offsetHeight,
                "document.documentElement.clientHeight": document.documentElement.clientHeight,
                "document.documentElement.scrollHeight": document.documentElement.scrollHeight
            }, undefined, 4);
        }));
        // console.log(hList);
        // console.log(values(hList));
        // console.log(max(values(hList)));
        return max(values(hList));
    };

    let pageScrollH = viewportSize.height / 2;
    const pageScroll = async (i) => {
        let h = await getPageHeight();
        if (pageScrollH * i + viewportSize.height < h) {
            await sleepAwait(1000);
            await page.property('scrollPosition', {
                left: 0,
                top: pageScrollH * i
            });
            await pageScroll(i + 1);
        }
    };
    await pageScroll(0);
    await sleepAwait(2 * 1000);
    await page.property('scrollPosition', {
        left: 0,
        top: 0
    });


    // bPDF not work
    // let bPDF = await page.renderBase64('pdf');
    // let bPNG = await page.renderBase64('png');
    //
    // console.log(isNil(bPDF));
    // console.log(isString(bPDF));
    // console.log(bPDF.length);
    // console.log(isNil(bPNG));
    // console.log(isString(bPNG));
    // console.log(bPNG.length);

    // fileName from config
    // or
    // return fileName to caller
    await page.render(fileName + '.pdf');
    await page.render(fileName + '.png');
    await page.render(fileName + '.jpg');

    await new Bluebird((resolve, reject) => {
        fs.writeFile(fileName + '.html', content, (err) => {
            if (err) {
                reject(err);
            }
            resolve();
        });
    });

    await instance.exit();
    runningPhantomObject.delete(fileName);

    return {
        jpg: fileName + '.jpg',
        png: fileName + '.png',
        pdf: fileName + '.pdf',
        html: fileName + '.html',
    };
}

let ProxyConfigCache: { has: boolean, c?: ProxyConfig } = undefined;

function getProxyConfig(): ProxyConfig | undefined {
    if (ProxyConfigCache) {
        return ProxyConfigCache.c;
    }
    if (process.env.socksPort) {
        ProxyConfigCache = {
            has: true,
            c: {
                host: process.env.socksHost,
                port: process.env.socksPort,
                type: 'socks5',
            },
        };
        return ProxyConfigCache.c;
    } else {
        ProxyConfigCache = {
            has: false,
            c: undefined,
        };
        return undefined;
    }
}

class WebPageUserChatInfo extends UserChatInfo {
    width?: number;
    height?: number;
}

class WebPageSaverConfig {
    key: string;
    value: any;
}

export class BotWebPageSaver {
    public webPageSaverListDB: Loki.Collection<WebPageUserChatInfo> =
        this.db.collectionGetter("webPageSaverList", {unique: ['id']});

    private webPageSaverConfigDB: Loki.Collection<WebPageSaverConfig> =
        this.db.collectionGetter("webPageSaverConfig", {unique: ['key']});

    private get haveProxy() {
        return !!getProxyConfig();
    }

    private get useProxy() {
        return this.getConfig('useProxy');
    }

    private set useProxy(b: boolean) {
        this.setConfig('useProxy', b);
    }

    private get needUpload() {
        return this.getConfig('needUpload');
    }

    private set needUpload(b: boolean) {
        this.setConfig('needUpload', b);
    }

    private getConfig(key: string) {
        let c: WebPageSaverConfig = this.webPageSaverConfigDB.by('key', key);
        return c.value;
    }

    private setConfig(key: string, value: any) {
        let c: WebPageSaverConfig = this.webPageSaverConfigDB.by('key', key);
        if (isNil(c)) {
            c = new WebPageSaverConfig();
            c.key = key;
            c.value = value;
            this.webPageSaverConfigDB.insert(c);
        } else {
            c.value = value;
            this.webPageSaverConfigDB.update(c);
        }
    }

    private checkConfig(key: string, defaultValue: any): WebPageSaverConfig {
        let c: WebPageSaverConfig = this.webPageSaverConfigDB.by('key', key);
        if (isNil(c)) {
            c = new WebPageSaverConfig();
            c.key = key;
            c.value = defaultValue;
            this.webPageSaverConfigDB.insert(c);
        }
        return {
            key: c.key,
            value: c.value,
        };
    }

    private infoString(isStarted = true) {
        let s = ''
            + '\n';

        if (isStarted) {
            s = s
                + '\nyou can send me a web page URL , i will save it.'
                + '\nor use /stop_webSaver to exit Web Page Saver Mode. '
                + '\n';
        }

        s = s
            + '\nBTW : now i ' + (this.needUpload ? 'will' : 'don\'t') + ' upload the result.'
            + '\n   you can use "/webSaver_needUpload" to tell me upload then,'
            + '\n   or use "/webSaver_notUpload" to tell me don\'t upload then.';

        if (this.haveProxy) {
            s = s
                + '\nand i will ' + (this.useProxy ? '' : 'NOT ') + 'use proxy to download page.'
                + '\n   you can use "/webSaver_enableProxy" to tell me enable proxy,'
                + '\n   or use "/webSaver_disableProxy" to tell me disable proxy.'
            ;
        }

        s = s
            + '\n'
            + '\n debug command :'
            + '\n   "/___ForeStopAllRunningWebSaverPhantomObject" .';

        return s;
    }

    constructor(private botBase: BotBase, private db: Database, private botAdmin: BotAdmin) {
        if (!db.databaseInitialize.getValue()) {
            console.error("Must Init & Load Database before construct BotWebEvent");
            throw "Must Init & Load Database before construct BotWebEvent";
        }

        // init all config value default state on here, if not have set it before
        this.checkConfig('needUpload', true);
        this.checkConfig('useProxy', false);

        botBase.botHelpEvent.subscribe(ctx => {
            ctx.getChat().then(T => {
                const ui = new UserChatInfo(T);

                if (this.botAdmin.isAdmin(ui)) {
                    if (this.webPageSaverListDB.by('id', ui.id)) {
                        ctx.reply(''
                            + 'Oh~~ I see you are in Web Page Saver Mode.'
                            + this.infoString()
                        );
                        return;
                    }
                    ctx.reply(''
                        + 'Oh~~ I see you are Master.'
                        + '\nSo~ you can use Master Only Command:'
                        + '\n Command me "/start_webSaver" to start Web Page Saver Mode.'
                        + this.infoString(false)
                    );
                    return;
                }
            }).catch(E => {
                console.error("botHelpEvent Error:", E);
            });
        });

        botBase.bot.command('webSaver_needUpload', (ctx: ContextMessageUpdateCustom) => {
            ctx.getChat().then(T => {
                const ui = new UserChatInfo(T);
                console.log(ui.print());

                if (!botAdmin.isAdmin(ui)) {
                    ctx.reply("error, i don't know how you are. \n **only** my master can use this.");
                    return;
                }

                this.needUpload = true;

                ctx.reply('Hey !!!'
                    + this.infoString()
                );

            }).catch(E => {
                // ctx.reply('error, try again. you need use this on private chat.');
            });
        });
        botBase.bot.command('webSaver_notUpload', (ctx: ContextMessageUpdateCustom) => {
            ctx.getChat().then(T => {
                const ui = new UserChatInfo(T);
                console.log(ui.print());

                if (!botAdmin.isAdmin(ui)) {
                    ctx.reply("error, i don't know how you are. \n **only** my master can use this.");
                    return;
                }

                this.needUpload = false;

                ctx.reply('Hey !!!'
                    + this.infoString()
                );

            }).catch(E => {
                // ctx.reply('error, try again. you need use this on private chat.');
            });
        });
        botBase.bot.command('webSaver_enableProxy', (ctx: ContextMessageUpdateCustom) => {
            ctx.getChat().then(T => {
                const ui = new UserChatInfo(T);
                console.log(ui.print());

                if (!botAdmin.isAdmin(ui)) {
                    ctx.reply("error, i don't know how you are. \n **only** my master can use this.");
                    return;
                }

                this.useProxy = true;

                ctx.reply('Hey !!!'
                    + this.infoString()
                );

            }).catch(E => {
                // ctx.reply('error, try again. you need use this on private chat.');
            });
        });
        botBase.bot.command('webSaver_disableProxy', (ctx: ContextMessageUpdateCustom) => {
            ctx.getChat().then(T => {
                const ui = new UserChatInfo(T);
                console.log(ui.print());

                if (!botAdmin.isAdmin(ui)) {
                    ctx.reply("error, i don't know how you are. \n **only** my master can use this.");
                    return;
                }

                this.useProxy = false;

                ctx.reply('Hey !!!'
                    + this.infoString()
                );

            }).catch(E => {
                // ctx.reply('error, try again. you need use this on private chat.');
            });
        });
        botBase.bot.command('start_webSaver', (ctx: ContextMessageUpdateCustom) => {
            ctx.getChat().then(T => {
                const ui = new UserChatInfo(T);
                console.log(ui.print());

                if (!botAdmin.isAdmin(ui)) {
                    ctx.reply("error, i don't know how you are. \n **only** my master can use this.");
                    return;
                }

                if (this.webPageSaverListDB.by('id', ui.id)) {
                    ctx.reply('Em? (⊙_⊙)？'
                        + '\nyou can use /stop_webSaver to exit Web Page Saver Mode. '
                        + '\nor send me a web page URL , i will save it.'
                    );
                    return;
                }

                this.webPageSaverListDB.insert(ui);

                ctx.reply('Hey !!!'
                    + this.infoString()
                );

            }).catch(E => {
                // ctx.reply('error, try again. you need use this on private chat.');
            });
        });

        botBase.bot.command('___ForeStopAllRunningWebSaverPhantomObject', (ctx: ContextMessageUpdateCustom) => {

            ctx.getChat().then(T => {
                const ui = new UserChatInfo(T);
                console.log(ui.print());

                if (!botAdmin.isAdmin(ui)) {
                    ctx.reply("error, i don't know how you are. \n **only** my master can use this.");
                    return;
                }

                const i = runningPhantomObject.size;
                runningPhantomObject.forEach(R => {
                    R.exit();
                });
                runningPhantomObject.clear();

                ctx.reply('AllRunningPhantomObject Cleaned !!!'
                    + '\nremoved : ' + i
                );

            }).catch(E => {
                // ctx.reply('error, try again. you need use this on private chat.');
            });
        });
        botBase.bot.command('stop_webSaver', (ctx: ContextMessageUpdateCustom) => {
            ctx.getChat().then(T => {
                const ui = new UserChatInfo(T);
                console.log(ui.print());

                this.webPageSaverListDB.chain().find({id: ui.id}).remove();

                ctx.reply('Good-Bye ~~\n ヾ(￣▽￣)Bye~Bye~');
            }).catch(E => {
                // ctx.reply('error, try again. you need use this on private chat.');
            });
        });

        botBase.bot.on('message', (ctx: ContextMessageUpdateCustom, next) => {

            if (isNil(ctx.message.text)) {
                return next();
            }

            // check if is on  listen list
            const cf = this.webPageSaverListDB.by('id', ctx.userChatInfo.id);
            if (!cf) {
                return next();
            }

            let s = trimEnd(trimStart(ctx.message.text, ' '));

            // test is config mode
            if (/^[wh]:[1-9][0-9]*$/i.test(s)) {
                if (/^[w]:/i.test(s)) {
                    cf.width = parseInt(s.substr(2));
                    if (!(isNumber(cf.width) && cf.width > 0)) {
                        cf.width = undefined;
                    }
                }
                if (/^[h]:/i.test(s)) {
                    cf.height = parseInt(s.substr(2));
                    if (!(isNumber(cf.height) && cf.height > 0)) {
                        cf.height = undefined;
                    }
                }
                ctx.reply('now, the viewportSize is configured to:'
                    + '\nwidth:'
                    + (cf.width ? cf.width : defaultViewportSize.width)
                    + '\nheight:'
                    + (cf.height ? cf.height : defaultViewportSize.height)
                    + '',
                    {reply_to_message_id: ctx.message.message_id});
                return;
            }

            const re = /^(http[s]?:\/\/)?[^\s(["<,>]*\.[^\s[",><]*$/i;
            if (!re.test(s)) {
                return next();
            }

            const re2 = /^(http[s]?:\/\/)[^\s(["<,>]*\.[^\s[",><]*$/i;
            if (!re2.test(s)) {
                s = 'http://' + s;
            }

            ctx.reply('loading........', {reply_to_message_id: ctx.message.message_id});

            getPage({
                url: s,
                viewportSize: {
                    width: cf.width || defaultViewportSize.width,
                    height: cf.height || defaultViewportSize.height,
                },
                proxy: (this.haveProxy && this.useProxy ? getProxyConfig() : undefined),
            }).then(T => {
                let R = {
                    d: T,
                    e: [],
                    s: s,
                };
                return ctx.reply(
                    'ok.' + (this.needUpload ? ' file uploading...' : ''),
                    {reply_to_message_id: ctx.message.message_id}
                ).then(() => R);
            }).then(T => {
                if (this.needUpload) {
                    return ctx.replyWithPhoto({
                            source: T.d.jpg,
                        },
                        {reply_to_message_id: ctx.message.message_id},
                    ).then(() => T).catch(E => {
                        console.error(E);
                        T.e.push(E);
                        return T;
                    });
                } else {
                    return T;
                }
            }).then(T => {
                if (this.needUpload) {
                    return ctx.replyWithDocument({
                            source: T.d.png,
                        },
                        {reply_to_message_id: ctx.message.message_id},
                    ).then(() => T).catch(E => {
                        console.error(E);
                        T.e.push(E);
                        return T;
                    });
                } else {
                    return T;
                }
            }).then(T => {
                if (this.needUpload) {
                    return ctx.replyWithDocument({
                            source: T.d.pdf,
                        },
                        {reply_to_message_id: ctx.message.message_id},
                    ).then(() => T).catch(E => {
                        console.error(E);
                        T.e.push(E);
                        return T;
                    });
                } else {
                    return T;
                }
            }).then(T => {
                const sl = T.d.pdf
                    + "\t" + T.d.png
                    + "\t" + T.d.jpg
                    + "\t" + JSON.stringify(T.e)
                    + "\t" + T.s
                    + "\r\n";
                fs.appendFile(
                    'WebPageSaverLog.txt',
                    sl,
                    (err: NodeJS.ErrnoException) => {
                        if (err) {
                            console.log("WebPageSaverLog error of : ", err);
                            console.log("on : " + sl);
                        }
                    }
                );
                if (T.e.length > 0)
                    ctx.reply('something wrong during uploading :\n' + T.e, {reply_to_message_id: ctx.message.message_id});
            }).catch(E => {
                console.error(E);
                ctx.reply('something wrong:\n' + E, {reply_to_message_id: ctx.message.message_id});
            });

        });

    }

    public start() {
        // this.webPageSaverListDB.data.forEach((v) => {
        //     this.botBase.bot.telegram.sendMessage(v.id,
        //         "Hi~ Master~~ I coming~~\n(^u^) Always serving for you Master~~");
        // });
    }


}







