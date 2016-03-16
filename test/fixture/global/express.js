'use strict';

// A global fixture that creates an Express server that exercises #deet
//

let fs = require('fs');
let Path = require('path');
let os = require('os');
let express = require('express');
let app = express();

let deet = require('../../../lib')({
    validator: 'ajv',
    useMultipartParser : true,
    tempUploadFolder: os.tmpDir(),
    fileFilter : (fileinfo, headers) => { // accept all files
        return true;
    },
    app: app,
    sanitizeURLEncoded : true,
    hidePoweredBy : true,
    hppProtection : true,
    xFrame : 'deny',
    xssFilter : true,
    xssCSP : {
		defaultSrc: ["'unsafe-inline'"],
		scriptSrc: ["*.localhost:2112 'unsafe-inline'"],
		styleSrc: ["'unsafe-inline'"],
		imgSrc: [],
		connectSrc: ["*"],
		fontSrc: [],
		objectSrc: [],
		mediaSrc: [],
		frameSrc: ["'deny'"]
	}
});

app.use(deet());

let sampleSchema = require('../../assets/sampleschema.json');

app.post('/', deet(sampleSchema), (req, res) => {

    res.status(200).json(req.validJSON);
});

app.get('/test/:firstName/:lastName', deet(sampleSchema), (req, res) => {

    res.status(200).json(req.validJSON);
});

app.get('/test', (req, res) => {

    res.status(200).json(req.validJSON);
});

app.get('/jquery', (req, res) => {

    fs.createReadStream('test/assets/jquery.min.js').pipe(res);
});

app.post('/upload', (req, res) => {

    res.status(200).json(req.files);
});

app.get('/', (req, res) => {

    res.writeHead(200, {
        Connection: 'close'
    });
    fs.createReadStream('test/assets/form.html').pipe(res);
});

let server = app.listen(2112, () => {
    console.log('Server listening on 2112');
});

// We're going to close this server in the test
//
module.exports = {
    express : {
        server: server,
        app: app
    }
};