'use strict';

const levenshtein = require('fast-levenshtein');

const normalizeName = (name) =>
  name?.toLowerCase().replace(/[^a-z ]/g, '').trim();

const normalizePhone = (phone) =>
  phone ? String(phone).replace(/\D/g, '') : null;

const getFirstName = (name) => name?.split(' ')[ 0 ];
const getLastName = (name) => name?.split(' ').slice(-1)[ 0 ];

// scoring function
const calculateScore = (a, b) => {
  let score = 0;

  // email match
  if (a.email && b.email && a.email === b.email) {
    return 100;
  }

  // phone match
  if (a.phone && b.phone && normalizePhone(a.phone) === normalizePhone(b.phone)) {
    return 100;
  }

  // company match
  if (a.company && b.company && a.company === b.company) {
    score += 10;
  }

  const aName = normalizeName(a.name);
  const bName = normalizeName(b.name);

  if (!aName || !bName) return score;

  // last name match
  if (getLastName(aName) === getLastName(bName)) {
    score += 30;
  }

  // first name similarity (Jon vs John)
  const distance = levenshtein.get(getFirstName(aName), getFirstName(bName));
  const maxLen = Math.max(aName.length, bName.length);
  const similarity = 1 - distance / maxLen;

  if (similarity >= 0.6) {
    score += 30;
  }

  return score;
};

// final decision engine
const getMatchResult = (contact, existingList) => {
  let bestScore = 0;

  for (const existing of existingList) {
    const score = calculateScore(contact, existing);
    if (score > bestScore) bestScore = score;
  }

  let confidence = "LOW";
  let action = "INSERT";

  if (bestScore >= 90) {
    confidence = "HIGH";
    action = "SKIP";
  } else if (bestScore >= 70) {
    confidence = "MEDIUM";
    action = "FLAG";
  }

  return {
    score: bestScore,
    confidence,
    action
  };
};

module.exports = { getMatchResult };
