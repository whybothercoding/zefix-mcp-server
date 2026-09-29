#!/usr/bin/env node
// Direct SOAP test for UID Public Services
// Usage: NODE_ENV=test node scripts/test-uid-search.mjs

import { UidClient } from '../src/api/uid-client.js';

async function run() {
  const client = new UidClient();

  // Test 1: Address-based search for the target building address
  const addressParams = {
    street: 'Gustav-Gull-Platz',
    houseNumber: '4',
    swissZipCode: '8004',
    town: 'Z\u00FCrich',
    countryIdISO2: 'CH',
    cantonAbbreviation: 'ZH'
    // municipalityId: '261' // Uncomment if needed (Z\u00FCrich BFS = 261)
  };

  // Test 2: Simple organisation name search to validate results are returned
  const orgParams = {
    organisationName: 'SBB',
    canton: 'ZH' // Narrowing helps
  };

  try {
    console.log('=== UID SOAP PublicServices Address Search ===');
    console.log('Params:', addressParams);
    const start1 = Date.now();
    const res1 = await client.search(addressParams, {
      searchMode: 'Auto',
      maxNumberOfRecords: 50,
      searchNameAndAddressHistory: true,
      quick: false // PublicServices: use Search only
    });
    const dur1 = Date.now() - start1;
    const items1 = res1?.SearchResult?.uidEntitySearchResultItem || [];
    console.log(`Duration: ${dur1} ms`);
    console.log(`Result count: ${items1.length}`);
    if (items1.length > 0) {
      const preview = items1.slice(0, 5).map((it) => {
        const org = it.organisation || {};
        const id = org.organisationIdentification || {};
        const name = id.officialName || id.registeredName || '(no name)';
        const uid = org.uid || {};
        return {
          name,
          uidCategorie: uid.uidOrganisationIdCategorie,
          uid: uid.uidOrganisationId
        };
      });
      console.log('Preview:', JSON.stringify(preview, null, 2));
    } else {
      console.log('No results for address search.');
    }

    console.log('\n=== UID SOAP PublicServices Organisation Search ===');
    console.log('Params:', orgParams);
    const start2 = Date.now();
    const res2 = await client.search(orgParams, {
      searchMode: 'Auto',
      maxNumberOfRecords: 20,
      searchNameAndAddressHistory: false,
      quick: false
    });
    const dur2 = Date.now() - start2;
    const items2 = res2?.SearchResult?.uidEntitySearchResultItem || [];
    console.log(`Duration: ${dur2} ms`);
    console.log(`Result count: ${items2.length}`);
    if (items2.length > 0) {
      const preview2 = items2.slice(0, 5).map((it) => {
        const org = it.organisation || {};
        const id = org.organisationIdentification || {};
        const name = id.officialName || id.registeredName || '(no name)';
        const uid = org.uid || {};
        return {
          name,
          uidCategorie: uid.uidOrganisationIdCategorie,
          uid: uid.uidOrganisationId
        };
      });
      console.log('Preview:', JSON.stringify(preview2, null, 2));
    } else {
      console.log('No results for organisation search.');
    }

    console.log('\nDone.');
    process.exit(0);
  } catch (err) {
    console.error('Error during SOAP test:', err?.message || err);
    process.exit(1);
  }
}

run();
