
		jQuery(function($, undefined) {
            var main = $('body').terminal({
				sam: function(arg1="", arg2="", arg3="", arg4="") {
					switch (arg1) {
						case "help": 
						case "":
							this.echo(`samaritan v0.0.5`);
							this.echo(`Usage: sam <command> [arg1] [arg2] [arg3] [arg4]`);
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
							this.echo(`revoke <DID>        removes a samaritan from your trust quorum`);
							this.echo(`pull <link>         fetches a JSON credential and adds it to the network`);
							break;
						
						case "new":
							// check argument conformance
							if (!arg2) {
								this.echo(`fatal: You must provide a name for your samaritan`);
								this.echo(`usage: sam new <name>`);
							} else {
								this.echo(`creating your samaritan...`);
								this.pause();

								fetch ("/new", {
									method: 'post',
									headers: {
										'Content-Type': 'application/json'
									},
									body: JSON.stringify({
										"name": arg2
									})
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

												main.echo(`DID:     ${res.data.did}`);
												main.echo(`Keys:    ${res.data.seed} ([[b;red;] You have 30 seconds to copy them.])`);

												main.pause();
												setTimeout(() => {
													main.update(-1, "Keys:    ****************************************************************************************************");
													main.echo("samaritan successfully added to the network").resume();
												}, 30000);
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
								if (arg2.split(" ").length != 12) {
									this.echo(`fatal: invalid number of mnemonic`);
								} else {
									// clear seeds
									this.clear();
									this.echo(`initializing samaritan...`);
									this.pause();

									fetch ("/init", {
										method: 'post',
										headers: {
											'Content-Type': 'application/json'
										},
										body: JSON.stringify({
											"keys": arg2
										})
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

										fetch ("/find", {
											method: 'post',
											headers: {
												'Content-Type': 'application/json'
											},
											body: JSON.stringify({
												"did": did
											})
										})
										.then(res => {
											(async function () {
												await res.json().then(res => {
													main.resume();

													// continue
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

									fetch ("/rename", {
										method: 'post',
										headers: {
											'Content-Type': 'application/json'
										},
										body: JSON.stringify({
											"name": arg2,
											"nonce": getNonce()
										})
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

								fetch ("/change-status", {
									method: 'post',
									headers: {
										'Content-Type': 'application/json'
									},
									body: JSON.stringify({
										"cmd": "disable",
										"nonce": getNonce()
									})
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

								fetch ("/change-status", {
									method: 'post',
									headers: {
										'Content-Type': 'application/json'
									},
									body: JSON.stringify({
										"cmd": "enable",
										"nonce": getNonce()
									})
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

								fetch ("/describe", {
									method: 'post',
									headers: {
										'Content-Type': 'application/json'
									},
									body: JSON.stringify({
										"nonce": getNonce()
									})
								})
								.then(res => {
									(async function () {
										await res.json().then(res => {
											main.resume();
											
											if (res.error) 
												main.echo(`fatal: ${res.data.msg}`);
											else 
												main.echo(`${res.data.msg}`);
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

								fetch ("/refresh", {
									method: 'post',
									headers: {
										'Content-Type': 'application/json'
									},
									body: JSON.stringify({
										"nonce": getNonce()
									})
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

								fetch ("/exit", {
									method: 'post',
									headers: {
										'Content-Type': 'application/json'
									},
									body: JSON.stringify({
										"nonce": getNonce()
									})
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

										fetch ("/trust", {
											method: 'post',
											headers: {
												'Content-Type': 'application/json'
											},
											body: JSON.stringify({
												"did": arg2,
												"nonce": getNonce()
											})
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

								fetch ("/enum-quorum", {
									method: 'post',
									headers: {
										'Content-Type': 'application/json'
									},
									body: JSON.stringify({
										"nonce": getNonce()
									})
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
													if (res.data.list[i].indexOf("did:sam:root") != -1)
														main.echo(`      ${res.data.list[i+1]} - ${res.data.list[i]}`)
												main.echo(`${res.data.list.length / 2} members retrieved.`)
											}
											
										});
									})();  
								})
							}

							break;

						case "revoke":
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

										fetch ("/revoke", {
											method: 'post',
											headers: {
												'Content-Type': 'application/json'
											},
											body: JSON.stringify({
												"did": arg2,
												"nonce": getNonce()
											})
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
								setTimeout(main.echo("assigning new mnemonics..."), 7000);

								this.pause();

								fetch ("/rotate", {
									method: 'post',
									headers: {
										'Content-Type': 'application/json'
									},
									body: JSON.stringify({
										"nonce": getNonce()
									})
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
													if (res.data.list[i].indexOf("did:sam:root") != -1)
														main.echo(`      ${res.data.list[i+1]} - ${res.data.list[i]}`)
												main.echo(`${res.data.list.length / 2} members retrieved.`)
											}
											
										});
									})();  
								})
							}

							break;

						case "pull":
							if (!inSession()) {
								main.echo(`fatal: no samaritan initialized. See 'sam help'`)
							} else {
								// check argument conformance
								if (!arg2) {
									this.echo(`fatal: you must provide a URL to a JSON file`);
									this.echo(`usage: sam pull <link>`);
								} else {
									// check did format
									if (!isJSONLink(arg2)) {
										this.echo(`fatal: invalid URL specified`);
									} else {
										this.echo(`processing...`);
										this.pause();

										fetch ("/pull", {
											method: 'post',
											headers: {
												'Content-Type': 'application/json'
											},
											body: JSON.stringify({
												"url": arg2,
												"nonce": getNonce()
											})
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
			if (str.indexOf("http") == -1 || str.indexOf(".json") == -1) 
				return false;
		
			return true;
		}