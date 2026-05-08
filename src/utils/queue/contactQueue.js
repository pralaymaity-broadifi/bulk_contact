'use strict';

const { Queue } = require('bullmq');
const { redisConnectionOptions } = require('../redis');


// You add job like this contactQueue.add(...)
// Worker reads from Redis new Worker('contact-queue', ...)
// BullMQ queue DOES NOT WORK without Redis

const contactQueue = new Queue('contact-queue', {
  connection: redisConnectionOptions
});

module.exports = { contactQueue };
