'use strict';
const { CalmService } = require( '../../../system/core/CalmService' );
const fs = require("fs");
const csv = require("csv-parser");
class ContactService extends CalmService {
    // Setting Global Populate to apply in Get All & Get Single
    populateFields = [ { path: 'createdBy' }, { path: 'updatedBy' } ];
    constructor( model ) {
        super( model );
    }


    async processFile(filePath) {

    const stream = fs.createReadStream(filePath);

    const seen = new Set();
    let batch = [];
    const BATCH_SIZE = 500;

    return new Promise((resolve, reject) => {

      stream
        .pipe(csv())

        .on("data", async (row) => {

          const emailNormalized = row.email?.toLowerCase().trim();

          if (seen.has(emailNormalized)) return;
          seen.add(emailNormalized);

          batch.push({
            name: row.name,
            email: row.email,
            phone: row.phone,
            company: row.company,
            normalizedEmail: emailNormalized
          });

          if (batch.length >= BATCH_SIZE) {
            stream.pause();
            await this.model.insertMany(batch);
            batch = [];
            stream.resume();
          }

        })

        .on("end", async () => {

          if (batch.length > 0) {
            await this.model.insertMany(batch);
          }

          resolve({
            message: "Processed successfully",
            totalUnique: seen.size
          });

        })

        .on("error", reject);

    });
  }
}

module.exports = { ContactService };
