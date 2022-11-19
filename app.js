
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
const bodyParser = require('body-parser');

// formidable form handler
const formidable = require('formidable');
const uploadFolder = "public/files/";

formidable.multiples = true;
formidable.maxFileSize = 50 * 1024 * 1024; // 5MB
formidable.uploadDir = uploadFolder;

// app.use(express.json());

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
import { mnemonicGenerate, cryptoWaitReady, blake2AsHex, xxhashAsHex } from '@polkadot/util-crypto';
const { Keyring } = require('@polkadot/keyring');
import keyringX from '@polkadot/ui-keyring';
import {  } from '@polkadot/util-crypto';

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

// add new samaritan to chain
async function createSamaritan(req, res) {
    // generate Keys for samaritan
    const mnemonic = mnemonicGenerate();
    const sam = keyring.createFromUri(mnemonic, 'sr25519');

    keyring.setSS58Format(0);
    const DID = net.createRootDID(sam.address);

    // sign communication nonce
    const nonce = blake2AsHex(mnemonicGenerate().replace(" ", ""));

    // use `keyringX` for storing session data
    keyringX.saveAddress(sam.address, { nonce, did: DID, pair: sam, name: req.name });

    // construct the DID document
    let doc = net.createDIDDoc(DID, sam);   // first version

    let doc_hash = util.encryptData(BOLD_TEXT, doc);

    // create samaritan onchain
    const transfer = api.tx.samaritan.createSamaritan(req.name, DID, doc_hash);
    const hash = await transfer.signAndSend(/*sam */alice, ({ events = [], status }) => {
        if (status.isInBlock) {
            events.forEach(({ event: { data, method, section }, phase }) => {
                // check for errors
                if (section.match("system", "i") && data.toString().indexOf("error") != -1) {
                    return res.send({
                        data: { msg: "could not create samaritan" }, error: true
                    })
                } 

                if (section.match("samaritan", "i")) {
                    return res.send({
                        data: { 
                            did: DID,
                            seed: mnemonic,
                            nonce
                        },

                        error: false
                    })
                } 
            });
        }
    });
}

// initialize a samaritan
async function initSamaritan(req, res) {
    try {
        const sam = keyring.createFromUri(req.keys, 'sr25519');

        // generate new communication nonce
        const nonce = blake2AsHex(mnemonicGenerate().replace(" ", ""));

        let ret = (await api.query.samaritan.samaritanRegistry(/* sam.address */ alice.address)).toHuman();
        if (!ret) throw new Error("samaritan could not be initialized");

        // save session data
        keyringX.saveAddress(sam.address, { nonce, did: ret.did, pair: sam, name: ret.name });

        // went through
        return res.send({
            data: { 
                msg: `initialization complete.`,
                nonce
            },

            error: false
        })

    } catch (err) {
        return res.send({
            data: { 
                msg: "samaritan could not be initialized"
            },

            error: true
        })
    }
}

// recieve a DID document
async function findSamaritan(req, res) {
    try {
        // query the chain for the records
        let meta = (await api.query.samaritan.docMetaRegistry(req.did)).toHuman();

        // get the latest one
        meta = meta[meta.length - 1];

        if (!meta) throw new Error();

        let doc = util.decryptData(BOLD_TEXT, meta.hl);

        return res.send({
            data: { 
                version: meta.version,
                doc, 
                created: util.getXMLDate(meta.created),
                active: meta.active
            },

            error: false
        })
    } catch (err) {
        return res.send({
            data: { 
                msg: `${req.did} not recognized on the network.`
            },

            error: true
        })
    }
}

// rename a samaritan
async function renameSamaritan(req, res) {
    const auth = isAuth(req.nonce);
    if (auth.is_auth) {
        const transfer = api.tx.samaritan.renameSamaritan(req.name);
        const hash = await transfer.signAndSend(/*sam */alice, ({ events = [], status }) => {
            if (status.isInBlock) {
                events.forEach(({ event: { data, method, section }, phase }) => {
                    // check for errors
                    if (section.match("system", "i") && data.toString().indexOf("error") != -1) {
                        return res.send({
                            data: { msg: "could not rename samaritan." }, error: true
                        })
                    } 

                    if (section.match("samaritan", "i")) {
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
                msg: "samaritan not recognized"
            },

            error: true
        })
    }
}

// enable or disable a samaritan
async function alterStatus(req, res) {
    const auth = isAuth(req.nonce);
    const cmd = req.cmd == "disable" ? false : true;
    if (auth.is_auth) {
        const transfer = api.tx.samaritan.alterState(auth.did, cmd);
        const hash = await transfer.signAndSend(/*sam */alice, ({ events = [], status }) => {
            if (status.isInBlock) {
                events.forEach(({ event: { data, method, section }, phase }) => {
                    // check for errors
                    if (section.match("system", "i") && data.toString().indexOf("error") != -1) {
                        return res.send({
                            data: { msg: `could not ${req.cmd} samaritan` }, error: true
                        })
                    } 

                    if (section.match("samaritan", "i")) {
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
                msg: "samaritan not recognized"
            },

            error: true
        })
    }
}


// enable or disable a samaritan
async function describeSamaritan(req, res) {
    const auth = isAuth(req.nonce);
    if (auth.is_auth) {
        let sam = (await api.query.samaritan.samaritanRegistry(/* auth.pair.address */ alice.address)).toHuman();

        // return did
        return res.send({
            data: { 
                name: sam.name,
                did: auth.did
            },

            error: false
        })
    } else {
        return res.send({
            data: { 
                msg: "samaritan not recognized"
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
                keyringX.saveAddress(addr.address, { nonce, did: auth.did, hashkey: addr.meta.hashkey, pair: addr.meta.pair });
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
                msg: "samaritan not recognized"
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
                msg: "samaritan not recognized"
            },

            error: true
        })
    }
}

// check keyring and test for equality
function isAuth(nonce) {
    var is_auth = false;
    var did, hk = "";
    var pair;
    [].forEach.call(keyringX.getAddresses(), (addr) => {
        if (addr.meta.nonce == nonce) {
            is_auth = true;
            did = addr.meta.did;
            hk = addr.meta.hashkey;
            pair = addr.meta.pair;
        }
    });

    return { is_auth, did, hk, pair };
}

// add a samaritan to trust quorum
async function trustSamaritan(req, res) {
    const auth = isAuth(req.nonce);
    if (auth.is_auth) {
        // make sure samaritan is not trustin itseld
        if (req.did != auth.did) {
            const transfer = api.tx.samaritan.updateQuorum(auth.did, req.did);
            const hash = await transfer.signAndSend(/*sam */alice, ({ events = [], status }) => {
                if (status.isInBlock) {
                    events.forEach(({ event: { data, method, section }, phase }) => {
                        /// check for errors
                        if (section.match("system", "i") && data.toString().indexOf("error") != -1) {
                            let error = data.toHuman().dispatchError.Module.error == "0x07000000"
                            ?   `quorum already filled up` : `'${req.did}' exists in quorum already`;
                        
                            return res.send({
                                data: { msg: error }, error: true
                            })
                        } 

                        if (section.match("samaritan", "i")) {
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
                    msg: "samaritan cannot be in its quorum"
                },
    
                error: true
            })
        }
    } else {
        return res.send({
            data: { 
                msg: "samaritan not recognized"
            },

            error: true
        })
    }
}

// list out members of a quorum
async function listQuorum(req, res) {
    const auth = isAuth(req.nonce);
    if (auth.is_auth) {
        let list = (await api.query.samaritan.trustQuorum(auth.did)).toHuman();

        return res.send({
            data: { 
                list
            },

            error: false
        })
    } else {
        return res.send({
            data: { 
                msg: "samaritan not recognized"
            },

            error: true
        })
    }
}

// removes a samaritan from a trust quorum
async function filterQuorum(req, res) {
    const auth = isAuth(req.nonce);
    if (auth.is_auth) {
        // make sure samaritan is not trustin itseld
        if (req.did != auth.did) {
            const transfer = api.tx.samaritan.filterQuorum(auth.did, req.did);
            const hash = await transfer.signAndSend(/*sam */alice, ({ events = [], status }) => {
                if (status.isInBlock) {
                    events.forEach(({ event: { data, method, section }, phase }) => {
                        /// check for errors
                        if (section.match("system", "i") && data.toString().indexOf("error") != -1) {
                            return res.send({
                                data: { msg: `could not remove '${req.did} from quorum.` }, error: true
                            })
                        } 

                        if (section.match("samaritan", "i")) {
                            return res.send({
                                data: { msg: `quorum filter successful.` }, error: false
                            })
                        } 
                    });
                }
            });
        } else {
            return res.send({
                data: { 
                    msg: "samaritan cannot be in its quorum"
                },
    
                error: true
            })
        }
    } else {
        return res.send({
            data: { 
                msg: "samaritan not recognized"
            },

            error: true
        })
    }
}

// rotate keys (a security measure)
async function rotateKeys(req, res) {
    try {
        const auth = isAuth(req.nonce);
        if (auth.is_auth) {
            // generate new DID document auth keys
            
            // first get did document
            let meta = (await api.query.samaritan.docMetaRegistry(auth.did)).toHuman();

            // get the latest one
            meta = meta[meta.length - 1];

            if (!meta) throw new Error("document was not found.");

            if (!meta.active) throw new Error("enable your samaritan to continue.");

            let doc = net.createDIDDoc(auth.did, auth.pair, meta.version);

            let doc_hash = util.encryptData(BOLD_TEXT, doc);

            const transfer = api.tx.samaritan.updateDocument(auth.did, doc_hash);
            const hash = await transfer.signAndSend(/*sam */alice, ({ events = [], status }) => {
                if (status.isInBlock) {
                    events.forEach(({ event: { data, method, section }, phase }) => {
                        // check for errors
                        if (section.match("system", "i") && data.toString().indexOf("error") != -1) {
                            return res.send({
                                data: { msg: "could not rotate keys" }, error: true
                            })
                        } 

                        if (section.match("samaritan", "i")) {
                            return res.send({
                                data: { 
                                    msg: "key rotation successful."
                                },

                                error: false
                            })
                        } 
                    });
                }
            });
        } else
            throw new Error("samaritan not recognized.");

    } catch (err) {
        return res.send({
            data: { 
                msg: err.toString()
            },

            error: true
        })
    }
}

// vote on a memorandum
async function voteMemo(req, res) {

}

// request handles 
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }))

app.get('', (req, res) => {
    res.render('main', {})
})

app.get('/terminal', (req, res) => {
    res.render('terminal', { text: '' })
})

// test route
app.get('/test', (req, res) => {
    const mnemonic = mnemonicGenerate();
    const sam = keyring.addFromUri(mnemonic, { name: req.name }, 'sr25519');

    console.log(sam.meta);
})

// create samaritan
app.get('/new', (req, res) => {
    createSamaritan(req.query, res);
})

// initialize samaritan
app.get('/init', (req, res) => {
    initSamaritan(req.query, res);
})

// find samaritan
app.get('/find', (req, res) => {
    findSamaritan(req.query, res);
})

// rename samaritan
app.get('/rename', (req, res) => {
    renameSamaritan(req.query, res);
})

// change a samaritans scope
app.get('/change-status', (req, res) => {
    alterStatus(req.query, res);
})

// get info about samaritan
app.get('/describe', (req, res) => {
    describeSamaritan(req.query, res);
})

// get info about samaritan
app.get('/refresh', (req, res) => {
    refreshSession(req.query, res);
})

// clean up session
app.get('/exit', (req, res) => {
    cleanSession(req.query, res);
})
 
// add to quorum
app.get ('/trust', (req, res) => {
    trustSamaritan(req.query, res);
})

// list out members of a quorum
app.get('/enum-quorum', (req, res) => {
    listQuorum(req.query, res);
})

// remove a Samaritan from of a quorum
app.get('/revoke', (req, res) => {
    filterQuorum(req.query, res);
})

// rotate Samaritan keys
app.get('/rotate', (req, res) => {
    rotateKeys(req.query, res);
})

// vote on a memo
app.post('/vote', (req, res) => {
    voteMemo(req.query, res);
})


// listen on port 3000
app.listen(port, () => console.info(`Listening on port ${port}`));