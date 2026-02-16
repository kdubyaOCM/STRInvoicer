<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# STR Invoicer App

A comprehensive application for processing short-term rental (STR) invoices, handling OTA (Online Travel Agency) bookings, and general ledger reconciliation. This app provides automated data processing with support for Microsoft Excel files, CSV parsing, and intelligent expense categorization.

View your app in AI Studio: https://ai.studio/apps/drive/1JESjI5e9HPDtnTHMufsD7mcXbKROPfGU

## Features

### Excel File Processing
The application includes robust support for Microsoft Excel files:

- **Excel Serial Date Conversion**: Automatically converts Excel serial date numbers (e.g., 44927) to standard ISO date format (YYYY-MM-DD). This handles the Excel date system where dates are stored as the number of days since January 1, 1900.
  
- **Spreadsheet Reading**: Reads and parses Excel spreadsheets (`.xlsx`, `.xls`) and CSV files using the `xlsx` library. The app can extract data from the first sheet of a workbook and convert it to JSON format for processing.

- **Classification Mapping**: Supports uploading Excel/CSV files that define account classification rules, mapping account names to expense categories (REIMBURSABLE, MANAGER_ONLY, OWNER_ONLY, SHARED, etc.).

### Data Processing Capabilities

- **OTA Booking Data**: Process booking statements from platforms like Airbnb, Vrbo, and Booking.com
- **General Ledger Integration**: Import accounting exports to reconcile transactions
- **Automated Reconciliation**: Match OTA payouts with GL income entries
- **Expense Categorization**: Intelligently classify expenses with customizable rules
- **Invoice Generation**: Create professional invoices with detailed breakdowns

## Run Locally

**Prerequisites:**  
- Node.js (v16 or higher)
- Modern web browser

**Dependencies:**
- `xlsx` (v0.18.5) - Excel file reading and parsing
- `react` & `react-dom` - UI framework
- `date-fns` - Date manipulation and validation
- `lucide-react` - Icons
- `recharts` - Data visualization

### Setup Instructions

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key

3. Run the app:
   ```bash
   npm run dev
   ```

4. Open your browser to the URL shown in the terminal (typically `http://localhost:5173`)

## Usage

### File Upload and Processing

1. **Upload Data Sources**: The app accepts three types of files (all in Excel or CSV format):
   - **OTA Export** (Required): Booking statements containing reservation details, check-in/out dates, guest names, amounts, and payout information
   - **General Ledger** (Required): Accounting export with transaction dates, account names, descriptions, and debit/credit amounts
   - **Classification Map** (Optional): Mapping file that defines how account names should be categorized

2. **Excel Date Handling**: When uploading files with date columns, the app automatically detects and converts:
   - Excel serial dates (numeric values like 44927)
   - Standard date strings (ISO format, US format, etc.)
   - The conversion uses the formula: `JS_Date = (Excel_Serial - 25569) * 86400 * 1000`

3. **Configuration**: Set your reporting period, management fee percentage, and entity details

4. **Column Mapping**: Map the columns from your uploaded files to the expected fields (auto-detection provided)

5. **Review & Categorize**: Review expense classifications and make adjustments as needed

6. **Generate Invoice**: Create a final invoice with reconciled data and expense breakdowns

### Supported File Formats

- `.xlsx` - Microsoft Excel (2007+)
- `.xls` - Microsoft Excel (97-2003)
- `.csv` - Comma-Separated Values

## Excel Integration Details

### Serial Date Conversion
The `parseDateLoose()` function in `services/processor.ts` handles Excel serial dates:
```typescript
if (typeof val === 'number') {
  // Excel date to JS date
  const date = new Date(Math.round((val - 25569) * 86400 * 1000));
  return isValid(date) ? date.toISOString().split('T')[0] : null;
}
```

### Spreadsheet Reading
The `readSpreadsheet()` function in `services/excelService.ts` provides the core Excel reading functionality:
- Reads file as binary string
- Parses workbook using `XLSX.read()`
- Extracts first sheet and converts to JSON
- Returns array of row objects with column headers as keys

### Classification Map Parsing
The `parseClassificationMap()` function processes mapping files:
- Looks for columns containing "account" and "category" keywords
- Creates a mapping of account names to expense categories
- Case-insensitive matching for flexibility

## Technical Architecture

- **Frontend**: React 19 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Data Processing**: Custom TypeScript processors with date-fns utilities
- **Excel Handling**: SheetJS (xlsx) library

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on contributing to this project, including how to modify Excel handling logic.

## Testing

See [TESTING.md](TESTING.md) for instructions on testing the application, including Excel data processing tests.

## License

This project is private and proprietary.
