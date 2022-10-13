import { createRequire } from "module";
const require = createRequire(import.meta.url);

import path from 'path';
import {fileURLToPath} from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import * as IPFS from "ipfs-core";
import { json } from "express";
const toBuffer = require('it-to-buffer');

const { Keyring } = require('@polkadot/keyring');
import { stringToU8a, u8aToHex } from '@polkadot/util';

const fs = require("fs");
const https = require("https");

const keyring = new Keyring({ type: 'sr25519' });

// imports 
const util = require("./utility.cjs");
import * as storg from "./storage.js";
import { generateKey } from "crypto";

const ipfs = await IPFS.create();

// using alice here temporarily
const alice = keyring.addFromUri('//Alice');

export function createRootDID(address) {
    return `did:sam:root:${address}`;
}

export function signMsg(pair, str) {
    const message = stringToU8a(str);
    return pair.sign(message);
}

// initialize the DID document
export function createDIDDoc(did, mnemonic) {
    let json = {
        "@context": [
            "https://www.w3.org/ns/did/v1",
            "https://www.sam.org/did/v1"
        ],
        "id": did,
        "controller": [did],
        "authentication": [
            generateVM(did, mnemonic, "auth")
        ],
        "assertionMethod": [
            generateVM(did, mnemonic, "assert")
        ]
    };

    return JSON.stringify(json);
}

function generateVM(did, mnemonic, str) {
    // generate a hard derivation from the mnemonic
    const keyring = new Keyring();
    let nkey = keyring.createFromUri(`${mnemonic}//${str}`);

    let hash = {
        "auth": "#key-0",
        "assert": "#key-1"
    };

    let key = hash[str];

    return {
        "id": did + key,
        "type": "Ed25519VerificationKey",
        "controller": did,
        "SS58format": 0,
        "mnemonicMultibase": keyring.encodeAddress(nkey.address, 0)
    }
}

async function uploadToIPFS(path) {
    const { cid } = await ipfs.add(path);

    if (cid) 
        console.log(cid.toV0().toString());
    else 
        return { cid: "error", size: 0 };

    const fileStat = await ipfs.files.stat(cid);

    return { cid: cid, size: fileStat.cumulativeSize };
}

export async function uploadToStorage(path) {
    // upload to IPFS
    const { cid, size } = await uploadToIPFS(path);

    // pin on dStorage
    // await storg.placeStorageOrder(cid, size);

    return { cid: cid, size: size };
}

export async function getFromIPFS(cid) {
    const bufferedContents = await toBuffer(ipfs.cat(cid)); // returns a Buffer

    return bufferedContents;
}