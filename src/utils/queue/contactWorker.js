'use strict';

require('dotenv').config();
require('../../../system/configs/database');

const { Worker } = require('bullmq');
const connection = require('./redis');
const fs = require('fs');
const csv = require('csv-parser');


// cSpell:ignore exceljs

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

            // console.log(" FULL JOB DATA:", JSON.stringify(job.data, null, 2));
            console.log(`JOB ${job.id} FILE:`, job.data.filePath);

            const { Contact } = require('../../modules/contact/contact.model');
            const ContactModel = new Contact().getInstance();


            // ================= FIX START =================

            const filePath = job.data.filePath;
            const rows = job.data.rows;

             // STRICT TYPE SYSTEM (NO GUESSING)
            const type = job.data.type;

            const isCSV = type === "csv" && typeof filePath === "string";
            const isXLSX = type === "xlsx" && Array.isArray(rows);

            // console.log("FILE:", filePath);

            console.log(" DETECTED JOB TYPE:", {
                type,
                hasFilePath: !!filePath,
                hasRows: Array.isArray(rows)
            });

            // ================= FIX END =================

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

                if (!contact.name || !contact.email) return;

                const existing = await ContactModel.findOne({
                    normalizedEmail: contact.normalizedEmail
                });

                if (existing) {
                    console.log("SKIPPED EXACT DUPLICATE:", contact.email);
                    return;
                }

                const similarContactsFromDB = await ContactModel.find({
                    company: contact.company
                }).limit(50);

                const similarContactsFromBatch = batch.filter(
                    b => b.company === contact.company
                );

                const result = getMatchResult(contact, [
                    ...similarContactsFromDB,
                    ...similarContactsFromBatch
                ]);

                console.log("FUZZY RESULT ==:", result);

                if (result.action === "SKIP") return;

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

                if (batch.length >= BATCH_SIZE) {

                    //  FIX: replaced
                    await ContactModel.bulkWrite(
                        batch.map(contacts => ({
                            updateOne: {
                                filter: { normalizedEmail: contacts.normalizedEmail },
                                update: { $setOnInsert: contacts },
                                upsert: true
                            }
                        }))
                    );

                    totalProcessed += batch.length;
                    console.log(`[JOB ${job.id}] BATCH INSERTED:`, totalProcessed);

                    batch = [];
                }
            };


            if (!isCSV && !isXLSX) {

                throw new CalmError("", "Unsupported file format");
            }

            // ================= CSV =================

            // Sequential CSV processing (safe + memory efficient, no stream race issues)
            // chunks → merge file → stream parse → DB

            if (isCSV) {

                const stream = fs.createReadStream(filePath).pipe(csv());

                for await (const row of stream) {
                    await processContact(row);
                }
            }

            // ================= XLSX =================

            // chunks → parse each chunk → combine rows → DB
            else if (isXLSX) {

                const xlsxRows = job.data.rows; // SAFE FIX

                for (const row of xlsxRows) {
                    await processContact(row);
                }

            }

            

            if (batch.length > 0) {

                //  FIX:
                await ContactModel.bulkWrite(
                    batch.map(contact => ({
                        updateOne: {
                            filter: { normalizedEmail: contact.normalizedEmail },
                            update: { $setOnInsert: contact },
                            upsert: true
                        }
                    }))
                );

                totalProcessed += batch.length;
                console.log("FINAL BATCH INSERTED:", totalProcessed);
            }

            console.log(`[JOB ${job.id}] FINAL TOTAL:`, totalProcessed);

            return { total: totalProcessed };
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
