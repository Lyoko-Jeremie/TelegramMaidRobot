/**
 * Created by Jeremie on 2017/3/22.
 */
import * as _ from 'lodash';
import {TimerObservable} from 'rxjs/observable/TimerObservable';
// import {ChangeDetectorRef, NgZone} from '@angular/core';

/**
 * this func to avoid angular2 2 check error on developing mode
 * let some case 2 check error task run in lambda func and let it wait undefined millisecond
 *      so then will work in next check tick that 2 check will not warning me
 *      and happy user happy angular and happy developer
 * @param func
 * @param millisecondsToWait default==undefined
 */
export function sleepToRun(func: Function, millisecondsToWait?: number) {
  sleepAwait(millisecondsToWait || 0).then(() => {
    func();
  });
  return;
}

export function sleepAwait(timeout: number) {
  // return (new TimerObservable(timeout || 0)).toPromise();
  return new Promise((resolve, reject) => {
    let s = TimerObservable.create(timeout || 0).subscribe(
      T => {
        resolve();
        s.unsubscribe();
      },
      E => {
        reject();
        s.unsubscribe();
      }
    );
  });
}

export class SleepCaller {
  callback: Function | undefined;
  millisecondsToWait: number | undefined;

  constructor(callback?: Function, millisecondsToWait?: number) {
    this.callback = callback;
    this.millisecondsToWait = millisecondsToWait;
  }

  call(...Arg) {
    let args = arguments;
    _.isFunction(this.callback) && sleepToRun(
      () => {
        this.callback && this.callback();
      },
      this.millisecondsToWait,
    );
  }
}
