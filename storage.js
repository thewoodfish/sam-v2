import { createRequire } from "module";
const require = createRequire(import.meta.url);

import path from 'path';
import {fileURLToPath} from 'url';

import * as IPFS from "ipfs-core";

const toBuffer = require('it-to-buffer');
const ipfs = await IPFS.create();


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Keyring } = require('@polkadot/keyring');
import { stringToU8a, u8aToHex } from '@polkadot/util';

const fs = require("fs");
const https = require("https");
import { create, globSource } from 'ipfs-http-client';
const got = require('got');

const keyring = new Keyring({ type: 'sr25519' });


// imports 
const util = require("./utility.cjs");

// crust storage network specific
function crust_GetAuthHeader(pair) {
    const sig = pair.sign(pair.address);
    const sigHex = '0x' + Buffer.from(sig).toString('hex');

    return Buffer.from(`sub-${pair.address}:${sigHex}`).toString('base64');
}

// upload to IPFS gateway
async function uploadToGateway(path, ipfsGateway, authHeader) {
    const ipfs = create({
        url: ipfsGateway + '/api/v0',
        headers: {
            authorization: 'Basic ' + authHeader
        }
    });

    const { cid } = await ipfs.add(path);

    if (cid) {
        return { cid, error: false };
    } else {
        return { cid, error: true };
    }
}

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

// pin IPFS file on a pining service
async function pinIPFSFile(ipfsPinningService, cid, authHeader, name) {
    const { body } = await got.post(
        ipfsPinningService + '/pins',
        {
            headers: {
                authorization: 'Bearer ' + authHeader
            },
            json: {
                cid: cid.toV0().toString(),
                name
            }
        }
    );
}

// crust storage network specific
export async function uploadToCrustNetwork(path, pair, name) {
    let header = crust_GetAuthHeader(pair);

    let data = uploadToGateway(path, 'https://crustwebsites.net', header);

    if (!data.error) {
        // pin on pinning service
        let body = await pinIPFSFile('https://pin.crustcode.com/psa', (await data).cid, header, name);

        if (body) {
            console.log(body);
            const rid = JSON.parse(body)['requestId'];
            console.log(body, rid);

            while (true) {
                const {body: pinningStat} = await got(
                    ipfsPinningService + `/pins/${rid}`,
                    {
                        headers: {
                            authorization: 'Bearer ' + authHeader
                        }
                    }
                );

                if (pinningStat.status == "pinned") {
                    return {
                        cid: pinningStat.pin.cid,
                        error: false
                    }
                }

                await timeout(1000);
            }
        } else {
            console.log(body);
            return {
                cid: "",
                error: true
            }
        }
    } else {
        return {
            cid: "",
            error: true
        }
    }

}