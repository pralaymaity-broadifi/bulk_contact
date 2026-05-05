'use strict';

require('dotenv').config();
require('../../../system/configs/database');

const { Worker } = require('bullmq');
const { redisConnectionOptions } = require('../redis');
const redis = require('../redis');
const fs = require('fs');
const csv = require('csv-parser');

const mongoose = require('mongoose');

const { CalmError } = require('../../../system/core/CalmError');

const { getMatchResult } = require('./fuzzyMatching');
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

            console.log(`JOB ${job.id} FILE:`, job.data.filePath);

            const { Contact } = require('../../modules/contact/contact.model');
            const ContactModel = new Contact().getInstance();

            // ================= FIX START =================

            const filePath = job.data.filePath;
            const rows = job.data.rows;

            const type = job.data.type;

            const isCSV = type === "csv" && typeof filePath === "string";
            const isXLSX = type === "xlsx" && Array.isArray(rows);

            console.log(" DETECTED JOB TYPE:", {
                type,
                hasFilePath: !!filePath,
                hasRows: Array.isArray(rows)
            });

            // ================= FIX END =================

            let batch = [];
            let totalProcessed = 0;

            //  NEW: DB tracking counters
            let totalInserted = 0;
            let totalSkipped = 0;

            //  NEW: batch cache by company (performance fix)
            //  Map() object, a collection of key-value pairs that maintains the original insertion order
            // we create a memory box
            const batchCompanyMap = new Map();

            const processContact = async (row) => {

                const contact = {
                    name: row.name || row.Name,
                    email: row.email || row.Email,
                    phone: row.phone || row.Phone,
                    company: row.company || row.Company,
                    normalizedEmail: normalizeEmail(row.email || row.Email)
                };

                if (!contact.name || !contact.email) return;

                // Check for exact duplicate normalizedEmail in DB
                const existing = await ContactModel.findOne({
                    normalizedEmail: contact.normalizedEmail
                });

                if (existing) {
                    console.log("SKIPPED EXACT DUPLICATE:", contact.email);
                    totalSkipped++;
                    return;
                }

                // Get similar contacts from DB (same company)
                const similarContactsFromDB = await ContactModel.find({
                    company: contact.company
                }).limit(50);

                // Get already processed contacts in current batch (same company)
                const similarContactsFromBatch = batchCompanyMap.get(contact.company) || [];


                // Every time you process a contact, you need to compare it with:
                // existing DB contacts
                // AND recently processed contacts (in same batch)

                const result = getMatchResult(contact, [
                    ...similarContactsFromDB,
                    ...similarContactsFromBatch
                ]);

                console.log("FUZZY RESULT ==:", result);

                if (result.action === "SKIP") {
                    totalSkipped++;
                    return;
                }

                if (result.action === "FLAG") {
                    contact.duplicateStatus = "POSSIBLE";
                    contact.duplicateScore = result.score;
                    contact.duplicateConfidence = result.confidence;
                }

                if (result.action === "INSERT") {
                    contact.duplicateStatus = "NONE";
                    contact.duplicateScore = result.score;
                    contact.duplicateConfidence = result.confidence;
                }

                try {
                    contact.enrichment = await enrichContact();
                } catch (err) {
                    console.log("ENRICH FAILED:", contact.email);
                }

                batch.push(contact);

                // quickly get all contacts of same company
                // check duplicates faster
                // compare within batch

                // It stores -> “All contacts processed in this batch, grouped by company”
                batchCompanyMap.set(
                    contact.company,
                    (batchCompanyMap.get(contact.company) || []).concat(contact)
                );
                // Google → [
                    //   { name: "John", phone: 1234, company: "Google" },
                    //   { name: "Alice", phone: 9498, company: "Google" }
                    // ]

                console.log(" CURRENT BATCH SIZE:", batch.length);

                if (batch.length >= BATCH_SIZE) {

                    const resultDB = await ContactModel.bulkWrite(
                        batch.map(contacts => ({
                            updateOne: {
                                filter: { normalizedEmail: contacts.normalizedEmail },
                                update: { $setOnInsert: contacts },
                                upsert: true
                            }
                        }))
                    );


                    await redis.deleteByPattern('contact:*');

                    console.log(" CACHE CLEARED AFTER BATCH INSERT");

                    //  REAL DB INFO
                    console.log("BULK RESULT:", {
                        inserted: resultDB.upsertedCount,
                        matched: resultDB.matchedCount,
                        modified: resultDB.modifiedCount
                    });

                    totalInserted += resultDB.upsertedCount;
                    totalProcessed += resultDB.upsertedCount;

                    console.log(`[JOB ${job.id}] BATCH SUMMARY:`, {
                        batchSize: batch.length,
                        inserted: resultDB.upsertedCount,
                        skippedDuplicates: batch.length - resultDB.upsertedCount,
                        totalInsertedSoFar: totalInserted
                    });

                    batch = [];
                    batchCompanyMap.clear();
                }
            };

            if (!isCSV && !isXLSX) {
                throw new CalmError("", "Unsupported file format");
            }

            // ================= CSV =================
            if (isCSV) {

                const stream = fs.createReadStream(filePath).pipe(csv());

                for await (const row of stream) {
                    await processContact(row);
                }
            }

            // ================= XLSX =================
            else if (isXLSX) {

                const xlsxRows = job.data.rows;

                for (const row of xlsxRows) {
                    await processContact(row);
                }
            }

            // ================= FINAL FLUSH =================
            if (batch.length > 0) {

                const result = await ContactModel.bulkWrite(
                    batch.map(contact => ({
                        updateOne: {
                            filter: { normalizedEmail: contact.normalizedEmail },
                            update: { $setOnInsert: contact },
                            upsert: true
                        }
                    }))
                );


                await redis.deleteByPattern('contact:*');

                console.log(" CACHE CLEARED AFTER BATCH INSERT");

                console.log("FINAL BULK RESULT:", {
                    inserted: result.upsertedCount,
                    matched: result.matchedCount
                });

                totalInserted += result.upsertedCount;
                totalProcessed += result.upsertedCount;

                console.log("FINAL BATCH SUMMARY:", {
                    batchSize: batch.length,
                    inserted: result.upsertedCount,
                    skipped: batch.length - result.upsertedCount,
                    totalInsertedSoFar: totalInserted
                });
            }

            // ================= FINAL LOG =================
            console.log(`[JOB ${job.id}] FINAL TOTAL:`, totalProcessed);

            console.log("🔥 FINAL REPORT:", {
                totalInserted,
                totalSkipped,
                totalProcessed
            });

            return { total: totalProcessed };
        },

        { connection: redisConnectionOptions }
    );

    worker.on('completed', (job) => {
        console.log("JOB COMPLETED:", job.id);
    });

    worker.on('failed', (job, err) => {
        console.log("JOB FAILED:", job?.id, err.message);
    });

    console.log("🚀 BullMQ Worker Running...");

})();
