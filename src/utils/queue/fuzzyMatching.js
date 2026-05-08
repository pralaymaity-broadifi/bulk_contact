'use strict';

const jaroWinkler = require('talisman/metrics/jaro-winkler');

// -------------------- Helpers --------------------


// "John Doe!!" → "john doe"
const normalizeName = (name) =>
  name?.toLowerCase().replace(/[^a-z ]/g, '').trim();

// "+91-98765-43210" → "919876543210"
const normalizePhone = (phone) =>
  phone ? String(phone).replace(/\D/g, '') : null;


// "John Michael Doe" 👉 First name → John  👉 Last name → Doe

const getFirstName = (name) => name?.split(' ')[ 0 ] || '';
const getLastName = (name) => name?.split(' ').slice(-1)[ 0 ] || '';

// simple phonetic fallback (replaces Soundex)
// Converts string into sorted letters (Helps detect similar-sounding names)
// "bob" → "bbo"
// "obb" → "bbo"
const simpleHash = (str = '') =>
  str
    .toLowerCase()
    .replace(/[^a-z]/g, '')
    .split('')
    .sort()
    .join('');


// 👉 Checks:

// "S" vs "Sara"
// "Sara" vs "S"
// detect initials (S Khan vs Sara Khan)
const isInitialMatch = (a, b) =>
  (a.length === 1 && b.startsWith(a)) || (b.length === 1 && a.startsWith(b));

// phonetic match replacement (NO natural dependency)
const phoneticMatch = (a, b) => simpleHash(a) === simpleHash(b);

// -------------------- Scoring --------------------

const calculateScore = (a, b) => {
  let score = 0;
  const reasons = [];

  // exact email match
  if (a.email && b.email && a.email === b.email) {
    return { score: 100, reasons: [ 'exact_email' ] };
  }

  // exact phone match
  if (a.phone && b.phone && normalizePhone(a.phone) === normalizePhone(b.phone)) {
    return { score: 100, reasons: [ 'exact_phone' ] };
  }

  // fuzzy email
  if (a.email && b.email) {

    const emailSim = jaroWinkler(a.email, b.email);
    
    if (emailSim >= 0.92) {
      score += 40;
      reasons.push(`fuzzy_email(${emailSim.toFixed(2)})`);
    }
  }

  // company match
  if (a.company && b.company && a.company === b.company) {
    score += 10;
    reasons.push('company');
  }

  const aName = normalizeName(a.name);
  const bName = normalizeName(b.name);

  if (!aName || !bName) return { score, reasons };

  const aFirst = getFirstName(aName);
  const bFirst = getFirstName(bName);
  const aLast = getLastName(aName);
  const bLast = getLastName(bName);

  // last name match
  if (aLast === bLast) {
    score += 30;
    reasons.push('exact_lastname');
  } else if (phoneticMatch(aLast, bLast)) {
    score += 20;
    reasons.push('phonetic_lastname');
  }

  // initials match
  if (isInitialMatch(aFirst, bFirst)) {
    score += 20;
    reasons.push('initial_match');
  } else {
    const jwScore = jaroWinkler(aFirst, bFirst);

    if (jwScore >= 0.85) {
      score += 30;
      reasons.push(`jw_strong(${jwScore.toFixed(2)})`);
    } else if (jwScore >= 0.70) {
      score += 15;
      reasons.push(`jw_weak(${jwScore.toFixed(2)})`);
    }
  }

  return { score, reasons };
};

// -------------------- Decision Engine --------------------
// Based on score, decide action + confidence level
// Compares one contact with all existing contacts
const getMatchResult = (contact, existingList) => {
  let bestScore = 0;
  let bestReasons = [];

  for (const existing of existingList) {

    if (existing.email !== contact.email) {

      const { score, reasons } = calculateScore(contact, existing);

      if (score > bestScore) {
        bestScore = score;
        bestReasons = reasons;
      }
    }
  }

  let confidence = 'LOW';
  let action = 'INSERT';

  if (bestScore >= 90) {
    confidence = 'HIGH';
    action = 'SKIP';
  } else if (bestScore >= 60) {
    confidence = 'MEDIUM';
    action = 'FLAG';
  }

  return {
    score: bestScore,
    confidence,
    action,
    reasons: bestReasons
  };
};

module.exports = { getMatchResult };
