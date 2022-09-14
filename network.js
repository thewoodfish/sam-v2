import { createRequire } from "module";
const require = createRequire(import.meta.url);

import path from 'path';
import {fileURLToPath} from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import * as IPFS from "ipfs-core";
const toBuffer = require('it-to-buffer');

const ipfs = await IPFS.create();

export async function uploadToIPFS(path) {
    const { cid } = await ipfs.add(path);

    console.info(cid);

    if (cid) 
        console.log(cid.toV0().toString());
    else 
        throw new Error('IPFS add failed, please try again.');

    return cid;
}

export async function getFromIPFS(cid) {
    const bufferedContents = await toBuffer(ipfs.cat(cid)); // returns a Buffer

    return bufferedContents;
}