const fs = require("fs");

const crypto = require("crypto-js");

function Utf8ArrayToStr(array) {

    // adopted from:
    //   http://www.onicos.com/staff/iz/amuse/javascript/expert/utf.txt

    /* utf.js - UTF-8 <=> UTF-16 convertion
    *
    * Copyright (C) 1999 Masanao Izumo <iz@onicos.co.jp>
    * Version: 1.0
    * LastModified: Dec 25 1999
    * This library is free.  You can redistribute it and/or modify it.
    */

    var out, i, len, c;
    var char2, char3;

    out = "";
    len = array.length;
    i = 0;
    
    while(i < len) {
        c = array[i++];
        switch(c >> 4)
        { 
            case 0: case 1: case 2: case 3: case 4: case 5: case 6: case 7:
                // 0xxxxxxx
                out += String.fromCharCode(c);
                break;
            case 12: case 13:
                // 110x xxxx   10xx xxxx
                char2 = array[i++];
                out += String.fromCharCode(((c & 0x1F) << 6) | (char2 & 0x3F));
                break;
            case 14:
                // 1110 xxxx  10xx xxxx  10xx xxxx
                char2 = array[i++];
                char3 = array[i++];
                out += String.fromCharCode(((c & 0x0F) << 12) |
                            ((char2 & 0x3F) << 6) |
                            ((char3 & 0x3F) << 0));
                break;
        }
    }

    return out;
}

function removeXtra(str) {
    let x = 0;
    while (true) {
        for (var i = 0; i < u.length; i++, x++) {
            if (u[i].match(/[a-z]/i)) {
                for (var j = x; j < u.length; j++, x++) {
                    console.log(x);
                    if (u[j].match(/[a-z]/i)) 
                        return;
                }
            }
        }
    }
}

function extractIDs(str) {
    let ret = [];

    [].forEach.call(str.split("-"), (s) => {
        if (s) ret.push(s);
    });

    return ret;
}

function extractInfo(json) {
    // extract URL from json
    return { url: json["schema:url"], author: json["schema:author"]["@id"] };
}

function parseVCURL(url) {
    // extract did and nonce from URL
    return {
        did: url.split('/')[0],
        nonce: url.split('/')[2]
    }
}

// extract number of access data asked
function getAccessCount(data) {
    let list = JSON.parse(data)["sam:accepts"];
    let count = 0;

    for (count; count < list.length; count++);

    return count;
}

// returns date according to the XML Date Spec
function getXMLDate() {
    const now = new Date();
    return `${now.getFullYear()}-${now.getMonth() > 9 ? now.getMonth() : "0" + now.getMonth()}-${now.getDay() > 9 ? now.getDay() : "0" + now.getDay()}T${now.getHours()}:${now.getMinutes()}:${now.getSeconds() + now.getTimezoneOffset()}`;
}

// return second half of array
function splitArray(arr) {
    let box = [];

    for (var i = 0; i < 32; i++)
        box[i] = arr[i];

    return box;
}

function encryptData(key, text) {
    // Encrypte the data
    return crypto.AES.encrypt(text, key).toString();
}

function decryptData(key, cipher) {
    // Decrypting the data
    return crypto.AES.decrypt(cipher, key).toString(crypto.enc.Utf8);
}

// generate metadata for file uploaded
function createMetadataFile(fields, cid) {
    if (fields.metadata) {      // is a file
        let meta = fields.metadata.split("//");

        return {
            cid,
            name: meta[0],
            size: meta[1],
            type: meta[2],
            permission: 700,
            nonce: meta[3],
        }
    } else {    // is a directory
        let p = fields.parent_dir.split("//");

        return {
            name: fields.new_dir,
            parent: p[0],
            type: "dir",
            permission: 700,
            nonce: p[1]
        }
    }
}

const uint8ToBase64 = (arr) => Buffer.from(arr).toString('base64');

function setUpAttr(str) {
    let data = str.split(";");
    let attr = {};

    for (var i = 0; i < data.length; i++) {
        let kv = data[i].split("=");
        attr[kv[0]] = kv[1];
    }

    return attr;
}

function compareAndUpdate(attr, str2) {
    let na = setUpAttr(str2);
    return {
        ...attr,
        ...na
    };
}

// make sure the attribute has everything the cType requires
function attrExists(ctypeObj, attrObj) {
    let ctProps = Object.keys(ctypeObj);
    for (var i = 0; i < ctProps.length; i++) 
        if (!Object.keys(attrObj).includes(ctProps[i])) 
            return false;

    return true;
}

// extract the necessary claim properties from attributes
function extractClaimAttr(props, attrObj) {
    let claim = {};
    let ctProps = Object.keys(props);

    for (var i = 0; i < ctProps.length; i++) {
        if (Object.keys(attrObj).includes(ctProps[i])) {
            switch (props[ctProps[i]].type) {
                case 'integer':
                    claim[ctProps[i]] = parseInt(attrObj[ctProps[i]]);
                    break;
                    
                default:
                    claim[ctProps[i]] = attrObj[ctProps[i]];
            } 
        }
    }
    return claim;
}

// extract URI from ipfs URL
function extractCID(url) {
    let frag = url.split("/");

    return frag[frag.length - 1];
}

module.exports = { Utf8ArrayToStr, extractInfo, getAccessCount, getXMLDate, splitArray, uint8ToBase64, 
    decryptData, encryptData, extractIDs, parseVCURL, createMetadataFile, setUpAttr, compareAndUpdate,
    attrExists, extractClaimAttr, extractCID
};
 