
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
import * as kilt from "./kilt.js";
import * as storg from "./storage.js";

// substrate client imports
import { ApiPromise, WsProvider } from '@polkadot/api';
import { mnemonicGenerate, cryptoWaitReady, blake2AsHex, xxhashAsHex } from '@polkadot/util-crypto';
const { Keyring } = require('@polkadot/keyring');
import keyringX from '@polkadot/ui-keyring';
import { stringToU8a, u8aToHex } from '@polkadot/util';
import e from "express";
const cors = require("cors");

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
    let sam_doc = net.createDIDDoc(DID, sam);   // first version

    let doc_hash = util.encryptData(BOLD_TEXT, sam_doc);
    let empty_array = "[]";

    // get an IPFS cid to upload our KILT claims
    await storg.uploadToIPFS(empty_array).then(cid => {
        console.log("The CID is  " + cid);

        (async function () {
            // get the Samaritans KILT light did
            let ldid = await kilt.getKiltLightDID(cid);

            // create samaritan onchain
            const transfer = api.tx.samaritan.createSamaritan(req.name, DID, doc_hash, util.encryptData(BOLD_TEXT, JSON.stringify(ldid)));
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
        }());

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

// create app and did document
async function recordApp(req, res) {
    const auth = isAuth(req.nonce);
    if (auth.is_auth) {
        // generate Keys for samaritan
        const mnemonic = mnemonicGenerate();
        const app = keyring.createFromUri(mnemonic, 'sr25519');

        keyring.setSS58Format(0);
        const DID = net.createRootDID(app.address, auth.did);

        // construct the DID document
        let doc = net.createAppDoc(DID, app, auth.did);

        let doc_hash = util.encryptData(BOLD_TEXT, doc, auth.did);

        // create samaritan onchain
        const transfer = api.tx.samaritan.createApp(DID, doc_hash);
        const hash = await transfer.signAndSend(/*sam */alice, ({ events = [], status }) => {
            if (status.isInBlock) {
                events.forEach(({ event: { data, method, section }, phase }) => {
                    // check for errors
                    if (section.match("system", "i") && data.toString().indexOf("error") != -1) {
                        return res.send({
                            data: { msg: "could not create app DID" }, error: true
                        })
                    } 

                    if (section.match("samaritan", "i")) {
                        return res.send({
                            data: { 
                                did: DID,
                                seed: mnemonic,
                                is_app: true
                            },
                            error: false
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

// manage attributes
async function manageAttributes(req, res) {
    const auth = isAuth(req.nonce);
    if (auth.is_auth) {
        // first get data stored onchain
        let attr = (await api.query.samaritan.attrRegistry(auth.did)).toHuman();

        if (req.data) {
            let new_attr = {};

            if (attr) {
                // update attr data
                attr = JSON.parse(util.decryptData(BOLD_TEXT, attr));

                new_attr = util.compareAndUpdate(attr, req.data);
            } else 
                new_attr = util.setUpAttr(req.data);

            // hash data and send onchain
            let cyph = util.encryptData(BOLD_TEXT, JSON.stringify(new_attr));

            const transfer = api.tx.samaritan.updateProfile(auth.did, cyph);
            const hash = await transfer.signAndSend(/*sam */alice, ({ events = [], status }) => {
                if (status.isInBlock) {
                    events.forEach(({ event: { data, method, section }, phase }) => {
                        // check for errors
                        if (section.match("system", "i") && data.toString().indexOf("error") != -1) {
                            return res.send({
                                data: { msg: "could not update attributes" }, error: true
                            }) 
                        } 

                        if (section.match("samaritan", "i")) {
                            return res.send({
                                data: { 
                                    type: "set",
                                    msg: "attributes update successful."
                                },
                                error: false
                            })
                        } 
                    });
                }
            });
        } else {
            return res.send({
                data: { 
                    attr: attr ? util.decryptData(BOLD_TEXT, attr) : "no attributes added.",
                    type: "get"
                },
                error: false
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

// website has requested user data
async function getUserData(req, res) {
    // first make sure app exist onchain
    let app = (await api.query.samaritan.docMetaRegistry(req.data.id)).toHuman();
    let sam = (await api.query.samaritan.docMetaRegistry(req.did)).toHuman();

    if (app && sam) {
        // get the required data
        let prof = (await api.query.samaritan.profileRegistry(req.did)).toHuman();

        let profile = JSON.parse(util.decryptData(BOLD_TEXT, prof));

        let rq = req.data.request;
        let ret = {};

        for (var i = 0; i < rq.length; i++) {
            ret[rq[i]] = profile[rq[i]];
        }

        // generate random token
        let token = blake2AsHex(Math.random() * 10000);

        // generate login token and save onchain
        const transfer = api.tx.samaritan.generateToken(req.data.id, req.did, token);
        const hash = await transfer.signAndSend(/*sam */alice, ({ events = [], status }) => {
            if (status.isInBlock) {
                events.forEach(({ event: { data, method, section }, phase }) => {
                    // check for errors
                    if (section.match("system", "i") && data.toString().indexOf("error") != -1) {
                        return res.send({
                            data: { msg: "could not generate token" }, error: true
                        }) 
                    } 

                    if (section.match("samaritan", "i")) {
                        ret["password"] = token;

                        return res.send({
                            data: ret,
                            error: false
                        })
                    } 
                });
            }
        });

    } else {
        return res.send({
            data: { 
                msg: "invalid did given."
            },

            error: true
        })
    }
}


// website has requested user signin data
async function fetchAuthData(req, res) {
    // first make sure app exist onchain
    let app = (await api.query.samaritan.docMetaRegistry(req.data.id)).toHuman();
    let sam = (await api.query.samaritan.docMetaRegistry(req.did)).toHuman();

    if (app && sam) {
        // get the required data
        let token = (await api.query.samaritan.signUpDataRegistry(req.data.id, req.did)).toHuman();

        return res.send({
            data: {
                email: "dummy@fma",
                password: token
            },
            
            error: false
        })
    } else {
        return res.send({
            data: { 
                msg: "invalid did given."
            },

            error: true
        })
    }
}

// create a KILT ctype
async function createKiltCtype(req, res) {
    const auth = isAuth(req.nonce);
    if (auth.is_auth) {
        // first get KILT DID
        let coll = (await api.query.samaritan.didRegistry(auth.did)).toHuman();

        // check the length of coll
        if (coll.length == 1) {
            // author a new full DID for creating making onchain KILT DID transactions
            let kfdid = await kilt.createFullDid();

            let kf_hash = util.encryptData(BOLD_TEXT, JSON.stringify(kfdid));

            // save onchain 
            const transfer = api.tx.samaritan.uploadDid(auth.did, kf_hash);
            const hash = await transfer.signAndSend(/*sam */alice, ({ events = [], status }) => {
                if (status.isInBlock) {
                    events.forEach(({ event: { data, method, section }, phase }) => {
                        // check for errors
                        if (section.match("system", "i") && data.toString().indexOf("error") != -1) {
                            return res.send({
                                data: { msg: "could not create cType" }, error: true
                            }) 
                        } 

                        if (section.match("samaritan", "i")) {
                            authorKiltCtype(auth.did, req, res);
                        } 
                    });
                }
            });
        } else 
            authorKiltCtype(auth.did, req, res);

    } else {
        return res.send({
            data: { 
                msg: "samaritan not recognized"
            },
            error: true
        })
    }
}

// create a KILT credential
async function createKiltClaim(req, res) {
    const auth = isAuth(req.nonce);
    if (auth.is_auth) {
        try {
            // get CType CID from chain
            let cid = (await api.query.samaritan.ctypeRegistry(req.ctype)).toHuman();
            if (cid) {
                // retrieve from IPFS
                await storg.getFromIPFS(cid).then(ct => {
                    let ctype = JSON.parse(ct);

                    console.log(ctype);

                    (async () => {
                        try {
                            // get attributes stored onchain for Samaritan
                            let attr = (await api.query.samaritan.attrRegistry(auth.did)).toHuman();
                            if (!attr) throw new Error("samaritan has no attribute to claim.")

                            attr = JSON.parse(util.decryptData(BOLD_TEXT, attr));

                            if (util.attrExists(ctype.properties, attr)) {
                                // get light did
                                let ldid = (await api.query.samaritan.didRegistry(auth.did)).toHuman();
                                ldid = JSON.parse(util.decryptData(BOLD_TEXT, ldid[0]));

                                let cred = kilt.createClaim(ctype, attr, ldid.uri);

                                let endpoint = ldid.service[0].serviceEndpoint;
                                let uri = util.extractCID(endpoint[0]); 

                                (async function () {
                                    // get repo from IPFS
                                    await storg.getFromIPFS(uri).then(claims => {
                                        let creds = JSON.parse(claims);

                                        // append claim
                                        creds.push(cred);

                                        // save to IPFS
                                        (async function () { 
                                            await storg.uploadToIPFS(JSON.stringify(creds)).then(cid => {
                                                console.log("The CID is  " + cid);

                                                // modify DID document
                                                ldid.service[0].serviceEndpoint = `http://ipfs.io/ipfs/${cid}`;

                                                // hash credential
                                                let hashed_cred = blake2AsHex(JSON.stringify(creds));

                                                (async function () {
                                                    // save to chain
                                                    const transfer = api.tx.samaritan.updateLightDoc(auth.did, util.decryptData(BOLD_TEXT, ldid));
                                                    const hash = await transfer.signAndSend(/*sam */alice, ({ events = [], status }) => {
                                                        if (status.isInBlock) {
                                                            events.forEach(({ event: { data, method, section }, phase }) => {
                                                                // check for errors
                                                                if (section.match("system", "i") && data.toString().indexOf("error") != -1)
                                                                    throw new Error("could not generate credential.")

                                                                if (section.match("samaritan", "i")) {

                                                                    // save credential hash
                                                                    (async function () {
                                                                        const transfer = api.tx.samaritan.saveCredential(hashed_cred, cid);
                                                                        const hash = await transfer.signAndSend(/*sam */alice, ({ events = [], status }) => {
                                                                            if (status.isInBlock) {
                                                                                events.forEach(({ event: { data, method, section }, phase }) => {
                                                                                    // check for errors
                                                                                    if (section.match("system", "i") && data.toString().indexOf("error") != -1)
                                                                                        throw new Error("could not generate credential.")

                                                                                    if (section.match("samaritan", "i")) {
                                                                                        // save credential onchain
                                                                                        return res.send({
                                                                                            data: { 
                                                                                                cred_id: hashed_cred,
                                                                                                msg: "KILT credential successfully created."
                                                                                            },
                                                                                            error: false
                                                                                        })
                                                                                    } 
                                                                                });
                                                                            }
                                                                        });
                                                                    })();
                                                                } 
                                                            });
                                                        }
                                                    });
                                                })();
                                            });
                                        })();
                                    })
                                })();
                            } else {
                                throw new Error("samaritan does not have all attributes required by cType")
                            }
                        } catch (e) {
                            return res.send({
                                data: { 
                                    msg: e.toString()
                                },
                                error: true
                            })
                        }
                    })();
                });
            } else 
                throw new Error("ctype not found onchain.");
        } catch (e) {
            return res.send({
                data: { 
                    msg: e.toString()
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

async function authorKiltCtype(did, req, res) {
    // get the latest did - fullDID
    let list = (await api.query.samaritan.didRegistry(did)).toHuman();
    const did_doc = JSON.parse(util.decryptData(BOLD_TEXT, list[1])); 

    let ct = await kilt.mintCType( {title: req.title, attr: req.attr }, did_doc);
    // save to IPFS
    await storg.uploadToIPFS(JSON.stringify(ct)).then(cid => {
        console.log("The CID is  " + cid);

        (async function() {
            // save onchain
            const transfer = api.tx.samaritan.saveCtype(ct[`$id`], cid);
            const hash = await transfer.signAndSend(/*sam */alice, ({ events = [], status }) => {
                if (status.isInBlock) {
                    events.forEach(({ event: { data, method, section }, phase }) => {
                        // check for errors
                        if (section.match("system", "i") && data.toString().indexOf("error") != -1) {
                            return res.send({
                                data: { msg: "could not create cType" }, error: true
                            }) 
                        } 

                        if (section.match("samaritan", "i")) {
                            return res.send({
                                data: { 
                                    id: ct[`$id`],
                                    msg: "cType successfully added to the KILT blockchain."
                                },
                                error: false
                            })
                        } 
                    });
                }
            });
        });
    });
}

async function attestCredential(req, res) {
    const auth = isAuth(req.nonce);
    if (auth.is_auth) {
        try {
            // get credential cid first
            let cid = (await api.query.samaritan.vcRegistry(req.credHash)).toHuman();
            if (!cid) throw new Error(`could not retrieve credential with hash "${req.credHash}`);

            // get did document of attester
            let docs = (await api.query.samaritan.didRegistry(auth.did)).toHuman();

            console.log(docs);

             // check the length of coll
            if (docs.length == 1) {
                // author a new full DID for creating making onchain KILT DID transactions
                let kfdid = await kilt.createFullDid();

                let kf_hash = util.encryptData(BOLD_TEXT, JSON.stringify(kfdid));

                // save onchain 
                const transfer = api.tx.samaritan.uploadDid(auth.did, kf_hash);
                const hash = await transfer.signAndSend(/*sam */alice, ({ events = [], status }) => {
                    if (status.isInBlock) {
                        events.forEach(({ event: { data, method, section }, phase }) => {
                            // check for errors
                            if (section.match("system", "i") && data.toString().indexOf("error") != -1) {
                                return res.send({
                                    data: { msg: "could not create cType" }, error: true
                                }) 
                            } 

                            if (section.match("samaritan", "i")) {
                                attestKiltCredential(kf_hash, req, res, cid);
                            } 
                        });
                    }
                });
            } else 
                attestKiltCredential(docs[1], req, res, cid);

        } catch (e) {
            return res.send({
                data: { 
                    msg: e.toString()
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

async function attestKiltCredential(docHash, req, res, uri) {
    const auth = isAuth(req.nonce);
    if (auth.is_auth) {
        let doc = JSON.parse(util.decryptData(BOLD_TEXT, docHash));

        try {
            // get credential from IPFS
            await storg.getFromIPFS(uri).then(claims => {
                let cred = JSON.parse(claims);
                let chosen;

                // get the credential we want
                for (var i = 0; i < cred.length; i++) {
                    // take the credential hash
                    if (blake2AsHex(cred[i] == req.docHash)) {
                        chosen = cred[i];
                        break;
                    }
                }

                if (chosen) {
                    (async function () {
                        let success = await kilt.createAttestation(doc.fullDid.uri, doc.mnemonic, cred[0]);

                        // attest credential
                        if (success) {
                            return res.send({
                                data: { 
                                    msg: "attestation successful."
                                },
                                error: false
                            });
                        } else 
                            throw new Error ("attestation failed.");
                    })();
                } else 
                    throw new Error ("credential not found.");
            });
        } catch (e) {
            return res.send({
                data: { 
                    msg: e.toString()
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

// fetch credential and read its content to its owner
async function fetchCredential(req, res) {

}


// request handles 
app.use(cors());
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
    if (req.query.name != "app")
        createSamaritan(req.query, res);
    else
        recordApp(req.query, res);
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

// manage profile
app.get('/attr', (req, res) => {
    manageAttributes(req.query, res);
})

// handle auth website signup
app.post('/signup', (req, res) => {
    getUserData(req.body, res);
})

// handle auth website signup
app.post('/signin', (req, res) => {
    fetchAuthData(req.body, res);
})

// create KILT ctype
app.get('/create-ctype', (req, res) => {
    createKiltCtype(req.query, res);
})

// create claim
app.get('/create-claim', (req, res) => {
    createKiltClaim(req.query, res);
})

// attest credential
app.get('/attest', (req, res) => {
    attestCredential(req.query, res);
})

// fetch data from network
app.get('/read-data', (req, res) => {
    switch (req.query.arg1) {
        case "--cred":
            fetchCredential(req.query, res);
            break;
    }
})


// listen on port 3000
app.listen(port, () => console.info(`Listening on port ${port}`));
