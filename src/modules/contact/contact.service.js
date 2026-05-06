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

    // async getAll(query, ops = {}) {

    //     let populateFields = this.populateFields;

    //     if (Array.isArray(ops.populateFields)) {
    //         populateFields = ops.populateFields;
    //     }

    //     // =========================
    //     // SAFE DESTRUCTURING
    //     // =========================
    //     const { skip, limit, sortBy, ...restQuery } = query;

    //     const finalSkip = skip ? Number(skip) : 0;
    //     const finalLimit = limit ? Number(limit) : 10;
    //     const finalSort = sortBy ? sortBy : { createdAt: -1 };

    //     // =========================
    //     // CACHE KEY (based on query + pagination + sort)
    //     // =========================
    //     const cacheKey = `contact:list:${JSON.stringify({
    //         restQuery,
    //         skip: finalSkip,
    //         limit: finalLimit,
    //         sortBy: finalSort
    //     })}`;

    //     // =========================
    //     // CACHE WRAPPER
    //     // =========================
    //     return await cacheWrapper(cacheKey, async () => {

    //         const items = await this.model
    //             .find(restQuery)
    //             .sort(finalSort)
    //             .skip(finalSkip)
    //             .limit(finalLimit)
    //             .populate(populateFields);

    //         const total = await this.model.countDocuments(restQuery);

    //         return {
    //             data: this.parseObj(items),
    //             total
                
    //         };
    //     });
    // }


    async getAll(query) {

        // =========================
        // DESTRUCTURE QUERY
        // =========================
        const {
            skip,
            limit,
            sortBy,
            search,
            company,
            duplicateStatus,
            duplicateConfidence,
            minScore,
            maxScore,
            startDate,
            endDate,
            ...restQuery
        } = query;

        const finalSkip = skip ? Number(skip) : 0;
        const finalLimit = limit ? Number(limit) : 10;

        // default sort (Mongo aggregation style)
        const finalSort = sortBy ? sortBy : { createdAt: -1 };

        // =========================
        // BUILD SEARCH CONDITIONS
        // =========================
        const must = [];
        const filter = [];

        // FULL TEXT SEARCH
        if (search) {
            must.push({
                text: {
                    query: search,
                    path: [ "name", "email", "company", "phone" ]
                }
            });
        }

        

        // FILTERS
        if (company) {
            filter.push({
                text: {
                    query: company,
                    path: "company"
                }
            });
        }

        if (duplicateStatus) {
            filter.push({
                equals: {
                    path: "duplicateStatus",
                    value: duplicateStatus
                }
            });
        }

        if (duplicateConfidence) {
            filter.push({
                equals: {
                    path: "duplicateConfidence",
                    value: duplicateConfidence
                }
            });
        }

        //  SCORE RANGE
        if (minScore !== undefined || maxScore !== undefined) {
            filter.push({
                range: {
                    path: "duplicateScore",
                    gte: minScore ? Number(minScore) : 0,
                    lte: maxScore ? Number(maxScore) : 100
                }
            });
        }

        //  DATE RANGE
        if (startDate || endDate) {

            const start = startDate ? new Date(startDate) : new Date("1970-01-01");

            const end = endDate ? new Date(endDate) : new Date();

            // Important: include full end day till 23:59:59.999
            end.setHours(23, 59, 59, 999);

            filter.push({
                range: {
                    path: "createdAt",
                    gte: start,
                    lte: end
                }
            });
        }

        // =========================
        // CACHE KEY
        // =========================
        const cacheKey = `contact:list:${JSON.stringify({
            query,
            skip: finalSkip,
            limit: finalLimit
        })}`;

        // =========================
        // EXECUTION
        // =========================
        return await cacheWrapper(cacheKey, async () => {

    const pipeline = [];

    // =========================
    // MAIN ATLAS SEARCH STAGE (UPDATED)
    // =========================
    if (search?.trim() || must.length > 0 || filter.length > 0) {

        pipeline.push({

            // Use Atlas Search engine for searching instead of normal filtering
            $search: {

                // This means: I want to combine multiple search rules together
                compound: {

                    // This means:Try all these options, and rank results based on how well they match
                    should: [

                        //  This enables: “prefix matching search”
                        {
                            autocomplete: {
                                query: search,
                                path: "name",
                                // Make this match 10x more important than others
                                score: { boost: { value: 10 } }
                            }
                        },

                        // FALLBACK: normal full-text search
                        {
                            text: {
                                query: search,
                                path: [ "name", "email", "company", "phone" ]
                            }
                        }
                    ],

                    minimumShouldMatch: 1,
                    // existing filters still apply
                    must: must,
                    filter: filter
                }
            }
        });
    }

    // =========================
    // REST QUERY FILTER
    // =========================
    if (Object.keys(restQuery).length > 0) {
        pipeline.push({
            $match: restQuery
        });
    }

    // =========================
    // SORT
    // =========================
    pipeline.push({
        $sort: finalSort
    });

    // =========================
    // PAGINATION
    // =========================
    pipeline.push(
        { $skip: finalSkip },
        { $limit: finalLimit }
    );

    // =========================
    // DATA QUERY
    // =========================
    const items = await this.model.aggregate(pipeline);

    // =========================
    // COUNT PIPELINE (SAME LOGIC)
    // =========================
    const countPipeline = [];

    if (search?.trim() || must.length > 0 || filter.length > 0) {
        countPipeline.push({
            $search: {
                compound: {
                    should: [
                        {
                            autocomplete: {
                                query: search,
                                path: "name",
                            }
                        },
                        {
                            text: {
                                query: search,
                                path: [ "name", "email", "company", "phone" ]
                            }
                        }
                    ],
                    minimumShouldMatch: 1,
                    must,
                    filter
                }
            }
        });
    }

    countPipeline.push({
        $count: "total"
    });

    const countResult = await this.model.aggregate(countPipeline);
    const total = countResult[ 0 ]?.total || 0;

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
