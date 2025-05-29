#!/usr/bin/env ts-node

import { runDiagnostics } from '../server/tests/amazonApiDiagnostic';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Run the diagnostics
runDiagnostics()
  .then(() => {
    console.log('\n✨ Diagnostics completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Diagnostics failed:', error);
    process.exit(1);
  }); 