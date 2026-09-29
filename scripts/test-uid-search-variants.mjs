#!/usr/bin/env node
// Multi-variant direct SOAP tests for UID Public Services
// Usage: NODE_ENV=test node scripts/test-uid-search-variants.mjs

import { UidClient } from '../src/api/uid-client.js';

function extractPreview(items, limit = 10) {
  const out = [];
  for (const it of items.slice(0, limit)) {
    const org = it?.organisation?.organisation || {};
    const id = org?.organisationIdentification || {};
    const uid = id?.uid || {};
    // Prefer organisationName/legalName; fall back to nested eCH name structures
    const crudeName =
      id.organisationName ||
      id.organisationLegalName ||
      id.officialName?.name?.[0]?.name ||
      id.officialName?.name ||
      id.officialName ||
      id.registeredName?.name?.[0]?.name ||
      id.registeredName?.name ||
      id.registeredName ||
      id.name?.name?.[0]?.name ||
      id.name?.name ||
      id.name ||
      '(no name)';

    out.push({
      name: crudeName,
      uidCategorie: uid.uidOrganisationIdCategorie,
      uid: uid.uidOrganisationId
    });
  }
  return out;
}

import util from 'node:util';
function inspect(obj, depth = 6) {
  return util.inspect(obj, { depth, colors: false, compact: false, maxArrayLength: 50, breakLength: 120 });
}

async function oneSearch(label, client, params, cfg) {
  const start = Date.now();
  const res = await client.search(params, cfg);
  const dur = Date.now() - start;
  const items = res?.SearchResult?.uidEntitySearchResultItem || [];
  console.log(`\n=== ${label} ===`);
  console.log('Params:', JSON.stringify(params));
  console.log('Config:', JSON.stringify(cfg));
  console.log(`Duration: ${dur} ms`);
  console.log(`Result count: ${items.length}`);
  if (items.length) {
    console.log('Preview:', JSON.stringify(extractPreview(items, 10), null, 2));
    console.log('First item (raw):\n', inspect(items[0], 6));
  }
  return items;
}

async function run() {
  const client = new UidClient();

  const baseCfg = {
    searchMode: 'Auto',
    maxNumberOfRecords: 200,
    searchNameAndAddressHistory: true,
    quick: false
  };

  const results = [];

  // Variant A: Full address (house number included)
  results.push(await oneSearch(
    'A) Address exact (Gustav-Gull-Platz 4, 8004 Zürich, canton=ZH)',
    client,
    {
      street: 'Gustav-Gull-Platz',
      houseNumber: '4',
      swissZipCode: '8004',
      town: 'Z\u00FCrich',
      cantonAbbreviation: 'ZH',
      countryIdISO2: 'CH'
    },
    baseCfg
  ));

  // Variant B: Add municipalityId (Zürich BFS 0261)
  results.push(await oneSearch(
    'B) Address exact + municipalityId=261',
    client,
    {
      street: 'Gustav-Gull-Platz',
      houseNumber: '4',
      swissZipCode: '8004',
      town: 'Z\u00FCrich',
      cantonAbbreviation: 'ZH',
      municipalityId: '261',
      countryIdISO2: 'CH'
    },
    baseCfg
  ));

  // Variant C: Street-only (no house number)
  results.push(await oneSearch(
    'C) Street-only (no house number)',
    client,
    {
      street: 'Gustav-Gull-Platz',
      swissZipCode: '8004',
      town: 'Z\u00FCrich',
      cantonAbbreviation: 'ZH',
      municipalityId: '261',
      countryIdISO2: 'CH'
    },
    baseCfg
  ));

  // Variant D: Alias street attempt (Europaallee 4)
  results.push(await oneSearch(
    'D) Alias street (Europaallee 4)',
    client,
    {
      street: 'Europaallee',
      houseNumber: '4',
      swissZipCode: '8004',
      town: 'Z\u00FCrich',
      cantonAbbreviation: 'ZH',
      municipalityId: '261',
      countryIdISO2: 'CH'
    },
    baseCfg
  ));

  // Variant E: Fuzzy on street-only
  results.push(await oneSearch(
    'E) Fuzzy street-only',
    client,
    {
      street: 'Gustav-Gull-Platz',
      swissZipCode: '8004',
      town: 'Z\u00FCrich',
      cantonAbbreviation: 'ZH',
      municipalityId: '261',
      countryIdISO2: 'CH'
    },
    {
      ...baseCfg,
      searchMode: 'Fuzzy'
    }
  ));

  // Aggregate unique UIDs across variants
  const uidSet = new Set();
  for (const arr of results) {
    for (const it of (arr || [])) {
      const o = it?.organisation?.organisation;
      const ident = o?.organisationIdentification;
      const uidNum = ident?.uid?.uidOrganisationId;
      const cat = ident?.uid?.uidOrganisationIdCategorie || 'CHE';
      if (uidNum != null) {
        uidSet.add(`${cat}${uidNum}`);
      }
    }
  }
  console.log(`\n=== Aggregated UID count (unique across all variants): ${uidSet.size} ===`);
  console.log('Sample UIDs:', Array.from(uidSet).slice(0, 20));

  console.log('\nDone.');
  process.exit(0);
}

run();
