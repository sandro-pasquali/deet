'use strict';

require('surveyor')({
    testDir: __dirname,
    globalFixtures : [
        'global/express'
    ],
    exitOnFinish: true
});
