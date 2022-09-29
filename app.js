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
const wsProvider = new WsProvider('ws://127.0.0.1:9944');
const api = await ApiPromise.create({ provider: wsProvider });

const keyring = new Keyring({ type: 'sr25519' });
const alice = keyring.addFromUri('//Alice');

// check if the CID or S-name exists onchain
async function verifyExistence(req, res) {

    // check if its a CID or a S-name that was sent
    let is_did = true;
    req.name.indexOf("did:sam") == -1 ? is_did = false : is_did = true;

    const transfer = api.tx.samaritan.checkExistence(req.name, is_did)
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

    const transfer = api.tx.samaritan.createSamaritan(req.name, DID);
    const hash = await transfer.signAndSend(/* sam */ alice, ({ events = [], status }) => {
        if (status.isInBlock) {
            events.forEach(({ event: { data, method, section }, phase }) => {
                if (section.match("samaritan", "i")) {
                    // create DID document and upload it to IPFS then retrieve its CID
                    (async function () {
                        await net.createDIDoc(DID, mnemonic).then(did_doc => {
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
                            }());
                        });
                    }());
                }
            });
        }
    });
}

// add credential to Samaritan
async function addCredential(req, res) {
    // first check whether its a link that was submitted
    let credential;
    if (req.is_link) {
        // await net.fetchJSON(req.data); // fetch link from ithe internet and parse the object it contains
        const link = "public/docs/data.txt";
        const file = fs.createWriteStream(link);

        https.get(req.data, response => {
            var stream = response.pipe(file);

            stream.on("finish", function() {
                fs.readFile(link, 'utf8', function (err, data) {
                    if (err) 
                        return console.log(err);
            
                    credential = JSON.parse(JSON.stringify(data));
                    handleCredential(credential, req.did);
                });
            });
        });
    } else 
        handleCredential(JSON.parse(req.data), req.did); // just parse

}

async function handleCredential(credential, did) {
    let cred = JSON.parse(credential);
    let vc_did = cred.about;

    if (vc_did.indexOf("did:sam:root") == -1) {
        // in the credential document, the "about" parameter can be a Samaritans name, in that case we need to retrieve its DID from the network
        const transfer = api.tx.samaritan.retrieveDid(cred.about);
        const hash = await transfer.signAndSend(alice, ({ events = [], status }) => {
            if (status.isInBlock) {
                events.forEach(({ event: { data, method, section }, phase }) => {
                    if (section.match("samaritan", "i")) {
                        vc_did = data.toHuman()[1];
                        constructCredential(did, cred, vc_did);
                    }
                });
            }
        });
    } else 
        constructCredential(did, cred, vc_did);

}

async function constructCredential(did, cred, subject) {
    // first get the nonce to use for the credential for `did`
    const transfer = api.tx.samaritan.getVcNonce(did);
        const hash = await transfer.signAndSend(alice, ({ events = [], status }) => {
            if (status.isInBlock) {
                events.forEach(({ event: { data, method, section }, phase }) => {
                    if (section.match("samaritan", "i")) {
                        let nonce = data.toHuman()[1];

                        // construct credential
                        let vc = net.constructVC(did, cred, subject, nonce);
                        console.log(vc);
                    }
                });
            }
        });
}

app.get('', (req, res) => {
    res.render('terminal', { text: 'This is EJS' })
})

// test route
app.post('/test', (req, res) => {
    addCredential(req.body, res);
})

// create Samaritan
app.post('/create', (req, res) => {
    createSamaritan(req.body, res);
})

// verify Samaritan existence
app.post('/verify', (req, res) => {
    verifyExistence(req.body, res);
})

// verify Samaritan existence
app.post('/add-credential', (req, res) => {
    addCredential(req.body, res);
})


// listen on port 3000
app.listen(port, () => console.info(`Listening on port ${port}`));