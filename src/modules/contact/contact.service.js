'use strict';
const { CalmService } = require( '../../../system/core/CalmService' );
// const fs = require("fs");
// const csv = require("csv-parser");
// const contactQueue = require('../../utils/queue/contactQueue');
// const jobTrackingStore = require("../../utils/queue/jobTrackingStore");
const cacheWrapper = require('../../utils/cache/cacheWrapper');

// const path = require("path");



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

    


    // async getAll(query) {

    // // =========================
    // // DESTRUCTURE QUERY
    // // =========================
    // const {
    //     skip,
    //     limit,
    //     sortBy,
    //     search,
    //     company,
    //     duplicateStatus,
    //     duplicateConfidence,
    //     minScore,
    //     maxScore,
    //     startDate,
    //     endDate,
    //     ...restQuery
    // } = query;

    // const finalSkip = skip ? Number(skip) : 0;
    // const finalLimit = limit ? Number(limit) : 10;
    // const finalSort = sortBy ? sortBy : { createdAt: -1 };

    // const hasSearch = typeof search === "string" && search.trim().length > 0;

    // const filter = [];

    // // =========================
    // // FILTERS
    // // =========================
    // if (company) {
    //     filter.push({
    //         text: {
    //             query: company,
    //             path: "company"
    //         }
    //     });
    // }

    // if (duplicateStatus) {
    //     filter.push({
    //         equals: {
    //             path: "duplicateStatus",
    //             value: duplicateStatus
    //         }
    //     });
    // }

    // if (duplicateConfidence) {
    //     filter.push({
    //         equals: {
    //             path: "duplicateConfidence",
    //             value: duplicateConfidence
    //         }
    //     });
    // }

    // if (minScore !== undefined || maxScore !== undefined) {
    //     filter.push({
    //         range: {
    //             path: "duplicateScore",
    //             gte: minScore ? Number(minScore) : 0,
    //             lte: maxScore ? Number(maxScore) : 100
    //         }
    //     });
    // }

    // if (startDate || endDate) {
    //     const start = startDate ? new Date(startDate) : new Date("1970-01-01");
    //     const end = endDate ? new Date(endDate) : new Date();
    //     end.setHours(23, 59, 59, 999);

    //     filter.push({
    //         range: {
    //             path: "createdAt",
    //             gte: start,
    //             lte: end
    //         }
    //     });
    // }

    // // =========================
    // // CACHE KEY
    // // =========================
    // const cacheKey = `contact:list:${JSON.stringify({
    //     query,
    //     skip: finalSkip,
    //     limit: finalLimit
    // })}`;

    // // =========================
    // // EXECUTION
    // // =========================
    // return await cacheWrapper(cacheKey, async () => {

    //     const pipeline = [];

    //     // =========================
    //     // ATLAS SEARCH STAGE
    //     // =========================
    //     let searchStage = null;

    //     if (hasSearch || filter.length > 0) {

    //         searchStage = {
    //             compound: {
    //                 filter
    //             }
    //         };

    //         if (hasSearch) {
    //             searchStage.compound.should = [
    //                 {
    //                     autocomplete: {
    //                         query: search,
    //                         path: "name",
    //                         score: { boost: { value: 10 } }
    //                     }
    //                 },
    //                 {
    //                     text: {
    //                         query: search,
    //                         path: [ "email", "company", "phone" ]
    //                     }
    //                 }
    //             ];

    //             searchStage.compound.minimumShouldMatch = 1;
    //         }
    //     }

    //     if (searchStage) {
    //         pipeline.push({ $search: searchStage });
    //     }

    //     // =========================
    //     // EXTRA FILTERS
    //     // =========================
    //     if (Object.keys(restQuery).length > 0) {
    //         pipeline.push({ $match: restQuery });
    //     }

    //     // =========================
    //     // SORT + PAGINATION
    //     // =========================
    //     pipeline.push(
    //         { $sort: finalSort },
    //         { $skip: finalSkip },
    //         { $limit: finalLimit }
    //     );

    //     const items = await this.model.aggregate(pipeline);

    //     // =========================
    //     // COUNT PIPELINE
    //     // =========================
    //     const countPipeline = [];

    //     let countSearchStage = null;

    //     if (hasSearch || filter.length > 0) {

    //         countSearchStage = {
    //             compound: {
    //                 filter
    //             }
    //         };

    //         if (hasSearch) {
    //             countSearchStage.compound.should = [
    //                 {
    //                     autocomplete: {
    //                         query: search,
    //                         path: "name"
    //                     }
    //                 },
    //                 {
    //                     text: {
    //                         query: search,
    //                         path: [ "email", "company", "phone" ]
    //                     }
    //                 }
    //             ];

    //             countSearchStage.compound.minimumShouldMatch = 1;
    //         }
    //     }

    //     if (countSearchStage) {
    //         countPipeline.push({ $search: countSearchStage });
    //     }

    //     countPipeline.push({ $count: "total" });

    //     const countResult = await this.model.aggregate(countPipeline);
    //     const total = countResult[ 0 ]?.total || 0;

    //     return {
    //         data: this.parseObj(items),
    //         total
    //     };
    // });
    // }

    async getAll(query) {

    // =========================
    // DESTRUCTURE QUERY
    // =========================
    const {
        skip,
        limit,
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

    const hasSearch = typeof search === "string" && search.trim().length > 0;

    const filter = [];

    // =========================
    // FILTERS
    // =========================
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

    if (minScore !== undefined || maxScore !== undefined) {
        filter.push({
            range: {
                path: "duplicateScore",
                gte: minScore ? Number(minScore) : 0,
                lte: maxScore ? Number(maxScore) : 100
            }
        });
    }

    if (startDate || endDate) {
        const start = startDate ? new Date(startDate) : new Date("1970-01-01");
        const end = endDate ? new Date(endDate) : new Date();
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

    return await cacheWrapper(cacheKey, async () => {

        const pipeline = [];

        // =========================
        // MONGODB ATLAS SEARCH STAGE (Not mongo query stage)
        // =========================
        if (hasSearch || filter.length > 0) {

            // This object will later become: $search query
            const searchStage = {

                // compound means : Combine multiple search conditions together
                compound: {
                    // THIS filter key is MongoDB Atlas built-in keyword.
                    filter: filter
                }
            };

            if (hasSearch) {
                searchStage.compound.should = [
                    {
                        autocomplete: {
                            query: search,
                            path: "name",
                            score: { boost: { value: 10 } }
                        }
                    },
                    {
                        text: {
                            query: search,
                            path: [ "email", "company", "phone" ]
                        }
                    }
                ];

                // At least ONE should condition must match
                searchStage.compound.minimumShouldMatch = 1;
            }

            // =========================
            // ADD SCORE (IMPORTANT)
            // =========================
            pipeline.push({
                $search: searchStage
            });
        }

        // =========================
        // REST FILTERS
        // =========================
        if (Object.keys(restQuery).length > 0) {
            pipeline.push({ $match: restQuery });
        }

        // =========================
        // ADD SCORE FIELD (VERY IMPORTANT)
        // =========================

        // This will brings the data according to correct match order
        pipeline.push({
            $addFields: {
                score: { $meta: "searchScore" }
            }
        });

        // =========================
        // SORT BY SCORE (FIX)
        // =========================
        pipeline.push({
            $sort: {
                score: -1
            }
        });

        // =========================
        // PAGINATION
        // =========================
        pipeline.push(
            { $skip: finalSkip },
            { $limit: finalLimit }
        );

        // =========================
        // DATA
        // =========================
        const items = await this.model.aggregate(pipeline);

        // =========================
        // COUNT PIPELINE
        // =========================
        const countPipeline = [];

        if (hasSearch || filter.length > 0) {

            const countSearchStage = {
                compound: {
                    filter
                }
            };

            if (hasSearch) {
                countSearchStage.compound.should = [
                    {
                        autocomplete: {
                            query: search,
                            path: "name"
                        }
                    },
                    {
                        text: {
                            query: search,
                            path: [ "email", "company", "phone" ]
                        }
                    }
                ];

                countSearchStage.compound.minimumShouldMatch = 1;
            }

            countPipeline.push({
                $search: countSearchStage
            });
        }

        countPipeline.push({ $count: "total" });

        const countResult = await this.model.aggregate(countPipeline);
        const total = countResult[ 0 ]?.total || 0;

        return {
            data: this.parseObj(items),
            total
        };
    });
}

    

  

//   async processFile(filePath) {

//     console.log("SENDING TO QUEUE ====");

//     let absoluteFilePath = filePath;

//     // ONLY convert if it's NOT absolute
//     if (!path.isAbsolute(filePath)) {
//       absoluteFilePath = path.resolve(filePath);
//     }

//     const job = await contactQueue.add('process-contacts', {
//       filePath: absoluteFilePath
//     });

//     // console.log("JOB CREATED WITH ID:=========", job);

//     jobTrackingStore.create(job.id);

//     return {
//       jobId: job.id,
//       message: "Processing started"
//     };
//   }
}

module.exports = { ContactService };
