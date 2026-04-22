'use strict';

const jobs = {};

class JobStore {

  create(jobId) {

    jobs[ jobId ] = {

      status: "queued",
      progress: 0

    };
    console.log("🟡 JOB CREATED (STORE):", jobId);
  }

  update(jobId, data) {

    if (jobs[ jobId ]) {
      jobs[ jobId ] = { ...jobs[ jobId ], ...data };

      console.log("🔄 JOB UPDATED:", jobId, jobs[ jobId ]);
    }

  }

  get(jobId) {
    console.log("📤 JOB FETCHED:", jobId);
    return jobs[ jobId ] || null;

  }
}

module.exports = new JobStore();
