

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



about the function ```save web page to pdf``` (aka: ```WebPageSaver``` ) :  
   
this function use phantom to work, and the phantom use pre-phantom , the pre-phantom will use a embedded phantom   
so, you dont need to install phantom manual, but the phantom use the system font to render pages  
so, if you need the character work well on pages, you need install font on windows or install ```libfontconfig``` in linux.  
and install whatever font you need to show on the web pages.  
BTW: because of the issue of phantom, this function need project local as temp storage dir to storage those web pages.  


----

if the `phantomjs-prebuilt` hang the install process on windows , you can follow the resolve, those may help you :    
https://stackoverflow.com/a/40992382  
https://phantomjs.org/download.html  

 

or use `npm_config_http_proxy` to set proxy

```
set npm_config_http_proxy=http://127.0.0.1:5000
```
