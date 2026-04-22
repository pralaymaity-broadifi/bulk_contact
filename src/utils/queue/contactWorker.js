'use strict';

require('dotenv').config();
require('../../../system/configs/database');

const { Worker } = require('bullmq');
const connection = require('./redis');
const fs = require('fs');
const csv = require('csv-parser');
const XLSX = require('xlsx');
const mongoose = require('mongoose');

const { CalmError } = require('../../../system/core/CalmError');

// ✅ IMPORT YOUR SERVICES
const { isFuzzyDuplicate } = require('./fuzzyMatching');
const { enrichContact } = require('./enrichData');

const normalizeEmail = (email) => email?.toLowerCase().trim();

const BATCH_SIZE = 25;

/**
 * Wait until MongoDB is connected
 */
const waitForDB = async () => {
  if (mongoose.connection.readyState === 1) return;

  return new Promise((resolve) => {
    mongoose.connection.once('open', resolve);
  });
};

(async () => {

  await waitForDB();

  const worker = new Worker(
    'contact-queue',
    async (job) => {

      const { Contact } = require('../../modules/contact/contact.model');
      const ContactModel = new Contact().getInstance();

      console.log("JOB STARTED:", job.id);

      const filePath = job.data.filePath;
      const ext = filePath.split('.').pop();

      console.log("FILE:", filePath);

      let batch = [];
      let totalProcessed = 0;

      const processContact = async (row) => {

        const contact = {
          name: row.name || row.Name,
          email: row.email || row.Email,
          phone: row.phone || row.Phone,
          company: row.company || row.Company,
          normalizedEmail: normalizeEmail(row.email || row.Email)
        };

        // ❌ skip invalid rows
        if (!contact.name || !contact.email) return;

        // =====================================================
        // EXACT DUPLICATE CHECK (FAST)
        // =====================================================
        const existing = await ContactModel.findOne({
          normalizedEmail: contact.normalizedEmail
        });

        if (existing) {
          console.log("🔁 SKIPPED EXACT DUPLICATE:", contact.email);
          return;
        }

        // =====================================================
        // FUZZY MATCH CHECK
        // =====================================================
        const similarContactsFromDB = await ContactModel.find({
          company: contact.company
        }).limit(50); // keep small for performance

        const similarContactsFromBatch = batch.filter(
          b => b.company === contact.company
        );

        const similarContacts = [ ...similarContactsFromDB, ...similarContactsFromBatch ];

        console.log("COMPANY CHECK:", contact.company);
        console.log("SIMILAR FOUND:", similarContacts.length);

        const isDuplicate = isFuzzyDuplicate(contact, similarContacts);

        console.log("🔍 FUZZY RESULT:", {
          name: contact.name,
          isDuplicate
        });

        if (isDuplicate) {
          console.log("⚠️ FUZZY DUPLICATE:", contact.name);
          return;
        }

        // =====================================================
        // ENRICHMENT
        // =====================================================
        try {
          const enrichedData = await enrichContact();
          contact.enrichment = enrichedData;
        } catch (err) {
          console.log("⚠️ ENRICH FAILED:", contact.email);
        }

        // =====================================================
        // ADD TO BATCH
        // =====================================================
        batch.push(contact);

        // =====================================================
        // BATCH INSERT
        // =====================================================
        if (batch.length >= BATCH_SIZE) {

          await ContactModel.insertMany(batch);

          totalProcessed += batch.length;
          console.log("BATCH INSERTED:", totalProcessed);

          batch = [];
        }
      };

      return new Promise((resolve, reject) => {

        try {

          // ================= CSV =================
          if (ext === 'csv') {

            const stream = fs.createReadStream(filePath).pipe(csv());

            stream.on('data', async (row) => {
              stream.pause();
              try {
                await processContact(row);
              } finally {
                stream.resume();
              }
            });

            stream.on('end', async () => {
              try {

                if (batch.length > 0) {
                  await ContactModel.insertMany(batch);
                  totalProcessed += batch.length;
                }

                console.log("🎉 FINAL TOTAL:", totalProcessed);

                resolve({ total: totalProcessed });

              } catch (err) {
                reject(err);
              }
            });

            stream.on('error', reject);
          }

          // ================= XLSX =================
          else if (ext === 'xlsx') {

            const workbook = XLSX.readFile(filePath);
            const sheet = workbook.Sheets[ workbook.SheetNames[ 0 ] ];
            const rows = XLSX.utils.sheet_to_json(sheet);

            (async () => {
              try {

                for (const row of rows) {
                  await processContact(row);
                }

                // Final batch insert
                if (batch.length > 0) {
                  await ContactModel.insertMany(batch);
                  totalProcessed += batch.length;
                  console.log("FINAL BATCH INSERTED:", totalProcessed);
                }

                console.log("🎉 FINAL TOTAL:", totalProcessed);

                resolve({ total: totalProcessed });

              } catch (err) {
                reject(err);
              }
            })();

          } else {
            reject(new CalmError("", "Unsupported file format"));
          }

        } catch (err) {
          reject(err);
        }

      });

    },
    { connection }
  );

  worker.on('completed', (job) => {
    console.log("JOB COMPLETED:", job.id);
  });

  worker.on('failed', (job, err) => {
    console.log("JOB FAILED:", job?.id, err.message);
  });

  console.log("🚀 BullMQ Worker Running...");

})();
