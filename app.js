
// config 
import { createRequire } from "module";
const require = createRequire(import.meta.url);
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const express = require('express');
const app = express();
const port = 3000;
const fs = require('fs');
const https = require("https");

app.use(express.json());

// static files
app.use(express.static('public'));
app.use('/css', express.static(__dirname + 'public/css'));
app.use('/js', express.static(__dirname + 'public/js'));
app.use('/img', express.static(__dirname + 'public/img'));

// set views
app.set('views', './views');
app.set('view engine', 'ejs')

// utility functions
const util = require("./utility.cjs");
import * as net from "./network.js";

// substrate client imports
import { ApiPromise, WsProvider } from '@polkadot/api';
import { mnemonicGenerate } from '@polkadot/util-crypto';
const { Keyring } = require('@polkadot/keyring');


// global
// const wsProvider = new WsProvider('ws://127.0.0.1:9944');
// const api = await ApiPromise.create({ provider: wsProvider });

const keyring = new Keyring({ type: 'sr25519' });
const alice = keyring.addFromUri('//Alice');

// add new Samaritan to chain
async function createSamaritan(req, res) {
    const signedBlock = await api.rpc.chain.getBlock();

    // get the api and events at a specific block
    const apiAt = await api.at(signedBlock.block.header.hash);
    const allRecords = await apiAt.query.system.events();

    // generate Keys for Samaritan
    const mnemonic = mnemonicGenerate();
    const sam = keyring.addFromUri(mnemonic, { name: req.name }, 'sr25519');
    
    keyring.setSS58Format(0);
    const DID = net.createRootDID(sam.address);

    // sign communication nonce
    const nonce = net.signMsg(sam, "Sacha is a great buddy!");

    // add the nonce to the Keyring instance metadata
    sam.meta.nonce = nonce;
    sam.meta.hash_key = net.signMsg(sam, "hash on the mountain");
    
    // record event onchain
    const transfer = api.tx.samaritan.createSamaritan(req.name, DID);
    const hash = await transfer.signAndSend(/*sam */alice, ({ events = [], status }) => {
        if (status.isInBlock) {
            events.forEach(({ event: { data, method, section }, phase }) => {
                // check for errors
                if (section.match("system", "i") && data.toString().indexOf("error") != -1) {
                    return res.send({
                        data: { msg: "could not create Samaritan" }, error: true
                    })
                } 

                // after Samaritan has been recorded, then `really create it` by birthing its DID document
                if (section.match("samaritan", "i")) {
                    createDIDDocument(res, DID, mnemonic, sam);
                } 
            });
        }
    });
}

// create the DID document
async function createDIDDocument(res, did, mnemonic, sam) {
    let doc = net.createDIDDoc(did, mnemonic);

    // create hash link
    let hash = util.encryptData(util.Utf8ArrayToStr(sam.meta.hash_key), doc);

    // upload to d-Storage
    (async function () {
        // commit to IPFS
        await net.uploadToStorage(hash).then(ipfs => {
            let cid = ipfs.cid;
            
            // send the CID onchain to record the creation of the DID document
            (async function () {
                const tx = api.tx.samaritan.acknowledgeDoc(did, cid, hash);
                const txh = await tx.signAndSend(/* sam */ alice, ({ events = [], status }) => {
                    if (status.isInBlock) {
                        events.forEach(({ event: { data, method, section }, phase }) => {
                            if (section.match("system", "i") && data.toString().indexOf("error") != -1) {
                                return res.send({
                                    data: { msg: "could not create Samaritan" }, error: true
                                })
                            } 
            
                            if (section.match("samaritan", "i")) {
                                return res.send({
                                    data: {
                                        seed: mnemonic,
                                        did: did,
                                        nonce:  util.Utf8ArrayToStr(sam.meta.nonce),
                                    }, 
                                    error: false
                                })
                            } 
                        });
                    }
                });
            }())
        })
    })()
}

app.get('', (req, res) => {
    res.render('terminal', { text: 'This is EJS' })
})

// test route
app.get('/test', (req, res) => {
    const mnemonic = mnemonicGenerate();
    const sam = keyring.addFromUri(mnemonic, { name: req.name }, 'sr25519');

    console.log(sam.meta);
})

// create Samaritan
app.post('/new', (req, res) => {
    createSamaritan(req.body, res);
})


// listen on port 3000
app.listen(port, () => console.info(`Listening on port ${port}`));