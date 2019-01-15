import {spawn, SpawnOptions} from "child_process";
import {Promise} from "core-js";


function runChildProcess(exePath: string, args: ReadonlyArray<string> = [], options: SpawnOptions = {}): Promise<{ code: any, out: any, err: any }> {
    return new Promise((resolve, reject) => {
        const childProcess = spawn(exePath, args, options);
        let out: string = "";
        let err: string = "";
        childProcess.stdout.on('data', data => {
            out = data;
            console.log(`stdout: ${data}`);
        });
        childProcess.stderr.on('data', data => {
            err = data;
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

export function restart_service() {
    return runChildProcess('./restartServiceScript/restartService.sh', []);
}


