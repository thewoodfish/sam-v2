import { createRequire } from "module";
const require = createRequire(import.meta.url);

import path from 'path';
import {fileURLToPath} from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import * as IPFS from "ipfs-core";
const toBuffer = require('it-to-buffer');

// import { Ed25519VerificationKey2020 } from '@digitalbazaar/ed25519-verification-key-2020';
const { Keyring } = require('@polkadot/keyring');


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

// async function _generateVM(did, mnemonic) {
//     mnemonic = Uint8Array.from(mnemonic.split("").map(x => x.charCodeAt()));

//     const edKeyPair = await Ed25519VerificationKey2020.generate({ id: did /* seed: mnem */ });
//     const data = await edKeyPair.export({ publicKey: true });

//     return data;
// }

function generateVM(did, hash, mnemnic, suffix) {
    // generate a hard derivation from the mnemonic
    const keyring = new Keyring();

    let nkey = keyring.createFromUri(`${mnemnic}//${suffix}`);
    return {
        "id": did + hash,
        "type": "Ed25519VerificationKey",
        "controller": did,
        "SS58format": 0,
        "publicKeyMultibase": keyring.encodeAddress(nkey.publicKey, 0)
    }
}

export async function createDIDoc(did, mnemonic) {
    let vm = await generateVM(did, `#key-0`, mnemonic, "assertion");

    let json = {
        "@context": [
            "https://www.w3.org/ns/did/v1",
        ],
        "id": did,
        "assertionMethod": [
            vm
        ]
    };

    return JSON.stringify(json);
}

