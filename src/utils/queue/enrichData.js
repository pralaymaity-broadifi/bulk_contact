'use strict';

// simulate delay (mock API)
const delay = (ms) => new Promise(res => setTimeout(res, ms));

// mock enrichment API
const enrichContact = async () => {
  await delay(200); // simulate network call

  return {
    jobTitle: "Software Engineer",
    location: "India",
  };
};

module.exports = {
  enrichContact
};
