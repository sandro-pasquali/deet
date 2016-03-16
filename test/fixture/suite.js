'use strict';

let fs = require('fs');
let Path = require('path');

module.exports = {
    sampleSchema : require(Path.resolve(__dirname, '../assets/sampleschema.json')),
    goodSample : {
        firstName: 'Jack',
        lastName: 'Spratt',
        age: 33
    },

    // #age should be Integer
    //
    badSample : {
        firstName: 'Jack',
        lastName: 'Spratt',
        age: '33'
    }
}