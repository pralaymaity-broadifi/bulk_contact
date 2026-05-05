'use strict';
const { CalmService } = require( '../../../system/core/CalmService' );
// const fs = require("fs");
// const csv = require("csv-parser");
const contactQueue = require('../../utils/queue/contactQueue');
const jobTrackingStore = require("../../utils/queue/jobTrackingStore");
const cacheWrapper = require('../../utils/cache/cacheWrapper');

const path = require("path");



class ContactService extends CalmService {
    // Setting Global Populate to apply in Get All & Get Single
    populateFields = [ { path: 'createdBy' }, { path: 'updatedBy' } ];
    constructor( model ) {
        super( model );
    }



    async get(id, ops = {}) {

      let populateFields = this.populateFields;

      if (Array.isArray(ops.populateFields)) {

          populateFields = ops.populateFields;

      }

      const cacheKey = `contact:get:${id}`;

      return await cacheWrapper(cacheKey, async () => {

          const item = await this.model.findById(id).populate(populateFields);

          if (!item) {
              throw new Error('NOT_FOUND_ERROR');
          }

          return { data: item.toJSON() };

      });
    }

    async getAll(query, ops = {}) {

        let populateFields = this.populateFields;

        if (Array.isArray(ops.populateFields)) {
            populateFields = ops.populateFields;
        }

        // =========================
        // SAFE DESTRUCTURING
        // =========================
        const { skip, limit, sortBy, ...restQuery } = query;

        const finalSkip = skip ? Number(skip) : 0;
        const finalLimit = limit ? Number(limit) : 10;
        const finalSort = sortBy ? sortBy : { createdAt: -1 };

        // =========================
        // CACHE KEY (based on query + pagination + sort)
        // =========================
        const cacheKey = `contact:list:${JSON.stringify({
            restQuery,
            skip: finalSkip,
            limit: finalLimit,
            sortBy: finalSort
        })}`;

        // =========================
        // CACHE WRAPPER
        // =========================
        return await cacheWrapper(cacheKey, async () => {

            const items = await this.model
                .find(restQuery)
                .sort(finalSort)
                .skip(finalSkip)
                .limit(finalLimit)
                .populate(populateFields);

            const total = await this.model.countDocuments(restQuery);

            return {
                data: this.parseObj(items),
                total
                
            };
        });
    }

    

  

  async processFile(filePath) {

    console.log("SENDING TO QUEUE ====");

    let absoluteFilePath = filePath;

    // ONLY convert if it's NOT absolute
    if (!path.isAbsolute(filePath)) {
      absoluteFilePath = path.resolve(filePath);
    }

    const job = await contactQueue.add('process-contacts', {
      filePath: absoluteFilePath
    });

    // console.log("JOB CREATED WITH ID:=========", job);

    jobTrackingStore.create(job.id);

    return {
      jobId: job.id,
      message: "Processing started"
    };
  }
}

module.exports = { ContactService };
