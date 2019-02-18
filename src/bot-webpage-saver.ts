import {BotBase, ContextMessageUpdateCustom, UserChatInfo} from "./bot-base";
import {Database} from "./database";
import * as Loki from "lokijs";
import {BotAdmin} from "./bot-admin";
import {sleepAwait} from "./sleep";
import {values, max, isNil, isString, assign, trimStart, trimEnd, parseInt, isNumber} from "lodash";
import * as moment from "moment";
import * as phantom from "phantom";

type getPageConfig = {
    url: string,
    viewportSize?: { width: number, height: number },

};

const defaultViewportSize = {
    width: 800,
    height: 600,
};

async function getPage(config?: getPageConfig) {
    const instance = await phantom.create();
    const page = await instance.createPage();
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
        let h = await  getPageHeight();
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
    let bPDF = await page.renderBase64('pdf');
    let bPNG = await page.renderBase64('png');

    console.log(isNil(bPDF));
    console.log(isString(bPDF));
    console.log(bPDF.length);
    console.log(isNil(bPNG));
    console.log(isString(bPNG));
    console.log(bPNG.length);

    // TODO fileName from config
    // TODO or
    // TODO return fileName to caller
    const fileName = moment().format('YYYY_MM_DD_HH_mm_ss_SSS');
    await page.render(fileName + '.pdf');
    await page.render(fileName + '.png');

    await instance.exit();

    return {
        png: fileName + '.png',
        pdf: fileName + '.pdf',
    };
}

class WebPageUserChatInfo extends UserChatInfo {
    width?: number;
    height?: number;
}

export class BotWebpageSaver {
    public webPageSaverListDB: Loki.Collection<WebPageUserChatInfo> =
        this.db.collectionGetter("webPageSaverList", {unique: ['id']});

    constructor(private botBase: BotBase, private db: Database, private botAdmin: BotAdmin) {
        if (!db.databaseInitialize.getValue()) {
            console.error("Must Init & Load Database before construct BotWebEvent");
            throw "Must Init & Load Database before construct BotWebEvent";
        }

        botBase.botHelpEvent.subscribe(ctx => {
            ctx.getChat().then(T => {
                const ui = new UserChatInfo(T);

                if (this.botAdmin.isAdmin(ui)) {
                    if (this.webPageSaverListDB.by('id', ui.id)) {
                        ctx.reply(''
                            + 'Oh~~ I see you are in Web Page Saver Mode.'
                            + '\nSo~ you can send me a web page URL , i will save it.'
                            + '\nor Command me "/stop_webSaver" to stop Web Page Saver Mode.'
                        );
                        return;
                    }
                    ctx.reply(''
                        + 'Oh~~ I see you are Master.'
                        + '\nSo~ you can use Master Only Command:'
                        + '\n Command me "/start_webSaver" to start Web Page Saver Mode.'
                    );
                    return;
                }
            }).catch(E => {
                console.error("botHelpEvent Error:", E);
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
                    + '\nyou can send me a web page URL , i will save it.'
                    + '\nor use /stop_webSaver to exit Web Page Saver Mode. '
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
            }).then(T => {
                return ctx.reply(
                    'ok. file uploading...',
                    {reply_to_message_id: ctx.message.message_id}
                ).then(() => T);
            }).then(T => {
                return ctx.replyWithPhoto({
                        source: T.png,
                    },
                    {reply_to_message_id: ctx.message.message_id},
                ).then(() => T);
            }).then(T => {
                return this.botBase.bot.telegram.sendDocument(
                    ctx.userChatInfo.id,
                    T.pdf,
                    {reply_to_message_id: ctx.message.message_id},
                ).then(() => T);
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







