
let createDIDoc = (did) => {
    let json = {
        "@context": "https://www.w3.org/ns/did/v1",
        "id": did
    }

    return JSON.stringify(json);
}


module.exports = { createDIDoc, };