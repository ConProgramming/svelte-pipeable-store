import {noop, is_promise, has_cancel} from "../internal.js";

import {readable} from '../store.js';

/**
 *  wait
 *
 *  Wait for an async function (Promise or promise-like) to complete before updating store
 *  Options are available to specify behaviour when many requests occur at once
 *  In all cases the destination store will not be passed results out of sequence
 *   and will eventually update to the final (correct) state
 *
 *  @params {Function} iterator Maps the src store to a Promise
 *  @params {Object} [options={}] Options
 *  @params {boolean} [options.queue=false] If true run iterator in series
 *   Even with queue as false the operator will not update when there is already a newer item
 *  @params {boolean} [options.exhaust=false] If true when a promise is pending, subsequent calls are ignored
 *   Trailing call will be performed at the end to ensure piped store is eventually up-to-date
 *  @params {boolean} [options.discard=false] If true, when the src subscription fires, pending Promises are ignored
 *  @params {Function} [options.error] Error handing function
 *   Note if you want errors to return a value to the destination store, you should add a catch block to your Promise.
 *  @returns {{subscribe, pipe}}
*/

export function wait(iterator, options = {}) {

    let {
        queue = false,
        exhaust = false,
        discard = false,
        error = noop,
    } = options;

    return ({subscribe}) => readable(undefined, set => {

        let list, current, pending;
        flush();

        function flush() {
            list = [];
            current = -1;
            pending = 0;
        }

        function run(index) {

            // If other tasks are pending, don't run if using any option (exhaust, queue)
            if(pending && (exhaust || queue)) {
                return;
            }
            if(pending && discard) {
                // cancel pending promise
                let last = list[index-1];
                last.cancel = true;
                if(has_cancel(last.promise)) {
                    last.promise.cancel();
                }
            }
            let item = list[index];
            let {value} = item;
            let promise = iterator(value);
            item.promise = is_promise(promise) ? promise : Promise.resolve(promise);

            pending++;

            item.promise.then(res => {
                // if newest result, set dest store
                if(current < index && !item.cancel) {
                    set(res);
                    current = index;
                }
                pending--;
                if(pending === 0 && current === list.length - 1) {
                    return flush();
                }
                if(queue) {
                    return run(index+1);
                }
                if(exhaust) {
                    return run(list.length-1);
                }
            }, err => {
                if(!item.cancel) {
                    error(err);
                }
            });
        }

        return subscribe(value => {
            let index = list.length;
            list.push({value});
            run(index);
        });

    });
}
