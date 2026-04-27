'use strict';

require('dotenv').config();
require('../../../system/configs/database');

const { Worker } = require('bullmq');
const connection = require('./redis');
const fs = require('fs');
const csv = require('csv-parser');


// cSpell:ignore exceljs
const ExcelJS = require('exceljs');
const mongoose = require('mongoose');

const { CalmError } = require('../../../system/core/CalmError');
const path = require('path');

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

            const { Contact } = require('../../modules/contact/contact.model');
            const ContactModel = new Contact().getInstance();

            console.log("JOB STARTED:", job.id);

            const filePath = job.data.filePath;
            const ext = path.extname(filePath).replace('.', '');

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

                    await ContactModel.insertMany(batch);

                    totalProcessed += batch.length;
                    console.log("BATCH INSERTED:", totalProcessed);

                    batch = [];
                }
            };

            // ================= CSV =================
            if (ext === 'csv') {

                const stream = fs.createReadStream(filePath).pipe(csv());

                await new Promise((resolve, reject) => {

                    stream.on('data', async (row) => {
                        stream.pause();
                        try {
                            await processContact(row);
                        } finally {
                            stream.resume();
                        }
                    });

                    stream.on('end', resolve);
                    stream.on('error', reject);
                });

            }

            // ================= XLSX =================
            else if (ext === 'xlsx') {

                const workbook = new ExcelJS.Workbook();
                await workbook.xlsx.readFile(filePath);

                const worksheet = workbook.worksheets[ 0 ];

                const rows = [];

                worksheet.eachRow((row, rowNumber) => {
                    if (rowNumber === 1) return;

                    rows.push({
                        name: row.getCell(1).value,
                        email: row.getCell(2).value,
                        phone: row.getCell(3).value,
                        company: row.getCell(4).value
                    });
                });

                for (const row of rows) {
                    await processContact(row);
                }

            } else {
                throw new CalmError("", "Unsupported file format");
            }

            if (batch.length > 0) {
                await ContactModel.insertMany(batch);
                totalProcessed += batch.length;
                console.log("FINAL BATCH INSERTED:", totalProcessed);
            }

            console.log("FINAL TOTAL:", totalProcessed);

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
