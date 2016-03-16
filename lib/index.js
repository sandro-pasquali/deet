'use strict';

let fs = require('fs');
let Path = require('path');
let os = require('os');
let _ = require('lodash');
let Strategist = require('strategist');
let Promise = require('bluebird');
let Busboy = require('busboy');
let bodyParser = require('body-parser');
let helmet = require('helmet');
let xssFilters = require('xss-filters');
let hpp = require('hpp')();

let jsonbody = bodyParser.json({
    strict: false
});

module.exports = (opts) => {

    // Configure general options on initialization
    // TODO: options for setting maximums (payload size, fields, etc)
    //
    if(!_.isPlainObject(opts || {})) {
        throw new Error('deet constructor received non-Object as argument');
    }

    // Simple id counter. See returned function at bottom.
    //
    let schemaCount = 1;

    // We generally want to validate all JSON entering the system.
    // By default we don't check uploaded files that are JSON.
    // If you want to also include uploads as part of the
    // JSONSchema validation step, set this to true.
    //
    let validateUploadedJSON = false;

    // Whether route tokens (req#params) AND query parameters (req#query)
    // are run through an XSS sanitizer.
    //
    // @see #parseOtherIfAny
    //
    let sanitizeURLEncoded = !!opts.sanitizeURLEncoded || false;

    // https://github.com/analog-nico/hpp
    //
    let hppProtection = _.isUndefined(opts.hppProtection) ? true : !!opts.hppProtection;

    // This should be an Express #app
    //
    let app = opts.app;

    if(!app) {
        throw new Error('You must pass #app argument to @deet');
    }

    let useMultipartParser = _.isUndefined(opts.useMultipartParser)
                                ? true
                                : !!opts.useMultipartParser;

    let tempUploadFolder = opts.tempUploadFolder || os.tmpDir();

    let fileFilter = _.isFunction(opts.fileFilter) ? opts.fileFilter : false;

    // TODO: test how this affects downloads!
    // http://blogs.msdn.com/b/ie/archive/2008/07/02/ie8-security-part-v-comprehensive-protection.aspx
    //app.use(helmet.ieNoOpen())

    // TODO: Does our server always set the right mimetype? if so, use this.
    //
    // app.use(helmet.noSniff());

    // Removes the X-Powered-By header from responses.
    //
    (_.isUndefined(opts.hidePoweredBy) || !!opts.hidePoweredBy) && app.disable('x-powered-by');

    // Configure @helmet XSS options.
    //
    if(opts.xssFilters || _.isPlainObject(opts.xssCSP) || opts.xFrame) {

        // Enable @helmet XFrame protections
        //
        opts.xFrame
        && ~['deny','sameorigin','allow-from'].indexOf(opts.xFrame)
        && app.use(helmet.xframe(opts.xFrame));

        // Configure @helmet to set the X-XSS-Protection header
        //
        !!opts.xssFilter && app.use(helmet.xssFilter());

        // Configure @helmet options for Content Security Policy
        // http://content-security-policy.com/
        //
        // TODO: need to filter in cases of 'none' and '*'
        //
        opts.xssCSP && app.use(helmet.csp(['defaultSrc','scriptSrc','styleSrc','imgSrc','connectSrc','fontSrc','objectSrc','mediaSrc','frameSrc']
            .reduce(function(prev, next) {

                // For each of the @helmet CSP properties concatenate any
                // sent Array of rules into a space-separated string and
                // reduce to a map satisfying the @helmet#csp interface.
                //
                prev[next] = [].concat(opts.xssCSP[next] || []).join(' ');

                return prev;

            }, {})));
    }

    // Whether the key for the schema should be derived from the route definition.
    // e.g. if the bound route is /user/:first/:last and is a GET, the key
    // is `<req.method>_<encodeURIComponent(req.route.path)>`
    //
    let useRouteAsKey = _.isUndefined(opts.useRouteAsKey) ? false : !!opts.useRouteAsKey;

    // TODO: add busboy limits
    //
    let limits = opts.limits || {};

    // If #useValidator is not set, a default will be used by Strategist
    //
    let strategist = Strategist({
        useValidator: opts.useValidator
    });

    function parseOtherIfAny(req) {

        let po = (prev, next) => {
            prev[next] = xssFilters.inHTMLData(prev[next]);
            return prev;
        };

        return new Promise((resolve) => {

            hppProtection && hpp(req, {}, _.identity);

            if(sanitizeURLEncoded) {
                Object.keys(req.params).reduce(po, req.params);
                Object.keys(req.query).reduce(po, req.query);
            }

            jsonbody(req, {}, () => {
                resolve(_.merge({}, req.body, req.params, req.query));
            })
        });
    }

    function getMultipartIfAny(req) {

        if(!useMultipartParser) {
            return Promise.resolve({});
        }

        return new Promise((resolve, reject) => {

            let fieldJSON = {};

            try {

                let busboy = new Busboy({
                    headers: req.headers
                });

                busboy.on('file', (fieldname, filestream, filename, encoding, mimetype) => {

                    req.files = {
                        rejected : [],
                        file : {
                            fieldName : fieldname,
                            mimetype : mimetype,
                            originalname : filename,
                            encoding : encoding,
                            size : 0,
                            contentLength : req.headers['content-length'],
                            destination : tempUploadFolder,
                            filename : filename,
                            name: filename, // for convenience
                            path : Path.join(tempUploadFolder, filename),
                            extension : Path.extname(filename)
                        }
                    };

                    // Skip files that don't satisfy #fileFilter
                    //
                    if(fileFilter && !fileFilter(req.files.file, req.headers)) {

                        req.files.rejected.push(`${fieldname}~~${filename}`);
                        req.files.file = null;

                        return filestream.resume();
                    }

                    filestream.on('data', function(data) {

                        // #data is a Buffer.
                        //
                        req.files.file.size += data.length;
                    });

                    filestream.pipe(fs.createWriteStream(req.files.file.path));

                });
                busboy.on('field', function(fieldname, val, fieldnameTruncated, valTruncated) {

                    fieldJSON[fieldname] = val;
                });
                busboy.on('finish', function() {

                    // This is where we fetch JSON uploads...
                    //
                    let fileJSON = {};

                    resolve(_.merge({}, fileJSON, fieldJSON));
                });
                busboy.on('error', function(err) {

                    reject(err);
                })

                req.pipe(busboy);

            } catch(e) {
                resolve({});
            }
        })
    }

    function schemaApiMain(req, res, done) {

        getMultipartIfAny(req)
        .bind(this)
        .then(function(mpJSON) {

            req.validJSON = _.merge({}, mpJSON);

            return parseOtherIfAny(req);

        })
        .then(function(otherJSON) {

            req.validJSON = _.merge(req.validJSON, otherJSON);

            // If there is no schema to validate we're done.
            // This is typically true when @deet is used as middleware
            // e.g. app.use(deet()) <-- notice: no schema
            //
            if(!this.schema) {
                return done();
            }

            // Validate JSONSchema
            //
            let sKey;

            // Schemas are compiled on first request
            //
            if(!this.compiledSchema) {

                // Schemas are stored using a key. Which key?
                //
                if(useRouteAsKey) {
                    sKey = `${req.method}_${encodeURIComponent(req.originalUrl)}`;
                } else {
                    sKey = `k_${++schemaCount}`;
                }

                this.compiledSchema = strategist.set(sKey, this.schema);
            }

            if(this.compiledSchema(req.validJSON)) {
                return done();
            };

            // Null invalid JSON
            //
            req.validJSON = null;

            res.status(400).json(this.compiledSchema.errors);

        })
        .catch(done);
    }

    return function schemaApiCaller(schema) {

        return schemaApiMain.bind({
            schema : schema,
            compiledSchema: null
        });
    }
};