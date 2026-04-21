'use strict';
const { CalmService } = require( '../../../system/core/CalmService' );
// const fs = require("fs");
// const csv = require("csv-parser");
const contactQueue = require('../../utils/queue/contactQueue');
const jobTrackingStore = require("../../utils/queue/jobTrackingStore");

const path = require("path");



class ContactService extends CalmService {
    // Setting Global Populate to apply in Get All & Get Single
    populateFields = [ { path: 'createdBy' }, { path: 'updatedBy' } ];
    constructor( model ) {
        super( model );
    }


  // async processFile(filePath) {

  //     // Read a file step by step instead of loading everything at once
  //     const stream = fs.createReadStream(filePath);

  //     // A special data structure that stores ONLY unique values
  //     const seen = new Set();

  //     let batch = [];

  //     const BATCH_SIZE = 500;

  //     return new Promise((resolve, reject) => {

  //       stream
  //         .pipe(csv())

  //         // .on() means Listen for events
  //         // .on( "error", "end", "data" ) they are predefined event names
  //         .on("data", async (row) => {

  //           const emailNormalized = row.email?.toLowerCase().trim();

  //           // If email already exists → skip it
  //           if (seen.has(emailNormalized)) return;

  //           seen.add(emailNormalized);

  //           batch.push({
  //             name: row.name,
  //             email: row.email,
  //             phone: row.phone,
  //             company: row.company,
  //             normalizedEmail: emailNormalized
  //           });

  //           if (batch.length >= BATCH_SIZE) {
  //             stream.pause();
  //             await this.model.insertMany(batch);
  //             batch = [];
  //             stream.resume();
  //           }

  //         })

  //         .on("end", async () => {

  //           if (batch.length > 0) {
  //             await this.model.insertMany(batch);
  //           }

  //           resolve({
  //             message: "Processed successfully",
  //             totalUnique: seen.size
  //           });

  //         })

  //         // If file reading fails → stop everything
  //         .on("error", reject);

  //     });
  // }

async processFile(filePath, userId) {

  console.log("SENDING TO QUEUE ====");

  let absoluteFilePath = filePath;

  // 🔥 ONLY convert if it's NOT absolute
  if (!path.isAbsolute(filePath)) {
    absoluteFilePath = path.resolve(filePath);
  }

  const job = await contactQueue.add('process-contacts', {
    filePath: absoluteFilePath,
    userId
  });

  jobTrackingStore.create(job.id);

  return {
    jobId: job.id,
    message: "Processing started"
  };
}
}

module.exports = { ContactService };
