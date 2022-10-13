// import { createRequire } from "module";
// const require = createRequire(import.meta.url);

// import path from 'path';
// import {fileURLToPath} from 'url';

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

// import { ApiPromise, WsProvider } from '@polkadot/api';
// import { typesBundleForPolkadot, crustTypes } from '@crustio/type-definitions';
// const { Keyring } = require('@polkadot/keyring');


// // Create global chain instance
// const crustChainEndpoint = 'wss://rpc.crust.network';
// const api = new ApiPromise({
//     provider: new WsProvider(crustChainEndpoint),
//     typesBundle: typesBundleForPolkadot,
// });

// const keyring = new Keyring({ type: 'sr25519' });

// export async function placeStorageOrder(fileCid, fileSize) {

//     let mnemonic = 'loyal owner priority mistake recall mushroom gap rotate next action ghost tourist';
//     const sam = keyring.addFromUri(mnemonic);

//     const tips = 0;
//     const memo = '';
//     const tx = api.tx.market.placeStorageOrder(fileCid, fileSize, tips, memo);

//     await api.isReadyOrError;
//     return new Promise((resolve, reject) => {
//         tx.signAndSend(sam, ({events = [], status}) => {
//             console.log(`💸  Tx status: ${status.type}, nonce: ${tx.nonce}`);

//             if (status.isInBlock) {
//                 events.forEach(({event: {method, section}}) => {
//                     if (method === 'ExtrinsicSuccess') {
//                         console.log(`✅  Place storage order success!`);
//                         resolve(true);
//                     }
//                 });
//             } else {
//                 // Pass it
//             }
//         }).catch(e => {
//             reject(e);
//         })
//     });
// }