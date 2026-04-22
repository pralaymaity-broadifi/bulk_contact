'use strict';

const levenshtein = require('fast-levenshtein');

// normalize name
const normalizeName = (name) => {
  return name
    ?.toLowerCase()
    .replace(/[^a-z ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

// normalize phone
const normalizePhone = (phone) => {
  if (!phone) return null;
  return String(phone).replace(/\D/g, '');
};

// create comparable signature
const createSignature = (contact) => {
  return {
    email: contact.email?.toLowerCase(),
    phone: normalizePhone(contact.phone),
    name: normalizeName(contact.name)
  };
};

// name similarity using levenshtein
const isSimilarName = (a, b) => {
  if (!a || !b) return false;
  const distance = levenshtein.get(a, b);
  const maxLen = Math.max(a.length, b.length);
  const similarity = 1 - distance / maxLen;
  return similarity >= 0.6; // 60% similar
};

// compare two single contacts
const isSimilar = (a, b) => {
  const aSig = createSignature(a);
  const bSig = createSignature(b);

  if (aSig.email && aSig.email === bSig.email) return true;
  if (aSig.phone && aSig.phone === bSig.phone) return true;

  if (aSig.name && bSig.name) {
    return isSimilarName(aSig.name, bSig.name);
  }

  return false;
};

// main fuzzy check — a is single contact, similarContacts is array
const isFuzzyDuplicate = (a, similarContacts) => {
  return similarContacts.some((b) => isSimilar(a, b));
};

module.exports = {
  normalizeName,
  normalizePhone,
  createSignature,
  isFuzzyDuplicate
};
