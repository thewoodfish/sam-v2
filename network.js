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

// create a Verfifiable Credential
export function createCredential(cred_str, did, index) {
    const cred = JSON.parse(cred_str);

    return {
        "@context": [
            "https://www.w3.org/2018/credentials/v1",
            "https://www.sam.org/2022/credentials/v1",
            ...cred["context"]
        ],
        "id": `${cred["id"]}/r/vc/${index[1]}/n${index[0]}-i${index[2]}`,
        "type": [
            "VerifiableCredential",
            "SamaritanCredential"
        ],
        "issuer": did,
        "issuanceDate": util.getXMLDate(),
        "credentialSubject": cred["cred"],
    }
}

// sign a credential 
export function signCredential(pair, cred) {
    // sign credential
    let sig = pair.sign(JSON.stringify(cred));
    let ncred = cred;

    let proof = {
        "type": "Ed25519VerificationKey",
        "created": util.getXMLDate(),
        "verificationMethod": `${did}#key-1`, // assertionMethod is `key-1` by default
        "proofPurpose": "assertionMethod",
        "proofValue": util.uint8ToBase64(sig)
    };

    // no need to retrieve assertion method of DID document since we could just cook it up correctly here
    cred["proof"] 
        ? ncred["proof"] = [
            proof,
            ...cred['proof']
        ]
        : ncred["proof"] = [
            proof
        ]

    return ncred;
}
