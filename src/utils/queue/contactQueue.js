'use strict';

const { Queue } = require('bullmq');
const connection = require('./redis');

const contactQueue = new Queue('contact-queue', {
  connection
});

module.exports = contactQueue;
