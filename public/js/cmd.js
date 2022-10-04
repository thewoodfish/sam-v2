
		jQuery(function($, undefined) {
            var main = $('body').terminal({
				create: function(data) {
					this.echo("Verifying name uniqueness onchain...");
					this.pause();

					fetch ("/verify", {
						method: 'post',
						headers: {
							'Content-Type': 'application/json'
						},
						body: JSON.stringify({
							'name': data,
						})
					})
					.then(res => {
						(async function () {
							await res.json().then(res => {
								// if name is/isn't recognized
								if (JSON.parse(res.data)[1]) {
									main.resume();
									main.echo(`The name [[b;blue;]"${data}"] has been taken by someone else. Kindly select another name :)`);
								} else {
									// attempt to create samaritan
									main.echo("Creating your Samaritan...");

									fetch ("/create", {
										method: 'post',
										headers: {
											'Content-Type': 'application/json'
										},
										body: JSON.stringify({
											"name": data
										})
									})
									.then(res => {
										(async function () {
											await res.json().then(res => {
												main.resume();

												// save did to localstorage
												localStorage["sam_did"] = res.data.did;
												localStorage["keys"] = res.data.keys;

												main.echo(`Samaritan created! Technical Details: `);
												main.echo(`Name: [[b;blue;]"${res.data.name}"]`);
												main.echo(`DID: [[b;blue;]"${res.data.did}"]`);
												main.echo(`DID Document IPFS CID: [[b;blue;]"${res.data.doc_cid}"]`);
												main.echo(`Samaritan Keys: [[b;blue;]"${res.data.keys}"] ([[b;red;] You have 30 seconds to copy them.])`);

												main.pause();
												setTimeout(() => {
													main.update(-1, "Samaritan Keys: [[b;blue;]**************************************************************************************]").resume();
												}, 30000);
											});
										})();  
									})
								}
							});
						})();  
					});
				},

				verify: function(name) {
					// verify if samaritan exists on the network
					this.echo(`Checking for existence of "${name}"...`);
					this.pause();

					fetch ("/verify", {
						method: 'post',
						headers: {
							'Content-Type': 'application/json'
						},
						body: JSON.stringify({
							'name': name,
						})
					})
					.then(res => {
						(async function () {
							await res.json().then(res => {
								main.resume();
								
								if (JSON.parse(res.data)[1]) 
									main.echo(`[[b;blue;]"${name}"] exists on the network`);
								else 
									main.echo(`[[b;blue;]"${name}"] does not exist on the network`);
							})
						})()
					})
				},

				acred: function(link) {
					// submit to network or spin up modal
					if (link.indexOf("https") == -1)
						// upload JSON-ld document to register website access
						qs(".web-upload-1").classList.remove("hidden");
					else {
						// send the link
						this.echo(`Adding credential to the network...`);
						this.pause();

						fetch ("/add-credential", {
							method: 'post',
							headers: {
								'Content-Type': 'application/json'
							},
							body: JSON.stringify({
								'did': localStorage['sam_did'],
								'keys': localStorage["keys"],
								'data': link,
								'is_link': true
							})
						})
						.then(res => {
							(async function () {
								await res.json().then(res => {
									main.resume();
									main.echo(`Verifiable credential[subject: ${res.data[1]}] successfully added to the network`);
								})
							})()
						})
					}
				},

				lcred: function(sam) {
					// send the link
					this.echo(`Retrieving credentials from network...`);
					this.pause();

					let is_auth = false;

					if (sam == "i") {
						sam = localStorage['sam_did'];
						is_auth = true;
					}

					fetch ("/list-credentials", {
						method: 'post',
						headers: {
							'Content-Type': 'application/json'
						},
						body: JSON.stringify({
							'id': sam,
							"is_auth": is_auth
						})
					})
					.then(res => {
						(async function () {
							await res.json().then(res => {
								main.resume();
								main.echo("Verifiable Credentials list: ");

								for (var i = 0; i < res.data.length; i++) 
									main.echo(`${i + 1}. [[b;blue;]${res.did}/vc/${res.data[i]}]`);
								
							})
						})()
					})
				},

				assert: function(url) {
					// send the link
					this.echo(`Asserting credential ${url}...`);
					this.pause();

					fetch ("/assert", {
						method: 'post',
						headers: {
							'Content-Type': 'application/json'
						},
						body: JSON.stringify({
							'url': url,
							'did': localStorage['sam_did'],
							'keys': localStorage["keys"]
						})
					})
					.then(res => {
						(async function () {
							await res.json().then(res => {
								main.resume();
								
								console.log(res);
							})
						})()
					})
				},

				help: function() {
					this.echo("[[b;blue;]Samaritan 0.0.1. A digital Identity Solution (c) 2022]");	
					this.echo("The following commands are currently supported by the Samaritan terminal: ");
					this.echo("[[b;blue;]create { Samaritan name }]: Adds a new Samaritan to the network.");
					this.echo("[[b;blue;]verify { Samaritan name/DID }]: Verifies if Samaritan exists on the network.");
					this.echo("[[b;blue;]acred { JSON-link | m }]: Adds a credential to your Samaritan. The [JSON-link] is optional");
					this.echo("[[b;blue;]lcred { Samaritan name | i }]: Retrieves and list credentials (will only show public credentials for other Samaritans");
					this.echo("[[b;blue;]assert { Credential URL }]: Asserts a credential");
				},

			}, {
				greetings: function () {
					return greetings.innerHTML
				}, 

                name: 'Samaritan',
				historySize: 10,
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