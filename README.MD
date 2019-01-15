

set env before run:

```
BOT_TOKEN=<YouBotTokenKey(must)>
HttpListenPort=<NoticeServerWebHookListenPort(optional,default:10050)>
AdminPasswd=<AdminPassword(optional,default:/AdminPassword)>
socksPort=<Sock5ProxyPort(optional,if not config socksPort, not use proxy)>
socksHost=<Sock5Proxyhost(optional,if not config socksPort, this will not work)>
```

how to run

1 run ```yarn``` to install dependence, 
2 run ```yarn run build``` to build,
3 run ```yarn run start``` to run,



data storage

all database will save on ```db``` dir.



