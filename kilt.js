// config 
import { createRequire } from "module";
const require = createRequire(import.meta.url);
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import * as Kilt from '@kiltprotocol/sdk-js'
import { mnemonicGenerate, cryptoWaitReady, blake2AsHex, xxhashAsHex, mnemonicToMiniSecret } from '@polkadot/util-crypto';
import { Keyring } from '@polkadot/keyring';

// utility functions
const util = require("./utility.cjs");

// set up the samaritan test account
const keyring = new Keyring({ type: 'sr25519' });
const api = await Kilt.connect('wss://peregrine.kilt.io/parachain-public-ws');
const sam = keyring.createFromUri("yellow obscure salmon affair extra six bubble clutch fly bread away tired", 'sr25519');

export async function getKiltLightDID(cid) {
    const keyring = new Keyring({ type: 'sr25519' });
    const mnemonic = mnemonicGenerate();
    const auth = keyring.createFromUri(mnemonic, 'sr25519');
    const service = [
        {
            id: '#claims-repo',
            type: ['KiltPublishedCredentialCollectionV1'],
            serviceEndpoint: [`http://ipfs.io/ipfs/${cid}`],
        },
    ];

    // Create a light DID from the generated authentication key.
    const lightDID = Kilt.Did.createLightDidDocument({
        authentication: [auth],
        service
    })

    return lightDID
}

export async function upgradeToFullDID(lightDid) {
    // Generate the DID migration tx.
    const migrationTx = await Kilt.Did.getStoreTx(
        lightDid,
        sam.address,
        lightDid.authentication
    );
    
    // The tx can then be submitted by the authorized account as usual.
    await Kilt.Blockchain.signAndSubmitTx(migrationTx, sam);
    
    // The new information is fetched from the blockchain and returned.
    const migratedFullDidUri = Kilt.Did.getFullDidUri(lightDid.uri)
    const encodedUpdatedDidDetails = await api.call.did.query(
        Kilt.Did.toChain(migratedFullDidUri)
    )
    
    return Kilt.Did.linkedInfoFromChain(encodedUpdatedDidDetails).document;
}

export function generateKeypairs(mnemonic = mnemonicGenerate()) {
    const authentication = Kilt.Utils.Crypto.makeKeypairFromSeed(
        mnemonicToMiniSecret(mnemonic)
    )
    
    const encryption = Kilt.Utils.Crypto.makeEncryptionKeypairFromSeed(
        mnemonicToMiniSecret(mnemonic)
    )
    
    const attestation = authentication.derive('//attestation')

    const delegation = authentication.derive('//delegation')

    return {
        authentication,
        encryption,
        attestation,
        delegation,
    }
}
  
  

export async function createFullDid() {
    const mnemonic = mnemonicGenerate()
    const { authentication, encryption, attestation, delegation } =
    generateKeypairs(mnemonic);

    // Get tx that will create the DID on chain and DID-URI that can be used to resolve the DID Document.
    const fullDidCreationTx = await Kilt.Did.getStoreTx(
    {
        authentication: [authentication],
        keyAgreement: [encryption],
        assertionMethod: [attestation],
        capabilityDelegation: [delegation],
    },

    sam.address,
    async ({ data }) => ({
        signature: authentication.sign(data),
        keyType: authentication.type,
    })
    )

    await Kilt.Blockchain.signAndSubmitTx(fullDidCreationTx, sam)

    const didUri = Kilt.Did.getFullDidUriFromKey(authentication);
    const encodedFullDid = await api.call.did.query(Kilt.Did.toChain(didUri));
    const { document } = Kilt.Did.linkedInfoFromChain(encodedFullDid);

    if (!document) {
        throw 'Full DID was not successfully created.'
    };

    return { mnemonic, fullDid: document }
}


// sample full DID document
// {
//     mnemonic: 'panther hobby cube impose bleak plate fancy addict hammer first inherit grit',
//     fullDid: {
//       uri: 'did:kilt:4tdRjEYrXn8zxPeRHv5Bu2zkxgsDnQ7VYmaEvSvLJTm2eKuE',
//       authentication: [ [Object] ],
//       assertionMethod: [ [Object] ],
//       capabilityDelegation: [ [Object] ],
//       keyAgreement: [ [Object] ]
//     }
//   }

// sample credential
// [{
//     "credential": {
//       "claim": {
//         "cTypeHash": "0x3291bb126e33b4862d421bfaa1d2f272e6cdfc4f96658988fbcffea8914bd9ac",
//         "contents": {
//           "Email": "john.doe@kilt.io"
//         },
//         "owner": "did:kilt:4pZGzLSybfMsxB1DcpFNYmnqFv5QihbFb1zuSuuATqjRQv2g"
//       },
//       "claimHashes": [
//         "0x489ee600a06c0e051010cca0c85e63f19e7d84ade945eb3cbeaf6c0aad06f64c",
//         "0x73d96f37134be64e9bc79e8d178afd4e4145aea1851d9f734347cf29cf7c2f64"
//       ],
//       "claimNonceMap": {
//         "0x4ac8f367789eb2c66c9cb5295c41fbe02d857300d6beac6f83501978b6cbc41c": "b9eb7d7d-797b-4268-abfb-27889f573743",
//         "0xad3ad967e5f65dd29eed05d8b2136c598562d6c920af75f4f0cf4d9554256723": "5a4eb0c2-de99-44d4-8826-6f76c2f11556"
//       },
//       "legitimations": [],
//       "delegationId": null,
//       "rootHash": "0xf31d7f63b39969e798566afe2b5e7413b0b919bc27d9560a7914cb2a2869af72",
//       "claimerSignature": {
//         "keyId": "did:kilt:4pZGzLSybfMsxB1DcpFNYmnqFv5QihbFb1zuSuuATqjRQv2g#0x29e83869d6440d102eaaac22742a004b35f152e5204c0ac7c5207c8e9b5f9cdb",
//         "signature": "0x02d7f4e05e6cea26de975aed63bda9cd07ffb2ff2864aa8480c2debeca68760e8666b87646955b127402fa1122e12265bc4dc1f143d1fcbdae6d97a69f3aff87"
//       }
//     },
//     "metadata": {
//       "label": "Email Credential"
//     }
//   }]

// converts attributes to acceptable objects
function strToCT(str) {
    let obj = {};

    let buf = str.split(" ");
    for (const i in buf) {
        // split it by '='
        let kv = buf[i].split("=");

        let t = {
            type: kv[1]
        };

        obj[kv[0]] = t;
    }

    return obj;
}

function useSignCallback(keyUri, didSigningKey) {
    const signCallback = async ({
        data,
        // The key relationship specifies which DID key must be used.
        keyRelationship,
        // The DID URI specifies which DID must be used. We already know which DID
        // this will be since we will use this callback just a few lines later (did === didUri).
        did,
    }) => ({
        signature: didSigningKey.sign(data),
        keyType: didSigningKey.type,
        keyUri,
    })
  
    return signCallback
}

export async function mintCType({ title, attr }, did_doc) {
    // Create a new CType definition.
    const ctObj = strToCT(attr);
    const assert = keyring.createFromUri(did_doc.mnemonic, 'sr25519');
    const { authentication, encryption, attestation, delegation } = generateKeypairs(did_doc.mnemonic);

    // create signCallback
    let signCallback = useSignCallback(did_doc.fullDid.uri, attestation);

     // Create a new CType definition.
    const ctype = Kilt.CType.fromProperties(title, ctObj);

    // Generate a creation tx.
    const ctypeCreationTx = api.tx.ctype.add(Kilt.CType.toChain(ctype));

    // Sign it with the right DID key.
    const authorizedCtypeCreationTx = await Kilt.Did.authorizeTx(
        did_doc.fullDid.uri,
        ctypeCreationTx,
        signCallback,
        sam.address
    )

    // Submit the creation tx to the KILT blockchain
    // using the KILT account specified in the creation operation.
    await Kilt.Blockchain.signAndSubmitTx(
        authorizedCtypeCreationTx,
        sam
    );

    return ctype;
}

export async function createAttestation(
        attester,
        mnemonic,
        credential
    ) {
    // Create an attestation object and write its root hash on the chain
    // using the provided attester's full DID.;
    try {
        const { authentication, encryption, attestation, delegation } = generateKeypairs(mnemonic);
        const { cTypeHash, claimHash, delegationId } = Kilt.Attestation.fromCredentialAndDid(credential, attester);

        // create signCallback
        let signCallback = useSignCallback(attester, attestation);

        // Write the attestation info on the chain.
        const attestationTx = api.tx.attestation.add(
            claimHash,
            cTypeHash,
            delegationId
        )

        const authorizedAttestationTx = await Kilt.Did.authorizeTx(
            attester,
            attestationTx,
            signCallback,
            sam.address
        );

        await Kilt.Blockchain.signAndSubmitTx(
            authorizedAttestationTx,
            sam
        );

        return true;
    } catch (e) {
        return false;
    }

}

export function createClaim(ctype, attr, did) {
    // first extract all the attributes needed and their values
    let claim_attr = util.extractClaimAttr(ctype.properties, attr);

    // The claimer generates the claim they would like to get attested.
    const claim = Kilt.Claim.fromCTypeAndClaimContents(
        ctype,
        claim_attr,
        did
    )

    const credential = Kilt.Credential.fromClaim(claim);
    return credential;
}

export async function getPresentation(
    credential,
    mnemonic,
    selectedAttributes = undefined,
    challenge = undefined
) {
    // get owner did from credential
    const did = credential.credential.claim.owner;
    const { authentication, encryption, attestation, delegation } = generateKeypairs(mnemonic);

    let signCallback = useSignCallback(did, authentication);
    
    // Create a presentation with only the specified fields revealed, if specified.
    return Kilt.Credential.createPresentation({
        credential,
        signCallback,
        selectedAttributes,
        challenge,
    })
}

export async function verifyPresentation(presentation, challenge = undefined) {
    // Verify the presentation with the provided challenge.
    return await Kilt.Credential.verifyPresentation(presentation, { challenge })
}

// attestation deposit would be reclaimed
export async function revokeCredential(credential) {
    try {
        // Generate the tx to claim the deposit back.
        const depositReclaimTx = api.tx.attestation.reclaimDeposit(
            credential.rootHash
        );
    
        // Submit the revocation tx to the KILT blockchain.
        await Kilt.Blockchain.signAndSubmitTx(depositReclaimTx, sam);

        return true;

    } catch (e) {
        return false;
    }
}