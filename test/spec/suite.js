'use strict';

let fs = require('fs');
let util = require('util');
let Path = require('path');
let superagent = require('superagent-bluebird-promise');
let debug = require('debug')('test');

module.exports = function(test, Promise) {

    let goodSample = this.goodSample;
    let badSample = this.badSample;
    let sampleSchema = this.sampleSchema;
    let server = this.express.server;

    test.ok(this.express.server, 'Received Express server');
    test.ok(this.express.app, 'Received Express app');

    return Promise.resolve()
    .then(() => {

        return superagent
        .get('localhost:2112')
        .promise()
        .catch((err) => {
            test.fail(util.format('Cannot get test index.html page: %s %s', err.message, JSON.stringify(err.originalError)));
        });
    })
    .then((result) => {

        test.pass('Got test index.html page');

        return superagent
        .post('localhost:2112')
        .set('Content-Type', 'application/json')
        .send(goodSample)
        .promise()
        .catch((err) => {
            test.fail('Incorrectly failed goodSample (or server error?)', JSON.stringify(err));
        });

    })
    .then((response) => {

        test.deepEqual(response.body, goodSample, 'Correctly validated goodSample');

        return superagent
        .post('localhost:2112')
        .set('Content-Type', 'application/json')
        .send(badSample)
        .promise()
        .catch((err) => {
            test.pass(util.format('Correctly rejected badSample: (%s) %s', err.status, JSON.stringify(err.body)));
        });
    })
    .then((response) => {

        if(response) {
            test.fail('Should not have validated badSample');
        }

        return superagent
        .get('localhost:2112/test/mary/poppins')
        .promise()
        .catch((err) => {
            test.fail(util.format('Cannot GET GOOD /test/route: %s %s', err.message, JSON.stringify(err.originalError)));
        });
    })
    .then((response) => {

        test.ok(response.body, 'Correctly validated using route lets :firstName/:lastName');

        return superagent
        .get('localhost:2112/test/3/poppins')
        .promise()
        .catch((err) => {
            test.pass(util.format('Integer in :firstname correctly caused rejection of JSON: (%s) %s', err.status, JSON.stringify(err.body)));
        });
    })
    .then((response) => {

        if(response) {
            test.fail('Should not have validated :firstName/:lastName');
        }

        return superagent.get('localhost:2112/test?no=<schema>');
    })
    .then((response) => {

        // Note escaping of sent data
        //
        test.deepEqual(response.body, {'no':'&lt;schema>'}, 'Non-schematized routes still benefit from use(deet()) middleware');

        // Test #hppProtection
        // #hppProtection should convert {array: [1,2]} into {array: 2}
        //
        return superagent.get('localhost:2112/test?array=1&foo=2&array=2');
    })
    .then((response) => {

        test.deepEqual(response.body, {
            array: '2', // NOT array: [1,2]
            foo: '2'
        }, '#hppProtection is working');

        return superagent.get('localhost:2112/test?foo=<script>');
    })
    .then((response) => {

        // Note escaping of sent data
        //
        test.ok(response.body.foo === '&lt;script>', '#xssFilter is working');

        return superagent
        .post('localhost:2112/upload')
        .attach(
            'sampleUpload',
            Path.resolve(__dirname, '../assets/sampleschema.json'),
            'sample.json'
        ).promise()
        .catch((err) => {
            test.fail(util.format('Cannot complete file upload: %s %s', err.message, JSON.stringify(err.originalError)));
        })
    })
    .then((response) => {

        if(!response.body) {
            return test.fail('File upload returned without errors, but no response.body present. Is #useMultipartParser set to false?');
        }

        return new Promise((resolve) => {

            // Unlink any uploaded folder. This also is used to
            // test if the file exist in the /tmp folder as expected.
            //
            let stats = fs.unlink(response.body.file.path, (err) => {
                if(err) {
                    test.fail('File upload failure -> cannot target file in tmp directory: ' + err.message);
                } else {
                    test.pass('File uploads are being handled correctly');
                }
                resolve();
            });
        });
    })
    .catch(debug)
    .finally(() => {

        test.pass('Shutting down Express server');

        server.close();

    });
};