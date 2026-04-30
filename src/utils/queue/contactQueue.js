'use strict';

const { Queue } = require('bullmq');
const { redisConnectionOptions } = require('../redis');

const contactQueue = new Queue('contact-queue', {
  connection: redisConnectionOptions
});

module.exports = { contactQueue };
