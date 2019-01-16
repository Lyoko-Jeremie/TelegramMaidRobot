import * as Loki from "lokijs";
import {BehaviorSubject} from "rxjs";

const LokiFsStructuredAdapter = require('lokijs/src/loki-fs-structured-adapter.js');
const lokiFsStructuredAdapter = new LokiFsStructuredAdapter();

export class Database {
    public collectionGetter = <E extends object = any>(name: string, options?: Partial<CollectionOptions<E>>) => {
        let dbc: Loki.Collection<E> = this.DB.getCollection(name);
        if (dbc === null) {
            dbc = this.DB.addCollection(name, options);
        }
        return dbc;
    };
    public databaseInitialize: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
    // public adminListDB: Loki.Collection<UserChatInfo> = undefined;
    // public hookListenerListDB: Loki.Collection<WebHookListenerIdItem> = undefined;
    public DB: Loki = undefined;

    constructor() {

        this.DB = new Loki("db/DB.json", {
            adapter: lokiFsStructuredAdapter,
            autoload: true,
            autoloadCallback: () => {
                this.databaseInitialize.next(true);
            },
            autosave: true,
            autosaveInterval: 4000
        });

        this.databaseInitialize.subscribe(v => {
            if (v) {
                // this.hookListenerListDB = this.collectionGetter("hookListenerList", {unique: ['cid']});
                // this.adminListDB = this.collectionGetter("adminList", {unique: ['id']});
            }
        });

    }
}
