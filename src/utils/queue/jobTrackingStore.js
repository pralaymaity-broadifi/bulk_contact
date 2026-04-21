'use strict';

const jobs = {};

class JobStore {

  create(jobId) {

    jobs[ jobId ] = {

      status: "queued",
      progress: 0

    };
  }

  update(jobId, data) {

    if (jobs[ jobId ]) {
      jobs[ jobId ] = { ...jobs[ jobId ], ...data };
    }

  }

  get(jobId) {

    return jobs[ jobId ] || null;

  }
}

module.exports = new JobStore();
