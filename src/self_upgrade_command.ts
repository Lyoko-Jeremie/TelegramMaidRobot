import {spawn, SpawnOptions} from "child_process";
import {Promise} from "core-js";
import {assign} from "lodash";


function runChildProcess(exePath: string, args: ReadonlyArray<string> = [], options: SpawnOptions = {}): Promise<{ code: any, out: any, err: any }> {
    return new Promise((resolve, reject) => {
        const childProcess = spawn(exePath, args, assign(options, {}));
        let out: string = "";
        let err: string = "";
        childProcess.stdout.on('data', data => {
            out += data;
            console.log(`stdout: ${data}`);
        });
        childProcess.stderr.on('data', data => {
            err += data;
            console.log(`stderr: ${data}`);
        });
        childProcess.on('close', code => {
            if (code == 0) {
                resolve({
                    code: code,
                    out: out,
                    err: err,
                });
            } else {
                reject({
                    code: code,
                    out: out,
                    err: err,
                });
            }
            console.log(`child process exited with code ${code}`);
        });
    });
}

export function git_pull() {
    return runChildProcess('git', ['pull']);
}

export function tsc_build() {
    return runChildProcess('tsc', []);
}

/**
 *
 * if use systemctl , add a service file like follow
 *
 * place it in service path , like:   /etc/systemd/system/BotMaid.service
 *
 [Unit]
 Description=Telegram Maid Bot Service
 Requires=network.target
 After=network.target

 [Service]
 Type=simple
 User=jeremie
 Environment=BOT_TOKEN=<Key>
 Environment=HttpListenPort=10050
 Environment=AdminPasswd=<Password>
 WorkingDirectory=<the git project dir, example:/home/jeremie/TelegramMaidRobot>
 Restart=always
 ExecStart=/bin/yarn run start -o --watch


 [Install]
 WantedBy=multi-user.target

 *
 *
 * and create a .sh file for reboot this service on   project_dir/restartServiceScript/restartService.sh
 *
 * content is follow

 sudo systemctl restart BotMaid

 *
 *
 * and allow this user example"jeremie" use the restart command example"systemctl restart BotMaid" command without sudo passwd
 *
 *
 * https://serverfault.com/questions/772778/allowing-a-non-root-user-to-restart-a-service
 *
 * simply add follow on sudo file use visudo
 *
 *

 Cmnd_Alias      BOTMAID_CMDS = /bin/systemctl restart BotMaid

 jeremie ALL=(ALL) NOPASSWD: BOTMAID_CMDS

 *
 *
 *
 *
 *
 */
export function restart_service() {
    return runChildProcess('./restartServiceScript/restartService.sh', []);
}

export function asyncSleep(ms: number) {
    return new Promise(resolve => {
        setTimeout(() => {
            resolve();
        }, ms);
    });
}
