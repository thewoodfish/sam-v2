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

const key = "1232657e8yuifhsfs78fv93";

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
                    handleCredential(res, credential, req.did, req.keys);
                });
            });
        });
    } else 
        handleCredential(res, req.data, req.did, req.keys); // just parse

}

async function handleCredential(res, credential, did,  keys) {
    let cred = JSON.parse(credential);
    let vc_did = cred.subject;

    if (vc_did.indexOf("did:sam:root") == -1) {
        // in the credential document, the "subject" parameter can be a Samaritans name, in that case we need to retrieve its DID from the network
        const transfer = api.tx.samaritan.retrieveDid(cred.subject);
        const hash = await transfer.signAndSend(alice, ({ events = [], status }) => {
            if (status.isInBlock) {
                events.forEach(({ event: { data, method, section }, phase }) => {
                    if (section.match("samaritan", "i")) {
                        vc_did = data.toHuman()[1];
                        constructCredential(res, did, cred, vc_did, keys);
                    }
                });
            }
        });
    } else 
        constructCredential(res, did, cred, vc_did, keys);

}

async function constructCredential(res, did, cred, subject, keys) {
    // get scope of credential
    let pub = true;
    if (cred.scope) pub = cred.scope == "private" ? false : true;

    // first get the nonce to use for the credential for `did`
    const transfer = api.tx.samaritan.getVcNonce();
    const hash = await transfer.signAndSend(alice, ({ events = [], status }) => {
        if (status.isInBlock) {
            events.forEach(({ event: { data, method, section }, phase }) => {
                if (section.match("samaritan", "i")) {
                    let nonce = data.toHuman()[0];

                    // construct credential
                    let vc = net.constructVC(did, cred, subject, nonce);

                    (async function() {
                        // sign the credential
                        await net.signCredential(keys, did, vc).then(svc => { 
                            let cipher = util.encryptData(key, JSON.stringify(svc));

                            // encrypt then upload to IPFS
                            (async function () {
                                await net.uploadToIPFS(cipher).then(cid => {
                                    console.log("The CID is  " + cid);

                                    // notify the network
                                    (async function () {
                                        const tx = api.tx.samaritan.recordCredential(did, subject, cid, pub);
                                        const txh = await tx.signAndSend(/* sam */ alice, ({ events = [], status }) => {
                                            if (status.isInBlock) {
                                                events.forEach(({ event: { data, method, section }, phase }) => {
                                                    if (section.match("samaritan", "i"))
                                                        res.send({ data: data.toHuman() });
                                                });
                                            }
                                        });
                                    }())
                                });
                            })()
                        })
                    })()
                }
            });
        }
    });
}

// get the credentials of a Samaritan
async function listCredentials(req, res) {
    // check if its a CID or a S-name that was sent
    if (req.id.indexOf("did:sam:root") == -1) {
        const transfer = api.tx.samaritan.retrieveDid(req.id);
        const hash = await transfer.signAndSend(alice, ({ events = [], status }) => {
            if (status.isInBlock) {
                events.forEach(({ event: { data, method, section }, phase }) => {
                    if (section.match("samaritan", "i")) {
                        let did = data.toHuman()[1];
                        listCreds(res, did, req.is_auth);
                    }
                });
            }
        });
    } else 
        listCreds(res, req.id, req.is_auth);
}

// retrieve the credentials from the network
async function listCreds(res, did, is_auth) {
    const transfer = api.tx.samaritan.listCredentials(did, is_auth);
    const hash = await transfer.signAndSend(alice, ({ events = [], status }) => {
        if (status.isInBlock) {
            events.forEach(({ event: { data, method, section }, phase }) => {
                if (section.match("samaritan", "i")) {
                    res.send({
                        did: data.toHuman()[0],
                        data: util.extractIDs(data.toHuman()[1])
                    });
                }
            });
        }
    });
}

// assert verifiable credential
async function assertCredential(req, res) {
    // expand credential credential
    let { did, nonce } = util.parseVCURL(req.url);

    // check whether its the Samaritan that owns the credential that is requesting it
    let is_same = did == req.did ? true : false;

    const transfer = api.tx.samaritan.getCredential(did, nonce, is_same);

    const hash = await transfer.signAndSend(alice, ({ events = [], status }) => {
        if (status.isInBlock) {
            events.forEach(({ event: { data, method, section }, phase }) => {
                if (section.match("samaritan", "i")) {
                    let cid = data.toHuman()[1];

                    (async function () {
                        await net.getFromIPFS(cid).then(arr => {
                            let bytes = util.Utf8ArrayToStr(arr);
                            let cred_str = util.decryptData(key, bytes);
                            let cred = JSON.parse(cred_str);
        
                            let vc = net.signCredential(req.keys, req.did, cred);
                            let cipher = net.encryptData(key, vc);

                            // encrypt then upload to IPFS
                            (async function () {
                                await net.uploadToIPFS(cipher).then(cid => {

                                    // notify the network of assertion
                                    (async function () {
                                        const tx = api.tx.samaritan.assertCredential(did, req.did, cid, nonce);
                                        const txh = await tx.signAndSend(/* sam */ alice, ({ events = [], status }) => {
                                            if (status.isInBlock) {
                                                events.forEach(({ event: { data, method, section }, phase }) => {
                                                    if (section.match("samaritan", "i"))
                                                        res.send({ data: data.toHuman() });
                                                });
                                            }
                                        });
                                    }())
                                });
                            })()

                        });
                    })()
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
    const mnemonic = mnemonicGenerate();
    const sam = keyring.addFromUri(mnemonic, { name: req.name }, 'sr25519');

    console.log(sam);
})

// create Samaritan
app.post('/create', (req, res) => {
    createSamaritan(req.body, res);
})

// verify Samaritan existence
app.post('/verify', (req, res) => {
    verifyExistence(req.body, res);
})

// create a verifiable credential
app.post('/add-credential', (req, res) => {
    addCredential(req.body, res);
})

// get credential list
app.post('/list-credentials', (req, res) => {
    listCredentials(req.body, res);
})

// assert a credential
app.post('/assert', (req, res) => {
    assertCredential(req.body, res);
})


// listen on port 3000
app.listen(port, () => console.info(`Listening on port ${port}`));