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
const wsProvider = new WsProvider('ws://127.0.0.1:9944');
const api = await ApiPromise.create({ provider: wsProvider });

const BOB = "5FLSigC9HGRKVhB9FiEo4Y3koPsNmBmLJbpXg2mp1hXcS59Y";

const keyring = new Keyring({ type: 'sr25519' });
const alice = keyring.addFromUri('//Alice');


// check if the CID or pseudoname exists onchain
async function verifyExistence(req, res) {
    const transfer = api.tx.samaritan.checkExistence(req.name)
    const hash = await transfer.signAndSend(alice, ({ events = [], status }) => {
        if (status.isInBlock) {
            events.forEach(({ event: { data, method, section }, phase }) => {
                if (section.match("samaritan", "i"))
                    res.send({ data: data.toString() });
            });
        }
    });
}

// add new Samaritan to chain
async function createSamaritan(req, res) {
    const mnemonic = mnemonicGenerate();
    const sam = keyring.addFromUri(mnemonic, { name: req.name }, 'sr25519');

    // change address to nice format for DID creation
    keyring.setSS58Format(0);
    const DID = `did:sam:root:${sam.address.toLowerCase()}`;

    const transfer = api.tx.samaritan.createSamaritan(req.name, sam.address.toLowerCase());
    const hash = await transfer.signAndSend(/* sam */ alice, ({ events = [], status }) => {
        if (status.isInBlock) {
            events.forEach(({ event: { data, method, section }, phase }) => {
                if (section.match("samaritan", "i")) {
                    // create DID document and upload it to IPFS then retrieve its CID
                    let did_doc = util.createDIDoc(DID);
                    (async function () {
                        // commit to IPFS
                        await net.uploadToIPFS(did_doc).then(cid => {
                            console.log("The CID is  " + cid);

                            // send the CID onchain to record the creation of the DID document
                            (async function () {
                                const tx = api.tx.samaritan.acknowledgeDoc(req.name, cid);
                                const txh = await tx.signAndSend(/* sam */ alice, ({ events = [], status }) => {
                                    if (status.isInBlock) {
                                        events.forEach(({ event: { data, method, section }, phase }) => {
                                            if (section.match("samaritan", "i"))
                                                res.send({
                                                    data: {
                                                        did: DID,
                                                        doc_cid: cid.toString(),
                                                        keys: mnemonic,
                                                        name: req.name
                                                    }
                                                });
                                        });
                                    }
                                });
                            }())
                        });
                    }())
                }
            });
        }
    });
}

// read DID document
async function readDocument(req, res) {
    // retrieve CID from the chain
    const transfer = api.tx.samaritan.getCid(req.name, "read");
    const hash = await transfer.signAndSend(alice, ({ events = [], status }) => {
        if (status.isInBlock) {
            events.forEach(({ event: { data, method, section }, phase }) => {
                if (section.match("samaritan", "i")) {
                    // let cid = data[1]; // IPFS CID
                    console.log(data);
                    // (async function () {
                    //     // read document from IPFS
                    //     await net.getFromIPFS(cid).then(bytes => {
                    //         res.send({ data: util.Utf8ArrayToStr(bytes) });
                    //     });
                    // }())
                }
            });
        }
    })
}

app.get('', (req, res) => {
    res.render('terminal', { text: 'This is EJS' })
})

// test route
app.post('/test', (req, res) => {
    createSamaritan(req.body, res);
})

// create Samaritan
app.post('/create', (req, res) => {
    createSamaritan(req.body, res);
})

// verify Samaritan existence
app.post('/verify', (req, res) => {
    verifyExistence(req.body, res);
})

// read DID document
app.post('/read', (req, res) => {
    readDocument(req.body, res);
})


// listen on port 3000
app.listen(port, () => console.info(`Listening on port ${port}`));