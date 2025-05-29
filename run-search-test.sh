#!/bin/bash

# Run the test and capture all output
node test-search-fixed.js > test-output.log 2>&1

# Display the output
cat test-output.log 