'use strict';

const amqp = require("amqplib");
const { v4: uuidv4 } = require("uuid");

class QueueProducer {

  async send(filePath) {

    const connection = await amqp.connect("amqp://localhost");
    const channel = await connection.createChannel();

    const queue = "contact_queue";

    await channel.assertQueue(queue, { durable: true });

    const jobId = uuidv4();

    const payload = { jobId, filePath };

    channel.sendToQueue(queue, Buffer.from(JSON.stringify(payload)), {
      persistent: true
    });

    return jobId;
  }
}

module.exports = new QueueProducer();
