// polyfill
import 'core-js';

import {BotBase} from "./bot-base";
import {Database} from "./database";
import {BotAdmin} from "./bot-admin";
import {BotWebEvent} from "./bot-web-event";

import "rxjs/add/operator/filter";

import moment = require("moment");

// set local
moment.locale('zh-CN');


const botBase = new BotBase();
const database = new Database();
let booted = false;

database.databaseInitialize.asObservable().filter(T => {
    return T;
}).subscribe(T => {
    if (!booted) {
        booted = true;
        console.log("databaseInitialized");

        const botAdmin = new BotAdmin(botBase, database);
        const botWebEvent = new BotWebEvent(botBase, database, botAdmin);

        botBase.start();
        botAdmin.start();
        botWebEvent.start();

        console.log("start ok");
    }
});

