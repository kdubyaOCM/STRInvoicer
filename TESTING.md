# Testing Guide

This document provides instructions for testing the STR Invoicer application, with special focus on Excel data processing functionality.

## Overview

The application currently uses manual testing through the UI. There are no automated unit or integration tests at this time. This guide describes how to manually test key features, particularly those related to Excel file handling.

## Prerequisites

Before testing, ensure you have:

- Node.js (v16 or higher) installed
- The application running locally (`npm run dev`)
- Sample Excel/CSV files for testing

## Test Data Preparation

### Creating Test Files

#### 1. OTA Export Test File

Create an Excel/CSV file with the following columns:
- `Reference` or `Booking ID` - Reservation identifier
- `Check-in Date` or `Check In` - Check-in date (can be Excel serial date or string)
- `Checkout Date` or `Check Out` - Checkout date
- `Guest Name` - Name of the guest
- `Amount` or `Gross` - Total booking amount
- `Commission` or `Fee` - OTA fees
- `Net` or `Payout` - Net payout amount
- `Payout Date` or `Paid On` - Date of payout

**Excel Serial Date Testing**: Include rows with dates as numbers (e.g., 44927 for January 1, 2023) to test the serial date conversion.

#### 2. General Ledger Test File

Create an Excel/CSV file with these columns:
- `Date` - Transaction date (test with both serial dates and strings)
- `Account` or `Account Code` - Account identifier
- `Description` or `Detail` - Transaction description
- `Contact` or `Payee` - Contact/payee name
- `Debit` or `Expense` - Debit amount
- `Credit` or `Income` - Credit amount

**Single Column Mode Testing**: You can also test with a single `Amount` column where positive values are credits and negative values are debits.

#### 3. Classification Map Test File

Create a simple two-column Excel/CSV file:
- `Account Name` - Account identifier matching GL accounts
- `Category` - One of: REIMBURSABLE, MANAGER_ONLY, OWNER_ONLY, SHARED, EXCLUDE

Example:
```
Account Name,Category
Utilities,REIMBURSABLE
Property Tax,OWNER_ONLY
Management Fee,MANAGER_ONLY
Cleaning,SHARED
```

## Manual Testing Procedures

### Test 1: Excel Serial Date Conversion

**Purpose**: Verify that Excel serial dates are correctly converted to ISO date format.

**Steps**:
1. Create an OTA export file with at least one date column containing numeric Excel serial dates
   - Example: 44927 should convert to 2023-01-01
   - Example: 45292 should convert to 2024-01-01
2. Upload the file in Step 1 of the application
3. Continue to the mapping step
4. After processing, check the "Review" step to verify dates appear in YYYY-MM-DD format
5. Verify the dates are correct by comparing with the expected dates

**Expected Result**: Excel serial dates should be accurately converted to readable ISO date strings.

**Test Cases**:
- Positive serial numbers (dates after 1900-01-01)
- Recent dates (2020-2026)
- Edge cases near reporting period boundaries

### Test 2: Spreadsheet and CSV File Reading

**Purpose**: Verify the application can read various Excel and CSV file formats.

**Steps**:
1. Prepare test files in different formats:
   - `.xlsx` (Excel 2007+)
   - `.xls` (Excel 97-2003, if available)
   - `.csv` (comma-separated values)
2. Upload each file type as OTA export or GL data
3. Verify the data is correctly parsed and displayed in the mapping step

**Expected Result**: All file formats should be successfully read, with data appearing in the column mapper.

**Test Cases**:
- Files with different encodings (UTF-8, Windows-1252)
- Files with empty cells
- Files with numeric and text data mixed
- Files with special characters in headers or data

### Test 3: Classification Map Parsing

**Purpose**: Verify that classification map files are correctly parsed and applied.

**Steps**:
1. Create a classification map file with several account-to-category mappings
2. Upload the classification map in Step 1
3. Upload a GL file that contains accounts matching your classification map
4. Proceed through the mapping step
5. In the Review step, verify that expenses are automatically categorized according to your map

**Expected Result**: 
- Accounts in the classification map should be auto-categorized
- The category assignments should match the map
- Accounts not in the map should be marked for review

**Test Cases**:
- Exact account name matches
- Case-insensitive matching (e.g., "utilities" should match "Utilities")
- Accounts with special characters
- Missing accounts (not in the map)

### Test 4: Date Parsing Edge Cases

**Purpose**: Test various date formats and edge cases.

**Steps**:
1. Create files with dates in various formats:
   - Excel serial dates (numbers)
   - ISO format (YYYY-MM-DD)
   - US format (MM/DD/YYYY)
   - European format (DD/MM/YYYY)
   - Invalid dates (text, empty cells)
2. Upload and process the files
3. Check the processed data in the Review step

**Expected Result**:
- Valid dates should be parsed and converted to ISO format
- Invalid dates should be handled gracefully (null or empty)
- No application crashes or errors

### Test 5: OTA-GL Reconciliation

**Purpose**: Verify that OTA payouts are matched with GL income entries.

**Steps**:
1. Create an OTA file with a booking that has:
   - Check-in date: 2024-01-15
   - Payout date: 2024-01-18
   - Net payout: $500.00
2. Create a GL file with a matching income entry:
   - Date: 2024-01-18 (or within 3 days)
   - Credit amount: $500.00 (or within $2)
   - Description: Contains "booking" or "payout" or guest name
3. Upload both files and process
4. Check the Review step for reconciliation status

**Expected Result**:
- Matched GL income entries should be marked as "reconciled"
- Reconciliation count should be displayed
- Unmatched entries should be flagged

### Test 6: Number Parsing

**Purpose**: Verify that various number formats are correctly parsed.

**Steps**:
1. Create test files with amounts in different formats:
   - Simple numbers: 123.45
   - Accounting negatives: (123.45)
   - Currency symbols: $123.45
   - Thousands separators: 1,234.56
2. Upload and process
3. Verify amounts are correctly interpreted

**Expected Result**: All number formats should be parsed correctly with proper sign handling.

## Excel-Specific Test Scenarios

### Scenario 1: Complete Excel Workflow Test

1. **Prepare three Excel files** (.xlsx format):
   - OTA export with 10 bookings (mix of serial dates and string dates)
   - GL export with 50 transactions (mix of income and expenses)
   - Classification map with 10 account mappings

2. **Upload and configure**:
   - Upload all three files
   - Set reporting period (e.g., January 1, 2024 - January 31, 2024)
   - Configure management fee (e.g., 20% of gross revenue)
   - Set entity details

3. **Map columns**:
   - Verify auto-detection of columns
   - Adjust any incorrect mappings
   - Proceed to next step

4. **Review data**:
   - Check that all dates are properly formatted
   - Verify expense categorizations
   - Review reconciled items
   - Check statistics (total revenue, reconciled count)

5. **Generate invoice**:
   - Create final invoice
   - Verify all amounts are correct
   - Export/print invoice

**Expected Result**: Complete workflow should execute without errors, producing an accurate invoice.

### Scenario 2: Large File Performance Test

1. Create Excel files with large datasets:
   - OTA export: 500+ bookings
   - GL export: 2000+ transactions
2. Upload and process
3. Measure time to parse and display results

**Expected Result**: Application should handle large files without freezing or crashing.

### Scenario 3: Malformed Data Handling

1. Create Excel files with problematic data:
   - Missing required columns
   - Empty rows
   - Invalid dates (text in date fields)
   - Negative amounts where not expected
2. Upload and process
3. Observe error handling

**Expected Result**: Application should provide clear error messages or handle issues gracefully.

## Testing Checklist

Use this checklist when performing a comprehensive test:

- [ ] Excel serial dates convert correctly to ISO format
- [ ] .xlsx files can be read and parsed
- [ ] .csv files can be read and parsed
- [ ] Classification map is correctly applied
- [ ] Auto-detection of columns works for common column names
- [ ] Manual column mapping can override auto-detection
- [ ] Date filtering by reporting period works correctly
- [ ] OTA-GL reconciliation matches entries accurately
- [ ] Number parsing handles various formats
- [ ] Single-column GL amount mode works (positive/negative)
- [ ] Two-column GL mode works (separate debit/credit)
- [ ] Negative amounts are handled correctly (reversals)
- [ ] Empty cells don't cause errors
- [ ] Large files (500+ rows) process successfully
- [ ] Invoice generation produces accurate results

## Reporting Issues

If you encounter issues during testing:

1. Note the specific test scenario and steps to reproduce
2. Capture any error messages or console logs
3. Include sample data files (if not sensitive)
4. Describe expected vs. actual behavior
5. Report through the project's issue tracker

## Future Testing Enhancements

Potential improvements to the testing infrastructure:

- Add automated unit tests for core functions:
  - `parseDateLoose()` - Date conversion logic
  - `parseNumber()` - Number parsing logic
  - `readSpreadsheet()` - Excel reading
  - `parseClassificationMap()` - Classification parsing
  
- Add integration tests for:
  - End-to-end data processing workflow
  - File upload and parsing
  - Reconciliation algorithm
  
- Add test fixtures:
  - Sample Excel files with known data
  - Expected output JSON files
  - Edge case data sets

- Consider testing frameworks:
  - Jest for unit tests
  - React Testing Library for component tests
  - Cypress or Playwright for E2E tests
