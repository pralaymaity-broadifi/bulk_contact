'use strict';

const { Worker } = require('bullmq');
const connection = require('./redis');
const fs = require('fs');
const csv = require('csv-parser');
const { Contact } = require('../../modules/contact/contact.model');

const ContactModel = new Contact().getInstance();

const normalizeEmail = (email) => {
  return email?.toLowerCase().trim();
};

const worker = new Worker(
  'contact-queue',
  async (job) => {

    console.log("JOB STARTED:", job.id);

    const filePath = job.data.filePath;

    const contacts = [];

    return new Promise((resolve, reject) => {

      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => {
          contacts.push({
            name: row.name,
            email: row.email,
            phone: row.phone,
            company: row.company,
            normalizedEmail: normalizeEmail(row.email)
          });
        })
        .on('end', async () => {
          try {
            await ContactModel.insertMany(contacts);
            resolve({ total: contacts.length });
          } catch (err) {
            reject(err);
          }
        })
        .on('error', reject);

    });

  },
  { connection }
);



worker.on('completed', (job) => {
  console.log("DONE:", job.id);
});

console.log("🚀 BullMQ Worker Running...");
