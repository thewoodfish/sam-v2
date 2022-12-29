jQuery(function($, undefined) {
	var main = $('body').terminal({
		sam: function(arg1="", arg2="", arg3="", arg4="", arg5="") {
			switch (arg1) {
				case "help": 
				case "":
					this.echo(`samaritanOS v0.1.0`);
					this.echo(`Usage: sam <command> [arg1] [arg2] [arg3] [argN]`);
					this.echo(`These are common samaritan commands used in various situations:`); 
					this.echo(`new <name>			creates a new samaritan with a non-unique name`);
					this.echo(`init <keys>			lets your samaritan take control of the terminal`);
					this.echo(`find <DID>			confirms if samaritan exists and returns DID document and metadata`);
					this.echo(`rename <new name>   renames your samaritan`);
					this.echo(`kill                disables your Samaritan`);
					this.echo(`wake                enables your Samaritan`);
					this.echo(`desc                gives you information about your Samaritan`);
					this.echo(`refresh				refreshes terminal connection`);
					this.echo(`exit                ends your terminal session`);
					this.echo(`trust <DID>			adds DID to your trust quorum. 2/3 of your quorum can help retrieve your samaritan`);
					this.echo(`help                informs you about the samaritan terminal`);
					this.echo(`rotate				rotates your samritan keys and presents you with a new mnemonic`);
					this.echo(`quorum				lists out all the samaritans in your trust quorum`);
					this.echo(`remove <DID>         removes a samaritan from your trust quorum`);
					this.echo(`attr "<key1=value1> <key2=value2> <keyN=valueN>"       add attributes that describes your Samaritan. Absence of arguments displays data`);
					this.echo(`read <option>           						      The values of <option> are:`);
					this.echo(`    --cred <credentialHash>                            read contents of a verifiable credential`);
					this.echo(`enum <option>                                          The values of <option> are:`);
					this.echo(`    cred                                               lists out all credentials of a Samaritan and their various subjects`);
					this.echo(`chain --<chain>                                        interacts with blockchains for mission critical tasks.`);
					this.echo(`These are various <chain>s supported by SamaritanOS and their specific functions:`);
					this.echo(`The KILT chain: kilt`);
					this.echo(`    ctype  --title=<title> --attr="<attr1=type1> <attr2=type2> ... <attrN=typeN>"        create credential type schema to recieve credentials in the right forrmat for attestations"`);
					this.echo(`    claim <ctypeID>                                                                      request verification for your selected attributes`);
					this.echo(`    attest <credentialHash>                                                              attest a verifiable credential`);
					this.echo(`    verify <DID> <credentialHash>                                                        verify whether the credential was verified by the specified samaritan`);
					this.echo(`    revoke <credentialHash>                                                              revoke a verifiable credential. You must be the attester to do this`);
					
					break;
				
				case "new":
					// check argument conformance
					if (!arg2) {
						this.echo(`fatal: You must provide a name for your samaritan`);
						this.echo(`usage: sam new <name>`);
					} else {
						if (arg2 == "app") 
							this.echo("setting up app DID...");
						else 
							this.echo(`creating your samaritan...`);
						this.pause();

						fetch (getURL(`new`, `name=${arg2}`, `nonce=${ getNonce() }`), {
							method: 'get',
							headers: {
								'Content-Type': 'application/json'
							}
						})
						.then(res => {
							(async function () {
								await res.json().then(res => {
									main.resume();

									if (res.error) 
										main.echo(`fatal: ${res.data.msg}`);
									else {

										if (!res.data.is_app) {
											// set nonce for further communication
											sessionStorage.setItem("nonce", res.data.nonce);

											main.echo("samaritan successfully added to the network");

											main.echo(`DID:     ${res.data.did}`);
											main.echo(`Keys:    ${res.data.seed} ([[b;red;] You have 30 seconds to copy them.])`);

											main.pause();
											setTimeout(() => {
												main.update(-1, "Keys:    ****************************************************************************************************").resume();
											}, 3000);
										} else {
											main.echo("app did successfully added to the network");

											main.echo(`DID:     ${res.data.did}`);
											main.echo(`Keys:    ${res.data.seed} ([[b;red;] You have 30 seconds to copy them.])`);

											main.pause();
											setTimeout(() => {
												main.update(-1, "Keys:    ****************************************************************************************************").resume();
											}, 30000);
										}
									}

								});
							})();  
						})
					}
					
					break;
				case "init":
					// check argument conformance
					if (!arg2 || arguments.length > 2) {
						this.echo(`fatal: you must provide your samaritan keys`);
						this.echo(`usage: sam init <keys> e.g sam init "bake egypt below..."`);
					} else {

						// check length of mnemonic
						if (arg2.split(/\s+/).length != 12) {
							this.echo(`fatal: invalid number of mnemonic`);
						} else {
							// clear seeds
							this.clear();
							this.echo(`initializing samaritan...`);
							this.pause();

							fetch (getURL(`init`, `keys=${arg2}`), {
								method: 'get',
								headers: {
									'Content-Type': 'application/json'
								}
							})
							.then(res => {
								(async function () {
									await res.json().then(res => {
										main.resume();

										if (res.error) 
											main.echo(`fatal: ${res.data.msg}`);
										else {
											// set nonce for further communication
											sessionStorage.setItem("nonce", res.data.nonce);

											main.echo(`${res.data.msg}`);
										}

									});
								})();  
							})
						}
					}

					break;

				case "find":
					if (!inSession()) {
						main.echo(`fatal: no samaritan recognized. See 'sam help'`)
					} else {
						// check argument conformance
						if (!arg2) {
							this.echo(`fatal: you must provide DID to lookup`);
							this.echo(`usage: sam find <DID>`);
						} else {
							// check did format
							if (!isDID(arg2)) {
								this.echo(`fatal: invalid DID format`);
								this.echo(`expected DID format: did:sam:root:<address>`);
							} else {
								this.echo(`querying network...`);
								this.pause();

								fetch (getURL(`find`, `did=${arg2}`, `nonce=${ getNonce() }`), {
									method: 'get',
									headers: {
										'Content-Type': 'application/json'
									}
								})
								.then(res => {
									(async function () {
										await res.json().then(res => {
											main.resume();

											if (res.error) 
												main.echo(`fatal: ${res.data.msg}`);
											else {
												main.echo(`DID:             ${arg2}`);
												main.echo(`DID document:    ${JSON.stringify(res.data.doc, null, 2)}`);
												main.echo(`DID doc metadata: `)
												main.echo(`    version: ${res.data.version}`);
												main.echo(`    active: ${res.data.active}`);
												main.echo(`    created: ${res.data.created}`);
											}
										})
									})();  
								})
							}
						}
					}

					break;

				case "rename":
					if (!inSession()) {
						main.echo(`fatal: no samaritan initialized. See 'sam help'`)
					} else {
						// check argument conformance
						if (!arg2) {
							this.echo(`fatal: you must provide a name`);
							this.echo(`usage: sam rename <new name>`);
						} else {
							this.echo(`renaming...`);
							this.pause();

							fetch (getURL(`rename`, `name=${arg2}`, `nonce=${ getNonce() }`), {
								method: 'get',
								headers: {
									'Content-Type': 'application/json'
								}
							})
							.then(res => {
								(async function () {
									await res.json().then(res => {
										main.resume();
										
										if (res.error) 
											main.echo(`fatal: ${res.data.msg}`);
										else 
											main.echo(`${res.data.msg}`);
										
									});
								})();  
							})
						}
					}

					break;

				case "kill":
					if (!inSession()) {
						main.echo(`fatal: no samaritan initialized. See 'sam help'`)
					} else {
						this.echo(`disabling your Samaritan...`);
						this.pause();

						fetch (getURL(`change-status`, `cmd=disable`, `nonce=${ getNonce() }`), {
							method: 'get',
							headers: {
								'Content-Type': 'application/json'
							}
						})
						.then(res => {
							(async function () {
								await res.json().then(res => {
									main.resume();
									
									if (res.error) 
										main.echo(`fatal: ${res.data.msg}`);
									else 
										main.echo(`${res.data.msg}`);
									
								});
							})();  
						})
					}

					break;

				case "wake":
					if (!inSession()) {
						main.echo(`fatal: no samaritan initialized. See 'sam help'`)
					} else {
						this.echo(`changing scope to visible...`);
						this.pause();

						fetch (getURL(`change-status`, `cmd=enable`, `nonce=${ getNonce() }`), {
							method: 'get',
							headers: {
								'Content-Type': 'application/json'
							}
						})
						.then(res => {
							(async function () {
								await res.json().then(res => {
									main.resume();
									
									if (res.error) 
										main.echo(`fatal: ${res.data.msg}`);
									else 
										main.echo(`${res.data.msg}`);
									
								});
							})();  
						})
					}

					break;

				case "desc":
					if (!inSession()) {
						main.echo(`fatal: no samaritan initialized. See 'sam help'`)
					} else {
						this.echo(`retrieving information...`);
						this.pause();

						fetch (getURL(`describe`, `nonce=${ getNonce() }`), {
							method: 'get',
							headers: {
								'Content-Type': 'application/json'
							}
						})
						.then(res => {
							(async function () {
								await res.json().then(res => {
									main.resume();
									
									if (res.error) 
										main.echo(`fatal: ${res.data.msg}`);
									else 
										main.echo(`Name:    ${res.data.name}`);
										main.echo(`DID:     ${res.data.did}`);
										main.echo(`To get more info about Samaritan, see 'sam find <DID>'`);
								});
							})();  
						})
					}

					break;

				case "refresh":
					if (!inSession()) {
						main.echo(`fatal: no samaritan initialized. See 'sam help'`)
					} else {
						this.echo(`refreshing session...`);
						this.pause();

						fetch (getURL(`refresh`, `nonce=${ getNonce() }`), {
							method: 'get',
							headers: {
								'Content-Type': 'application/json'
							}
						})
						.then(res => {
							(async function () {
								await res.json().then(res => {
									main.resume();
									
									if (res.error) 
										main.echo(`fatal: ${res.data.msg}`);
									else {
										sessionStorage.setItem("nonce", res.data.nonce);
										main.echo(`${res.data.msg}`);
									}
								});
							})();  
						})
					}

					break;

				case "exit":
					if (!inSession()) {
						main.echo(`fatal: no samaritan initialized. See 'sam help'`)
					} else {
						this.echo(`cleaning up session...`);
						this.pause();

						fetch (getURL(`exit`, `nonce=${ getNonce() }`), {
							method: 'get',
							headers: {
								'Content-Type': 'application/json'
							}
						})
						.then(res => {
							(async function () {
								await res.json().then(res => {
									main.resume();
									
									if (res.error) 
										main.echo(`fatal: ${res.data.msg}`);
									else {
										sessionStorage.setItem("nonce", res.data.nonce);
										main.echo(`${res.data.msg}`);
										main.echo(`To begin afresh, run 'sam init <keys>'`);
									}
									
								});
							})();  
						})
					}

					break;

				case "trust":
					if (!inSession()) {
						main.echo(`fatal: no samaritan initialized. See 'sam help'`)
					} else {
						// check argument conformance
						if (!arg2) {
							this.echo(`fatal: you must provide a DID`);
							this.echo(`usage: sam trust <DID>`);
						} else {
							// check did format
							if (!isDID(arg2)) {
								this.echo(`fatal: invalid DID format`);
								this.echo(`expected DID format: did:sam:root:<address>`);
							} else {
								this.echo(`setting up...`);
								this.pause();

								fetch (getURL(`trust`, `did=${arg2}`, `nonce=${ getNonce() }`), {
									method: 'get',
									headers: {
										'Content-Type': 'application/json'
									}
								})
								.then(res => {
									(async function () {
										await res.json().then(res => {
											main.resume();
											
											if (res.error) 
												main.echo(`fatal: ${res.data.msg}`);
											else 
												main.echo(`${res.data.msg}`);
											
										});
									})();  
								})
							}
						}
					}

					break;

				case "quorum":
					if (!inSession()) {
						main.echo(`fatal: no samaritan initialized. See 'sam help'`)
					} else {
						this.echo(`getting ready to list quorum members...`);
						this.pause();

						fetch (getURL(`enum-quorum`, `nonce=${ getNonce() }`), {
							method: 'get',
							headers: {
								'Content-Type': 'application/json'
							}
						})
						.then(res => {
							(async function () {
								await res.json().then(res => {
									main.resume();
									
									if (res.error) 
										main.echo(`fatal: ${res.data.msg}`);
									else {
										main.echo(`DID list:`)
										for (var i = 0; i < res.data.list.length; i++) 
											main.echo(`      ${i + 1} -> ${res.data.list[i]}`)
										main.echo(`${res.data.list.length} members retrieved.`)
									}
									
								});
							})();  
						})
					}

					break;

				case "remove":
					if (!inSession()) {
						main.echo(`fatal: no samaritan initialized. See 'sam help'`)
					} else {
						// check argument conformance
						if (!arg2) {
							this.echo(`fatal: you must provide a DID`);
							this.echo(`usage: sam revoke <DID>`);
						} else {
							// check did format
							if (!isDID(arg2)) {
								this.echo(`fatal: invalid DID format`);
								this.echo(`expected DID format: did:sam:root:<address>`);
							} else {
								this.echo(`processing...`);
								this.pause();

								fetch (getURL(`revoke`, `did=${arg2}`, `nonce=${ getNonce() }`), {
									method: 'get',
									headers: {
										'Content-Type': 'application/json'
									}
								})
								.then(res => {
									(async function () {
										await res.json().then(res => {
											main.resume();
											
											if (res.error) 
												main.echo(`fatal: ${res.data.msg}`);
											else 
												main.echo(`${res.data.msg}`);
											
										});
									})();  
								})
							}
						}
					}

					break;

				case "rotate":
					if (!inSession()) {
						main.echo(`fatal: no samaritan initialized. See 'sam help'`)
					} else {
						this.echo(`trying to rotate keys...`);
						this.pause();

						fetch (getURL(`rotate`, `nonce=${ getNonce() }`), {
							method: 'get',
							headers: {
								'Content-Type': 'application/json'
							}
						})
						.then(res => {
							(async function () {
								await res.json().then(res => {
									main.resume();
									
									if (res.error) 
										main.echo(`fatal: ${res.data.msg}`);
									else
										main.echo("rotation sucessful.")
								});
							})();  
						})
					}

					break;

				case "attr":
					if (!inSession()) {
						main.echo(`fatal: no samaritan initialized. See 'sam help'`);
					} else {
						if (!arg2)
							this.echo(`retrieving attributes...`);
						else 
							this.echo(`updating attributes...`);
						this.pause();

						fetch (getURL(`attr`, `nonce=${ getNonce() }`, `data=${arg2.replaceAll(" ", ";")}`), {
							method: 'get',
							headers: {
								'Content-Type': 'application/json'
							}
						})
						.then(res => {
							(async function () {
								await res.json().then(res => {
									main.resume();
									
									if (res.error) 
										main.echo(`fatal: ${res.data.msg}`);
									else {
										if (res.data.type == "set")
											main.echo(`${res.data.msg}`);
										else {
											main.echo(`Saved attributes:`);
											main.echo(`${res.data.attr}`);
										}
									}
								});
							})();  
						})
					}

				break;

				case "read":
					if (!inSession()) {
						main.echo(`fatal: no samaritan initialized. See 'sam help'`);
					} else {
						// check argument conformance
						if (!arg2) {
							this.echo(`fatal: you must specifiy what to read`);
							this.echo(`usage: sam read <option>`);
						} else {
							switch (arg2) {
								case "--cred":
									if (!arg3)
										this.echo(`fatal: credential hash not specified. See 'sam help'`);
									else {
										this.echo(`quering network for data...`);
										this.pause();

										fetch (getURL(`read-data`, `arg1=${arg2}`, `arg2=${arg3}`, `nonce=${ getNonce() }`), {
											method: 'get',
											headers: {
												'Content-Type': 'application/json'
											}
										})
										.then(res => {
											(async function () {
												await res.json().then(res => {
													main.resume();
													
													if (res.error) 
														main.echo(`fatal: ${res.data.msg}`);
													else {
														main.echo(`hash: ${arg3} `);
														main.echo(`content: ${res.data.msg}`);
													}
												});
											})();  
										})
									}

									break;
							}
							
						}
					}

					break;

				case "enum":
					if (!inSession()) {
						main.echo(`fatal: no samaritan initialized. See 'sam help'`);
					} else {
						// check argument conformance
						if (!arg2) {
							this.echo(`fatal: you must specifiy what to list out`);
							this.echo(`usage: sam enum <option>`);
						} else {
							switch (arg2) {
								case "cred":
									this.echo(`quering network for data...`);
									this.pause();

									fetch (getURL(`fetch-list`, `arg=${arg2}`, `nonce=${ getNonce() }`), {
										method: 'get',
										headers: {
											'Content-Type': 'application/json'
										}
									})
									.then(res => {
										(async function () {
											await res.json().then(res => {
												main.resume();
												
												if (res.error) 
													main.echo(`fatal: ${res.data.msg}`);
												else {
													main.echo(`Credential list:`);
													for (var i = 0; i < res.data.creds.length; i++) {
														main.echo(`${i + 1}.`);
														main.echo(` credential hash -> ${res.data.creds[i].hash}`);
														main.echo(` credential content -> ${res.data.creds[i].content.join(`, `)}`);
													}
												}
											});
										})();  
									})

									break;
								
								default:
									this.echo(`option "${arg2} not recognized`);
							}
							
						}
					}

					break;

				case "chain":
					if (!inSession()) {
						main.echo(`fatal: no samaritan initialized. See 'sam help'`);
					} else {
						// parse command
						// parseCommandLine()

						switch (arg3.replace("--", "")) {
							case "ctype":
								this.echo(`creating cType...`);
								this.pause();

								fetch (getURL(`create-ctype`, `nonce=${ getNonce() }`, `chain=${ arg2.replace("--", "")}`, `cmd=${ arg3.replace("--", "") }`,
									`title=${ arg4.replace("--title=", "") }`, `attr=${ arg5.replace("--attr=", "") }`), {
									method: 'get',
									headers: {
										'Content-Type': 'application/json'
									}
								})
								.then(res => {
									(async function () {
										await res.json().then(res => {
											main.resume();
											
											if (res.error) 
												main.echo(`fatal: ${res.data.msg}`);
											else {
												main.echo(`cType ID: ${res.data.id}`);
												main.echo(`${res.data.msg}`);
											}
										});
									})();  
								})

							break;
						
							case "claim":
								this.echo(`creating your claim...`);
								this.pause();

								fetch (getURL(`create-claim`, `nonce=${ getNonce() }`, `chain=${ arg2.replace("--", "")}`, `ctype=${ arg4 }`), {
									method: 'get',
									headers: {
										'Content-Type': 'application/json'
									}
								})
								.then(res => {
									(async function () {
										await res.json().then(res => {
											main.resume();
											
											if (res.error) 
												main.echo(`fatal: ${res.data.msg}`);
											else {
												main.echo(`Credential hash: ${res.data.cred_id}`);
												main.echo(`${res.data.msg}`);
											}
										});
									})();  
								})

								break;

							case "attest":
								this.echo(`trying to create attestation...`);
								this.pause();

								fetch (getURL(`attest`, `nonce=${ getNonce() }`, `chain=${ arg2.replace("--", "")}`, `credHash=${ arg4 }`), {
									method: 'get',
									headers: {
										'Content-Type': 'application/json'
									}
								})
								.then(res => {
									(async function () {
										await res.json().then(res => {
											main.resume();
											
											if (res.error) 
												main.echo(`fatal: ${res.data.msg}`);
											else {
												main.echo(`${res.data.msg}`);
											}
										});
									})();  
								})

								break;

								case "verify":
									if (!inSession()) {
										main.echo(`fatal: no samaritan initialized. See 'sam help'`)
									} else {
										// check argument conformance
										if (!arg4 || !arg5) {
											this.echo(`fatal: you must provide a DID and credential hash`);
											this.echo(`usage: sam chain --kilt verify <DID>`);
										} else {
											// check did format
											if (!isDID(arg4)) {
												this.echo(`fatal: invalid DID format`);
												this.echo(`expected DID format: did:sam:root:<address>`);
											} else {
												this.echo(`performaing verification...`);
												this.pause();

												fetch (getURL(`verify-cred`, `nonce=${ getNonce() }`, `did=${ arg4 }`, `credHash=${ arg5 }`), {
													method: 'get',
													headers: {
														'Content-Type': 'application/json'
													}
												})
												.then(res => {
													(async function () {
														await res.json().then(res => {
															main.resume();
															
															if (res.error) 
																main.echo(`fatal: ${res.data.msg}`);
															else 
																main.echo(`${res.data.msg}`);
														});
													})();  
												})
											}
										}
									}

									break;

								case "revoke":
									if (!inSession()) {
										main.echo(`fatal: no samaritan initialized. See 'sam help'`)
									} else {
										// check argument conformance
										if (!arg3) {
											this.echo(`fatal: you must provide a DID and credential hash`);
											this.echo(`usage: sam chain --kilt verify <DID> <cHash>`);
										} else {
											this.echo(`processing...`);
											this.pause();

											fetch (getURL(`revoke-cred`, `nonce=${ getNonce() }`, `credHash=${ arg4 }`), {
												method: 'get',
												headers: {
													'Content-Type': 'application/json'
												}
											})
											.then(res => {
												(async function () {
													await res.json().then(res => {
														main.resume();
														
														if (res.error) 
															main.echo(`fatal: ${res.data.msg}`);
														else 
															main.echo(`${res.data.msg}`);
													});
												})();  
											})
										}
									}

									break;
						}					
					}

				break;

				default:
					this.echo(`sam: '${arg1}' is not a samaritan command. See 'sam help'.`);
			}
		},
	}, {
		greetings: function () {
			return greetings.innerHTML
		}, 

		name: 'samaritan',
		historySize: 10,
		checkArity:  false,
		prompt: '[[b;green;]>>> ]',
		onInit: function() {
			
		}
	});
});

function downloadObjectAsJson(exportObj, exportName){
	var dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(exportObj);
	var dn = document.createElement('a');
	
	dn.setAttribute("href",     dataStr);
	dn.setAttribute("download", exportName + ".jsonld");
	document.body.appendChild(dn); // required for firefox
	
	dn.click();
	dn.remove();
}

function qs(tag) {
	return document.querySelector(tag);
}

function inSession() {
	var exists = false;
	if (sessionStorage.getItem("nonce")) 
		exists = true;
	
	return exists;
}

function getNonce() {
	return sessionStorage.getItem("nonce");
}

function isDID(str) {
	if (str.indexOf("did:sam:root") == -1) 
		return false;
	
	return true;
}

function isJSONLink(str) {
	if (str.indexOf("http") == -1 || !str.endsWith(".json")) 
		return false;

	return true;
}

function isGoodURL(url) {
	let isErrorFree = true;

	// break it up
	let box = url.split("/");

	// first, the url must start with a DID URI
	if (!url.startsWith("did:sam:root:") || box.length != 4)
		isErrorFree = false;

	return isErrorFree;
}

function isGoodMode(mode) {
	for (var i = 0; i < mode.length; i++) 
		if (parseInt(mode[i]) > 7 || parseInt(mode[i] < 0))
			return false;
			
	return true;
}

function getURL() {
	let url = `\\${arguments[0]}?`;
	for (var i = 1; i < arguments.length; i++) 
		url += `${arguments[i]}&`;

	return url;
}

var printObj = function(obj) {
	var string = '';

	for(var prop in obj) {
		if(typeof obj[prop] == 'string') {
			string+= prop + ': ' + obj[prop]+'; \n';
		}
		else {
			string+= prop + ': { \n' + print(obj[prop]) + '}';
		}
	}

	return string;
}