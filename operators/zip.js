
import {derived} from "../store.js";

/**
 * zip
 *
 * @param {Object} obj
 * @returns {{subscribe, pipe}}
 */
export function zip(obj) {
    if(Array.isArray(obj)) {
        return derived(obj, a => a);
    } else if(typeof obj === 'object') {
        let keys = Object.keys(obj);
        return derived(
            keys.map(key => obj[key]),
            a => keys.reduce((o,key) => {
                o[key] = a[key];
                return o;
            },{})
        );
    }
}
