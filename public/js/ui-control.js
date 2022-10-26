function qs(tag) {
    return document.querySelector(tag);
}

function ce(tag) {
    return document.createElement(tag);
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

function signal(a, e=0)
{
    // var m = qs('#message');
    var m = ce('div');
    m.id = "message";
    document.body.firstElementChild.appendChild(m);
    if (e) a = '<i class="fa fa-check"></i> ' + a;
    m.innerHTML = "<span id='m-inside' class='fs-130 shado'>" + a + "</span>";
    m.classList.remove("is-hidden");
    m.classList.remove("is-removed");
    m.classList.add('is-visible');
    setTimeout(function() {
        m.classList.remove("is-visible");
        m.classList.add("is-hidden");
        setTimeout(function() {
            m.classList.add("is-removed");
            m.innerHTML = "";
        }, 2000);
    },
    3000);
}

document.body.addEventListener("click", (e) => {
    if (e.target.classList.contains("import-sam")) {
        if (qs(".mnemonics").value) {
            // send to server for initialization
            signal("initializing...");

            fetch ("/init", {
                method: 'post',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    "keys": qs(".mnemonics").value
                })
            })
            .then(res => {
                (async function () {
                    await res.json().then(res => {
                        qs(".mnemonics").value = "";
                        if (res.error) 
                            signal(`fatal: ${res.data.msg}`);
                        else {
                            // set nonce for further communication
                            sessionStorage.setItem("nonce", res.data.nonce);

                            signal(`${res.data.msg}`);
                        }

                    });
                })();  
            })
        }
    } else if (e.target.classList.contains("create-sam")) {
        if (qs(".sam-name-0").value) {
            // send to server for initialization
            signal("Creating your Samaritan...");

            fetch ("/new", {
                method: 'post',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    "name": qs(".sam-name-0").value
                })
            })
            .then(res => {
                (async function () {
                    await res.json().then(res => {
        
                        if (res.error) 
                            signal(`fatal: ${res.data.msg}`);
                        else {
                            // set nonce for further communication
                            sessionStorage.setItem("nonce", res.data.nonce);

                            qs(".sam-name").innerText = qs(".sam-name-0").value;
                            qs(".sam-did").innerText = res.data.did;
                            qs(".res-keys").innerText = `${res.data.seed}`;
                            signal("You have 30 seconds to copy your keys");


                            setTimeout(() => {
                                qs(".res-keys").innerText = "";
                                signal("samaritan successfully added to the network");
                            }, 30000);
                        }
                    });
                })();  
            })
        } else 
            signal("Please specify the name of your Samaritan");

    } else if (e.target.classList.contains("sam-file-upload-btn")) {
        if (inSession()) {
            const file = document.querySelector(`.sam-file`).files[0];
            const reader = new FileReader();

            reader.addEventListener("load", (e) => {
                let data = new FormData();
                const blob = new Blob([new Uint8Array(e.target.result)], { type: file.type });

                data.append("scope", qs(".sam-file-scope").value);
                data.append("name", qs(".sam-file-name").value);
                data.append("about", qs(".sam-file-about").value);
                data.append("nonce", getNonce());
                data.append("file_name", document.querySelector(`.sam-file`).files[0].name);
                data.append("file", blob);

                // send the result to the server
                fetch ("/upload", {
                    method: 'post',
                    body: data
                })
                .then(res => {
                    (async function () {
                        await res.json().then(res => {
                            if (res.error) 
                                signal(`fatal: ${res.data.msg}`);
                            else {
                                signal("You data has been uploaded to the internet.");
                                let p = ce('p');
                                p.innerText = `URL: ${res.data.url}`;
                                qs(".logz").appendChild(p);
                            }
                        });
                    })();  
                });
            }, false);


            if (file) 
                reader.readAsArrayBuffer(file);

        } else
            signal("Initialize your Samaritan to continue");
    }
    
}, false);