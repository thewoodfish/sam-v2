
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
							this.echo(`find <DID>			confirm if samaritan exists and returns DID document`);
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
									this.echo(`initializing your samaritan...`);
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