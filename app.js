
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
import { mnemonicGenerate, cryptoWaitReady, blake2AsHex } from '@polkadot/util-crypto';
const { Keyring } = require('@polkadot/keyring');
import keyringX from '@polkadot/ui-keyring';
import {  } from '@polkadot/util-crypto';
import { platform } from "os";


// global
const wsProvider = new WsProvider('ws://127.0.0.1:9944');
const api = await ApiPromise.create({ provider: wsProvider });

const BOLD_TEXT = "Sacha is a great buddy!";

const keyring = new Keyring({ type: 'sr25519' });

const alice = keyring.addFromUri('//Alice');

cryptoWaitReady().then(() => {
    // load all available addresses and accounts
    keyringX.loadAll({ ss58Format: 42, type: 'sr25519' });
  
  });

// add new samaitan to chain
async function createsamaitan(req, res) {
    const signedBlock = await api.rpc.chain.getBlock();

    // generate Keys for samaitan
    const mnemonic = mnemonicGenerate();
    const sam = keyring.createFromUri(mnemonic, 'sr25519');
    
    keyring.setSS58Format(0);
    const DID = net.createRootDID(sam.address);

    // sign communication nonce
    const nonce = blake2AsHex(mnemonicGenerate().replace(" ", ""));
    const hash_key = blake2AsHex(mnemonic);

    // use `keyringX` for storing session data
    keyringX.saveAddress(sam.address, { nonce, did: DID });

    // record event onchain
    const transfer = api.tx.samaitan.createsamaitan(req.name, DID, hash_key);
    const hash = await transfer.signAndSend(/*sam */alice, ({ events = [], status }) => {
        if (status.isInBlock) {
            events.forEach(({ event: { data, method, section }, phase }) => {
                // check for errors
                if (section.match("system", "i") && data.toString().indexOf("error") != -1) {
                    return res.send({
                        data: { msg: "could not create samaitan" }, error: true
                    })
                } 

                // after samaitan has been recorded, then `really create it` by birthing its DID document
                if (section.match("samaitan", "i")) {
                    createDIDDocument(res, DID, mnemonic, hash_key, nonce);
                } 
            });
        }
    });
}

// create the DID document
async function createDIDDocument(res, did, mnemonic, hash_key, nonce) {
    let doc = net.createDIDDoc(did, mnemonic);

    // create hash link
    let hash = util.encryptData(util.Utf8ArrayToStr(hash_key), doc);

    // upload to d-Storage
    (async function () {
        // commit to IPFS
        await net.uploadToStorage(hash).then(ipfs => {
            let cid = ipfs.cid;
            
            // send the CID onchain to record the creation of the DID document
            (async function () {
                const tx = api.tx.samaitan.acknowledgeDoc(did, cid, hash);
                const txh = await tx.signAndSend(/* sam */ alice, ({ events = [], status }) => {
                    if (status.isInBlock) {
                        events.forEach(({ event: { data, method, section }, phase }) => {
                            if (section.match("system", "i") && data.toString().indexOf("error") != -1) {
                                return res.send({
                                    data: { msg: "could not create samaitan" }, error: true
                                })
                            } 
            
                            if (section.match("samaitan", "i")) {
                                return res.send({
                                    data: {
                                        seed: mnemonic,
                                        did: did,
                                        nonce:  nonce,
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

// initialize a samaitan
async function initsamaitan(req, res) {
    // what we mean by initialization really, is getting that communication nonce
    try {
        const sam = keyring.createFromUri(req.keys, 'sr25519');

        // generate new communication nonce
        const nonce = blake2AsHex(mnemonicGenerate().replace(" ", ""));

        // get sig
        const sig = blake2AsHex(req.keys);

        // get DID
        const tx = api.tx.samaitan.fetchAddress(sig);
        const txh = await tx.signAndSend(/* sam */ alice, ({ events = [], status }) => {
            if (status.isInBlock) {
                events.forEach(({ event: { data, method, section }, phase }) => {
                    if (section.match("system", "i") && data.toString().indexOf("error") != -1) {
                        return res.send({
                            data: { msg: "could not find samaitan" }, error: true
                        })
                    } 
    
                    if (section.match("samaitan", "i")) {
                        // create session by adding it to keyring
                        keyringX.saveAddress(sam.address, { nonce, did: data.toHuman()[0] });

                        // went through
                        return res.send({
                            data: { 
                                msg: `initialization complete.`,
                                nonce
                            },

                            error: false
                        })
                    } 
                });
            }
        });

    } catch (err) {
        return res.send({
            data: { 
                msg: "samaitan could not be initialized"
            },

            error: true
        })
    }
}

// recieve a DID to look for the samaitan and its corresponding DID document
async function findsamaitan(req, res) {

}

// rename a samaitan
async function renamesamaitan(req, res) {
    const auth = isAuth(req.nonce);
    if (auth.is_auth) {
        const transfer = api.tx.samaitan.renamesamaitan(req.name, auth.did);
        const hash = await transfer.signAndSend(/*sam */alice, ({ events = [], status }) => {
            if (status.isInBlock) {
                events.forEach(({ event: { data, method, section }, phase }) => {
                    // check for errors
                    if (section.match("system", "i") && data.toString().indexOf("error") != -1) {
                        return res.send({
                            data: { msg: "could not create samaitan" }, error: true
                        })
                    } 

                    if (section.match("samaitan", "i")) {
                        return res.send({
                            data: { msg: `name change to "${req.name}" successful.` }, error: false
                        })
                    } 
                });
            }
        });
    } else {
        return res.send({
            data: { 
                msg: "samaitan not recognized"
            },

            error: true
        })
    }
}

// enable or disable a samaitan
async function alterStatus(req, res) {
    const auth = isAuth(req.nonce);
    const cmd = req.cmd == "disable" ? false : true;
    if (auth.is_auth) {
        const transfer = api.tx.samaitan.alterState(auth.did, cmd);
        const hash = await transfer.signAndSend(/*sam */alice, ({ events = [], status }) => {
            if (status.isInBlock) {
                events.forEach(({ event: { data, method, section }, phase }) => {
                    // check for errors
                    if (section.match("system", "i") && data.toString().indexOf("error") != -1) {
                        return res.send({
                            data: { msg: `could not ${req.cmd} samaitan` }, error: true
                        })
                    } 

                    if (section.match("samaitan", "i")) {
                        return res.send({
                            data: { msg: `status change to "${req.cmd}d" successful.` }, error: false
                        })
                    } 
                });
            }
        });
    } else {
        return res.send({
            data: { 
                msg: "samaitan not recognized"
            },

            error: true
        })
    }
}


// enable or disable a samaitan
async function describesamaitan(req, res) {
    const auth = isAuth(req.nonce);
    if (auth.is_auth) {
        // return did
        return res.send({
            data: { 
                msg: `DID: ${auth.did}`
            },

            error: false
        })
    } else {
        return res.send({
            data: { 
                msg: "samaitan not recognized"
            },

            error: true
        })
    }
}

// init new nonce
async function refreshSession(req, res) {
    const auth = isAuth(req.nonce);
    if (auth.is_auth) {
        var nonce = "";
        [].forEach.call(keyringX.getAddresses(), (addr) => {
            if (addr.meta.nonce == req.nonce) {
                nonce = blake2AsHex(mnemonicGenerate().replace(" ", ""));
                
                // update
                keyringX.saveAddress(addr.address, { nonce, did: auth.did });
            }
        });
    
        return res.send({
            data: { 
                msg: `session refreshed.`,
                nonce
            },

            error: false
        })
    } else {
        return res.send({
            data: { 
                msg: "samaitan not recognized"
            },

            error: true
        })
    }
}

// delete address and account
async function cleanSession(req, res) {
    const auth = isAuth(req.nonce);
    if (auth.is_auth) {
        var nonce = "";
        [].forEach.call(keyringX.getAddresses(), (addr) => {
            if (addr.meta.nonce == req.nonce)
                keyringX.forgetAddress(addr.address);
        });
    
        return res.send({
            data: { 
                msg: `your session has ended.`,
                nonce
            },

            error: false
        })
    } else {
        return res.send({
            data: { 
                msg: "samaitan not recognized"
            },

            error: true
        })
    }
}

// check keyring and test for equality
function isAuth(nonce) {
    var is_auth = false;
    var did = "";
    [].forEach.call(keyringX.getAddresses(), (addr) => {
        if (addr.meta.nonce == nonce) {
            is_auth = true;
            did = addr.meta.did;
        }
    });

    return { is_auth, did };
}

// add a samaitan to trust quorum
async function trustsamaitan(req, res) {
    const auth = isAuth(req.nonce);
    if (auth.is_auth) {
        // make sure samaitan is not trustin itseld
        if (req.did != auth.did) {
            const transfer = api.tx.samaitan.updateQuorum(auth.did, req.did);
            const hash = await transfer.signAndSend(/*sam */alice, ({ events = [], status }) => {
                if (status.isInBlock) {
                    events.forEach(({ event: { data, method, section }, phase }) => {
                        // check for errors
                        if (section.match("system", "i") && data.toString().indexOf("error") != -1) {
                            let error = data.toHuman().dispatchError.Module.error == "0x08000000"
                                ?   `quorum already filled up` : `'${req.did}' exists in quorum already`;
                        
                            return res.send({
                                data: { msg: error }, error: true
                            })
                        } 

                        if (section.match("samaitan", "i")) {
                            return res.send({
                                data: { msg: `quorum update successful.` }, error: false
                            })
                        } 
                    });
                }
            });
        } else {
            return res.send({
                data: { 
                    msg: "samaitan cannot be in its quorum"
                },
    
                error: true
            })
        }
    } else {
        return res.send({
            data: { 
                msg: "samaitan not recognized"
            },

            error: true
        })
    }
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

// create samaitan
app.post('/new', (req, res) => {
    createsamaitan(req.body, res);
})

// create samaitan
app.post('/init', (req, res) => {
    initsamaitan(req.body, res);
})

// find samaitan
app.post('/find', (req, res) => {
    findsamaitan(req.body, res);
})

// find samaitan
app.post('/rename', (req, res) => {
    renamesamaitan(req.body, res);
})

// change a samaitans scope
app.post('/change-status', (req, res) => {
    alterStatus(req.body, res);
})

// get info about samaitan
app.post('/describe', (req, res) => {
    describesamaitan(req.body, res);
})

// get info about samaitan
app.post('/refresh', (req, res) => {
    refreshSession(req.body, res);
})

// clean up session
app.post('/exit', (req, res) => {
    cleanSession(req.body, res);
})

// add to quorum
app.post('/trust', (req, res) => {
    trustsamaitan(req.body, res);
})

// listen on port 3000
app.listen(port, () => console.info(`Listening on port ${port}`));