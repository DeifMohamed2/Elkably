# Student Code Management System Updates

## Overview

This document describes the updates made to the student code management system in the Elkably platform.

## Changes Implemented

### 1. Dark Mode for studentsRequests.ejs

- Added dark mode styling to the studentsRequests.ejs page
- Updated all UI elements to use dark color scheme variables
- Enhanced readability and reduced eye strain for users working at night

### 2. Enhanced Search Functionality

- Updated search functionality to handle student codes with various letter prefixes (G, O, K)
- Improved the following search functions to accept any letter prefix:
  - `advancedStudentSearch`
  - `getSingleUserAllData`
  - `getDataToTransferring`
  - `transferStudent`
- Search now works with or without prefixes and is case-insensitive

### 3. Student Code Update Scripts

Created two scripts to manage student code prefixes:

#### updateOnlineStudentCodes.js

- Specifically updates Online students' codes from O prefix to K prefix
- Automatically finds all Online students with O-prefixed codes
- Updates them to use K prefix while preserving the numeric portion

#### runCodeUpdate.js

- Interactive command-line tool for managing student code prefixes
- Provides options to:
  - Update Online students from O to K
  - Update GTA students from G to another prefix
  - Update codes for any custom center and prefix combination
- Includes detailed logging and error handling

## How to Use the Code Update Scripts

### To Update Online Students' Codes (O to K)

```bash
node scripts/updateOnlineStudentCodes.js
```

### To Use the Interactive Code Update Tool

```bash
node scripts/runCodeUpdate.js
```

Follow the on-screen prompts to select the desired operation.

## Important Notes

- The search system now accepts codes with or without prefixes
- All search functions have been updated to handle G, O, K, or any other letter prefix
- Dark mode styling is applied automatically to the studentsRequests.ejs page
