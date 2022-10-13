
		jQuery(function($, undefined) {
            var main = $('body').terminal({
				sam: function(arg1="", arg2="", arg3="", arg4="") {
					switch (arg1) {
						case "help": 
						case "":
							this.echo(`Samaritan v0.0.5`);
							this.echo(`Usage: sam <command> [arg1] [arg2] [arg3] [arg4]`);
							this.echo(`These are common Samaritan commands used in various situations:`);
							this.echo(`new <name>			creates a new Samaritan with a non-unique name`);
							this.echo(`init <keys>			lets your Samaritan take control of the terminal`);
							break;
						
						case "new":
							// check argument conformance
							if (!arg2) {
								this.echo(`fatal: You must provide a name for your Samaritan`);
								this.echo(`usage: sam new <name>`);
							}
							this.echo(`Creating your Samaritan...`);
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
												main.echo("Samaritan successfully added to the network").resume();
											}, 30000);
										}

									});
								})();  
							})
							
							break;
						case "init":
							// check argument conformance
							if (!arg2) {
								this.echo(`fatal: You must provide your Samaritan keys`);
								this.echo(`usage: sam init <keys> e.g sam init "bake egypt below..."`);
							}
							
					}
				},
			}, {
				greetings: function () {
					return greetings.innerHTML
				}, 

                name: 'Samaritan',
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