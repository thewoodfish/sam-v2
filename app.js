
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
import { mnemonicGenerate, cryptoWaitReady, blake2AsHex } from '@polkadot/util-crypto';
const { Keyring } = require('@polkadot/keyring');
import keyringX from '@polkadot/ui-keyring';
import {  } from '@polkadot/util-crypto';


// global
const wsProvider = new WsProvider('ws://127.0.0.1:9944');
const api = await ApiPromise.create({ provider: wsProvider });

const BOLD_TEXT = "Sacha is a great buddy!";

const keyring = new Keyring({ type: 'sr25519' });

const alice = keyring.addFromUri('//Alice');
const storage_providers  = ["crust network"];

cryptoWaitReady().then(() => {
    // load all available addresses and accounts
    keyringX.loadAll({ ss58Format: 42, type: 'sr25519' });
  
  });

// add new samaritan to chain
async function createSamaritan(req, res) {
    const signedBlock = await api.rpc.chain.getBlock();

    // generate Keys for samaritan
    const mnemonic = mnemonicGenerate();
    const sam = keyring.createFromUri(mnemonic, 'sr25519');
    
    keyring.setSS58Format(0);
    const DID = net.createRootDID(sam.address);

    // random provider
    const provider = storage_providers[Math.floor(Math.random() * storage_providers.length)];

    // sign communication nonce
    const nonce = blake2AsHex(mnemonicGenerate().replace(" ", ""));
    const hash_key = blake2AsHex(mnemonic);

    // use `keyringX` for storing session data
    keyringX.saveAddress(sam.address, { nonce, did: DID, hashkey: hash_key, pair: sam });

    // record event onchain
    const transfer = api.tx.samaritan.createSamaritan(req.name, DID, hash_key, provider);
    const hash = await transfer.signAndSend(/*sam */alice, ({ events = [], status }) => {
        if (status.isInBlock) {
            events.forEach(({ event: { data, method, section }, phase }) => {
                // check for errors
                if (section.match("system", "i") && data.toString().indexOf("error") != -1) {
                    return res.send({
                        data: { msg: "could not create samaritan" }, error: true
                    })
                } 

                // after samaritan has been recorded, then `really create it` by birthing its DID document
                if (section.match("samaritan", "i")) {
                    createDIDDocument(res, DID, mnemonic, nonce, provider);
                } 
            });
        }
    });
}

// create the DID document
async function createDIDDocument(res, did, mnemonic, nonce, provider) {
    let doc = net.createDIDDoc(did, mnemonic);

    // create hash link
    let hash = util.encryptData(BOLD_TEXT, doc);   

    // upload to d-Storage
    (async function () {
        // commit to IPFS
        await net.uploadToStorage(provider, hash).then(ipfs => {
            let cid = ipfs.cid;
            
            // send the CID onchain to record the creation of the DID document
            (async function () {
                const tx = api.tx.samaritan.acknowledgeDoc(did, cid, hash);
                const txh = await tx.signAndSend(/* sam */ alice, ({ events = [], status }) => {
                    if (status.isInBlock) {
                        events.forEach(({ event: { data, method, section }, phase }) => {
                            if (section.match("system", "i") && data.toString().indexOf("error") != -1) {
                                return res.send({
                                    data: { msg: "could not create samaritan" }, error: true
                                })
                            } 
            
                            if (section.match("samaritan", "i")) {
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

// initialize a samaritan
async function initSamaritan(req, res) {
    // what we mean by initialization really, is getting that communication nonce
    try {
        const sam = keyring.createFromUri(req.keys, 'sr25519');

        // generate new communication nonce
        const nonce = blake2AsHex(mnemonicGenerate().replace(" ", ""));

        // get sig
        const sig = blake2AsHex(req.keys);

        // get DID
        const tx = api.tx.samaritan.fetchAddress(sig);
        const txh = await tx.signAndSend(/* sam */ alice, ({ events = [], status }) => {
            if (status.isInBlock) {
                events.forEach(({ event: { data, method, section }, phase }) => {
                    if (section.match("system", "i") && data.toString().indexOf("error") != -1) {
                        return res.send({
                            data: { msg: "could not find samaritan" }, error: true
                        })
                    } 
    
                    if (section.match("samaritan", "i")) {
                        // create session by adding it to keyring
                        keyringX.saveAddress(sam.address, { nonce, did: data.toHuman()[0], hashkey: sig, pair: sam });

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
                msg: "samaritan could not be initialized"
            },

            error: true
        })
    }
}

// recieve a DID to look for the samaritan and its corresponding DID document
async function findSamaritan(req, res) {

}

// rename a samaritan
async function renameSamaritan(req, res) {
    const auth = isAuth(req.nonce);
    if (auth.is_auth) {
        const transfer = api.tx.samaritan.renameSamaritan(req.name, auth.did);
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
                            let error = data.toHuman().dispatchError.Module.error == "0x08000000"
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
        const transfer = api.tx.samaritan.enumQuorum(auth.did);
        const hash = await transfer.signAndSend(/*sam */alice, ({ events = [], status }) => {
            if (status.isInBlock) {
                events.forEach(({ event: { data, method, section }, phase }) => {
                    // check for errors
                    if (section.match("system", "i") && data.toString().indexOf("error") != -1) {
                        return res.send({
                            data: { msg: `enumeration of quorum members failed.` }, error: true
                        })
                    } 

                    if (section.match("samaritan", "i")) {
                        return res.send({
                            data: { list: data.toHuman()[1] }, error: false
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
    const auth = isAuth(req.nonce);
    if (auth.is_auth) {
        // generate new mnemonic & hashkey
        const mnemonic = mnemonicGenerate();
        const hash_key = blake2AsHex(mnemonic);

        // generate new DID document
        let doc = net.createDIDDoc(auth.did, mnemonic);

        // create hash link
        let hash = util.encryptData(hash_key, doc);

        // first change the samaritans auth signature
        const transfer = api.tx.samaritan.changeSig(auth.hk, hash_key);
        const hx = await transfer.signAndSend(/*sam */alice, ({ events = [], status }) => {
            if (status.isInBlock) {
                events.forEach(({ event: { data, method, section }, phase }) => {
                    /// check for errors
                    if (section.match("system", "i") && data.toString().indexOf("error") != -1) {
                        return res.send({
                            data: { msg: "could not complete rotation" }, error: true
                        })
                    } 

                    if (section.match("samaritan", "i")) {
                        // upload to d-Storage
                        (async function () {
                            // commit to IPFS
                            await net.uploadToStorage(hash).then(ipfs => {
                                let cid = ipfs.cid;

                                // send the CID onchain to record the creation of the DID document
                                (async function () {
                                    const tx = api.tx.samaritan.acknowledgeDoc(auth.did, cid, hash);
                                    const txh = await tx.signAndSend(/* sam */ alice, ({ events = [], status }) => {
                                        if (status.isInBlock) {
                                            events.forEach(({ event: { data, method, section }, phase }) => {
                                                if (section.match("system", "i") && data.toString().indexOf("error") != -1) {
                                                    return res.send({
                                                        data: { msg: "could not complete rotation" }, error: true
                                                    })
                                                } 
                                
                                                if (section.match("samaritan", "i")) {
                                                    return res.send({
                                                        data: {
                                                            seed: mnemonic,
                                                        }, 
                                                        error: false
                                                    })
                                                } 
                                            });
                                        }
                                    })
                                }())
                            })
                        }())
                    }
                })
            }
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

// vote on a memorandum
async function voteMemo(req, res) {

}

// pull a credential 
async function pullCredential(req, res) {
    const auth = isAuth(req.nonce);
    if (auth.is_auth) {
        try {
            const link = "public/docs/data.txt";
            const file = fs.createWriteStream(link);
        
            https.get(req.url, response => {
                var stream = response.pipe(file);
        
                stream.on("finish", function() {
                    // get JSON content
                    fs.readFile(link, 'utf8', function (err, data) {
                        if (err || util.isJSONSyntaxError(data)) 
                            throw(err);
        
                        let cred = JSON.stringify(data);
                        initCredential(cred, auth, res);
                      });
                });
            });
        } catch (e) {
            return res.send({
                data: { 
                    msg: "process could not be completed."
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

// process the upload of the Samaritans data to the internet
async function processUpload(fields, path, res) {
    const auth = isAuth(fields.nonce);
    if (auth.is_auth) {
        // save to storage
        (async function () {
            // commit to IPFS & pin on storage
            await net.uploadToStorage(storage_providers[0], path, auth.pair, fields.metadata.split("//")[0]).then(reslt => {
                // check for errors
                if (reslt.error) {
                    return res.send({
                        data: { 
                            msg: "process could not be completed."
                        },
            
                        error: true
                    })
                }

                let cid = reslt.cid;

                // data is always private by default
                let file_data = util.createMetadataFile(fields, cid);
                        
                // create hash from metadata
                let hash = blake2AsHex(file_data);
            
                // sign something
                let sig = auth.pair.sign(BOLD_TEXT);
                let meta = util.encryptData(util.uint8ToBase64(sig), JSON.stringify(file_data));

                // record onchain
                (async function () {
                    const tx = api.tx.directory.addInodeEntry(auth.did, meta, hash, fields.parent_dir, false);
                    const txh = await tx.signAndSend(/* sam */ alice, ({ events = [], status }) => {
                        if (status.isInBlock) {
                            events.forEach(({ event: { data, method, section }, phase }) => {
                                if (section.match("system", "i") && data.toString().indexOf("error") != -1) {
                                    return res.send({
                                        data: { msg: "process could not be completed." }, error: true
                                    })
                                } 
                
                                if (section.match("samaritan", "i")) {
                                    return res.send({
                                        data: {
                                            url: `${auth.did}/r/${data.toHuman()[3]}/${hash}`    // 'r' for resource
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
    } else {
        return res.send({
            data: { 
                msg: "samaritan not recognized"
            },

            error: true
        })
    }
}

// create new directory under the Samaritan 
async function createNewDirectory(req, res) {
    const auth = isAuth(req.nonce);
    if (auth.is_auth) {

        // data is always private by default
        let dir_data = util.createMetadataFile(fields, " ");

        // create hash from metadata
        let hash = blake2AsHex(dir_data);
            
        // sign something
        let sig = auth.pair.sign(BOLD_TEXT);
        let meta = util.encryptData(util.uint8ToBase64(sig), JSON.stringify(dir_data));

        // record onchain
        (async function () {
            const tx = api.tx.directory.addInodeEntry(auth.did, meta, hash, fields.parent_dir.split("//")[0], true);
            const txh = await tx.signAndSend(/* sam */ alice, ({ events = [], status }) => {
                if (status.isInBlock) {
                    events.forEach(({ event: { data, method, section }, phase }) => {
                        if (section.match("system", "i") && data.toString().indexOf("error") != -1) {
                            return res.send({
                                data: { msg: "process could not be completed." }, error: true
                            })
                        } 

                        if (section.match("samaritan", "i")) {
                            return res.send({
                                data: {
                                    url: `${auth.did}/r/${data.toHuman()[3]}/${hash}`
                                }, 
                                error: false
                            })
                        } 
                    });
                }
            });
        }())
    } else {
        return res.send({
            data: { 
                msg: "samaritan not recognized"
            },

            error: true
        })
    }
}

// load a file or dir
async function accessDataContainer(req, res) {
    const auth = isAuth(req.nonce);
    if (auth.is_auth) {
        // check URL syntax
        let data = net.parseURL(req.url);
        if (data.isErrorFree) {
            // get the metadata onchain
            (async function () {
                const tx = api.tx.directory.fetchMetadata(auth.did, data.frags[0], data.frags[2], data.frags[3]);
                const txh = await tx.signAndSend(/* sam */ alice, ({ events = [], status }) => {
                    if (status.isInBlock) {
                        events.forEach(({ event: { data, method, section }, phase }) => {
                            if (section.match("system", "i") && data.toString().indexOf("error") != -1) {
                                return res.send({
                                    data: { msg: "could not fetch resource." }, error: true
                                })
                            } 
            
                            if (section.match("samaritan", "i")) {
                                // get metadata
                                let ret = data.toString()[0];

                                // dahash it to get CID

                                // sign something
                                let sig = auth.pair.sign(BOLD_TEXT);
                                let metadata = util.decryptData(util.uint8ToBase64(sig), JSON.stringify(ret));

                                let meta = JSON.parse(metadata);

                                // return CID
                                return res.send({
                                    data: {
                                        type: meta.type,
                                        pl: meta.type == "dir" 
                                            ? {     // a directory
                                                name: meta.name,
                                                contains: [...DataTransfer.toString()[1]]
                                            }
                                            : {
                                                    // a file
                                                name: meta.name,
                                                cid: meta.cid,
                                                size: meta.size,
                                            }
                                    }, 
                                    error: false
                                })
                            } 
                        });
                    }
                });
            }())
        } else {
            return res.send({
                data: { 
                    msg: "invalid URI specified."
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

// delete a resource on the filesystem
async function deleteResource(req, res) {
    const auth = isAuth(req.nonce);
    if (auth.is_auth) {
        // check URL syntax
        let data = net.parseURL(req.url);
        if (data.isErrorFree) {
            // get the metadata onchain
            (async function () {
                const tx = api.tx.directory.unlinkInode(auth.did, data.frags[0], data.frags[2], data.frags[3]);
                const txh = await tx.signAndSend(/* sam */ alice, ({ events = [], status }) => {
                    if (status.isInBlock) {
                        events.forEach(({ event: { data, method, section }, phase }) => {
                            if (section.match("system", "i") && data.toString().indexOf("error") != -1) {
                                return res.send({
                                    data: { msg: "operation could not be complete." }, error: true
                                })
                            } 
            
                            if (section.match("samaritan", "i")) {
                                // somehow remove file from crust pinning & get a refund maybe, lol

                                return res.send({
                                    data: { 
                                        msg: "filesystem entry has been removed."
                                    },
                        
                                    error: true
                                })
                            } 
                        });
                    }
                });
            }())
        } else {
            return res.send({
                data: { 
                    msg: "invalid URI specified."
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

// change resource access mode
async function changeAccessMode(req, res) {
    const auth = isAuth(req.nonce);
    if (auth.is_auth) {
        // check URL syntax
        let data = net.parseURL(req.url);
        if (data.isErrorFree) {
            // get the metadata onchain
            (async function () {
                const tx = api.tx.directory.changePermission(auth.did, data.frags[0], data.frags[2], data.frags[3], req.mode);
                const txh = await tx.signAndSend(/* sam */ alice, ({ events = [], status }) => {
                    if (status.isInBlock) {
                        events.forEach(({ event: { data, method, section }, phase }) => {
                            if (section.match("system", "i") && data.toString().indexOf("error") != -1) {
                                return res.send({
                                    data: { msg: "operation could not be complete." }, error: true
                                })
                            } 
            
                            if (section.match("samaritan", "i")) {
                                // somehow rome file from crust pinning
                                return res.send({
                                    data: { 
                                        msg: `inode permission changed to ${req.mode}`
                                    },
                        
                                    error: true
                                })
                            } 
                        });
                    }
                });
            }())
        } else {
            return res.send({
                data: { 
                    msg: "invalid URI specified."
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

// change resource owner
async function changeResourceOwner(req, res) {
    const auth = isAuth(req.nonce);
    if (auth.is_auth) {
        // check URL syntax
        let data = net.parseURL(req.url);
        if (data.isErrorFree) {
            // get the metadata onchain
            (async function () {
                const tx = api.tx.directory.modifyInodeOwner(auth.did, data.frags[0], data.frags[2], data.frags[3], req.did);
                const txh = await tx.signAndSend(/* sam */ alice, ({ events = [], status }) => {
                    if (status.isInBlock) {
                        events.forEach(({ event: { data, method, section }, phase }) => {
                            if (section.match("system", "i") && data.toString().indexOf("error") != -1) {
                                return res.send({
                                    data: { msg: "could not assign new owner." }, error: true
                                })
                            } 
            
                            if (section.match("samaritan", "i")) {
                                // somehow rome file from crust pinning
                                return res.send({
                                    data: { 
                                        msg: `inode owership has been modified.`
                                    },
                        
                                    error: true
                                })
                            } 
                        });
                    }
                });
            }())
        } else {
            return res.send({
                data: { 
                    msg: "invalid URI specified."
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

// request handles 
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }))

app.get('', (req, res) => {
    res.render('main', {})
})

app.get('/terminal', (req, res) => {
    res.render('terminal', { text: 'This is EJS' })
})

// test route
app.get('/test', (req, res) => {
    const mnemonic = mnemonicGenerate();
    const sam = keyring.addFromUri(mnemonic, { name: req.name }, 'sr25519');

    console.log(sam.meta);
})

// create samaritan
app.post('/new', (req, res) => {
    createSamaritan(req.body, res);
})

// create samaritan
app.post('/init', (req, res) => {
    initSamaritan(req.body, res);
})

// find samaritan
app.post('/find', (req, res) => {
    findSamaritan(req.body, res);
})

// find samaritan
app.post('/rename', (req, res) => {
    renameSamaritan(req.body, res);
})

// change a samaritans scope
app.post('/change-status', (req, res) => {
    alterStatus(req.body, res);
})

// get info about samaritan
app.post('/describe', (req, res) => {
    describeSamaritan(req.body, res);
})

// get info about samaritan
app.post('/refresh', (req, res) => {
    refreshSession(req.body, res);
})

// clean up session
app.post('/exit', (req, res) => {
    cleanSession(req.body, res);
})

// add to quorum
app.post('/trust', (req, res) => {
    trustSamaritan(req.body, res);
})

// list out members of a quorum
app.post('/enum-quorum', (req, res) => {
    listQuorum(req.body, res);
})

// remove a Samaritan from of a quorum
app.post('/revoke', (req, res) => {
    filterQuorum(req.body, res);
})

// rotate Samaritan keys
app.post('/rotate', (req, res) => {
    rotateKeys(req.body, res);
})

// vote on a memo
app.post('/vote', (req, res) => {
    voteMemo(req.body, res);
})

// pull and parse credential from the net
app.post('/pull', (req, res) => {
    pullCredential(req.body, res);
})

// upload Samaritan data to storage
app.post('/upload', (req, res) => {
    const form = new formidable.IncomingForm();
    form.parse(req, function(err, fields, files) {

        var oldPath = files.file.filepath;
        var newPath = uploadFolder + '/' + fields.file_name;

        fs.rename(oldPath, newPath, function(err){
            if (err) console.log(err);
        });

        // process upload
        processUpload(fields, newPath, res);
    })
})

// create a new directory 
app.post('/mkdir', (req, res) => {
    createNewDirectory(req.body, res);
})

// access a file or directory 
app.post('/access', (req, res) => {
    accessDataContainer(req.body, res);
})

// access a file or directory 
app.post('/access', (req, res) => {
    accessDataContainer(req.body, res);
})

// delete a file or directory 
app.post('/del', (req, res) => {
    deleteResource(req.body, res);
})

// change mode
app.post('/chmod', (req, res) => {
    changeAccessMode(req.body, res);
})

// change resource owner
app.post('/chown', (req, res) => {
    changeResourceOwner(req.body, res);
})

// complete file ownership change
app.post('/chown', (req, res) => {
    claimOwnership(req.body, res);
})

// listen on port 3000
app.listen(process.env.PORT, () => console.info(`Listening on port ${port}`));