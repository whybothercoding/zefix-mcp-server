#!/usr/bin/env node
// Inspect PublicServices WSDL to discover exact method and parameter names without JSON stringify cycles

import soap from 'soap';
import util from 'node:util';
import { config } from '../src/config.js';

function safeInspect(obj, depth = 6) {
  return util.inspect(obj, { depth, colors: false, compact: false, maxArrayLength: 50, breakLength: 120 });
}

async function run() {
  try {
    const url = config.uid.publicUrl;
    console.log('WSDL URL:', url);
    const client = await soap.createClientAsync(url, { disableCache: true });

    // High-level describe (non-JSON) to avoid circular refs
    const desc = client.describe();
    console.log('\\n=== client.describe() (truncated depth) ===');
    console.log(safeInspect(desc, 5));

    // Try to dig into services -> bindings -> methods
    const wsdl = client.wsdl;
    console.log('\\n=== Services ===');
    const services = wsdl?.definitions?.services || {};
    for (const [svcName, svc] of Object.entries(services)) {
      console.log(`- Service: ${svcName}`);
      const ports = svc?.ports || {};
      for (const [portName, port] of Object.entries(ports)) {
        console.log(`  - Port: ${portName}`);
        const binding = port?.binding;
        const methods = binding?.methods || {};
        const methodNames = Object.keys(methods);
        console.log(`    Methods: ${methodNames.join(', ')}`);

        // Print Search operation input schema if present
        if (methods.Search) {
          console.log('    === Search Operation ===');
          const search = methods.Search;
          console.log('    Search.input:', safeInspect(search.input, 6));
          console.log('    Search.output:', safeInspect(search.output, 6));
          // Also print the first element names for the body
          const inputBody = search?.input?.$lookupTypes || search?.input?.parts || search?.input;
          console.log('    Search.input summary:', safeInspect(inputBody, 3));
        }
      }
    }
  } catch (err) {
    console.error('Error describing WSDL:', err?.message || err);
    process.exit(1);
  }
}

run();
