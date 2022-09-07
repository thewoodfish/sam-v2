// imports
const express = require('express');
const app = express();
const port = 3000;


// static files
app.use(express.static('public'));
app.use('/css', express.static(__dirname + 'public/css'));
app.use('/js', express.static(__dirname + 'public/js'));
app.use('/img', express.static(__dirname + 'public/img'));

// set views
app.set('views', './views');
app.set('view engine', 'ejs')


// main functions

// check if the CID or pseudoname exists onchain
async function verifyExistence(req, res) {

}







 
app.get('', (req, res) => {
    res.render('terminal', { text: 'This is EJS' })
})

// check if the DID or pseudoname exists onchain
app.get('/verify', (req, res) => {
    verifyExistence(req.body, res);
})

// listen on port 3000
app.listen(port, () => console.info(`Listening on port ${port}`));