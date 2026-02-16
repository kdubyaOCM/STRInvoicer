# Contributing to STR Invoicer

Thank you for your interest in contributing to the STR Invoicer application! This document provides guidelines for contributing to the project, with special focus on Excel handling logic.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Code Structure](#code-structure)
- [Excel Handling Logic](#excel-handling-logic)
- [Making Changes](#making-changes)
- [Testing Your Changes](#testing-your-changes)
- [Submitting Changes](#submitting-changes)
- [Code Style Guidelines](#code-style-guidelines)

## Getting Started

Before contributing, please:

1. Familiarize yourself with the application by running it locally
2. Read the [README.md](README.md) to understand the features
3. Review the [TESTING.md](TESTING.md) to understand testing procedures
4. Check existing issues and pull requests to avoid duplicates

## Development Setup

### Prerequisites

- **Node.js**: Version 16 or higher
- **npm**: Comes with Node.js
- **Git**: For version control
- **Code Editor**: VS Code recommended with TypeScript support

### Initial Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/kdubyaOCM/STRInvoicer.git
   cd STRInvoicer
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env.local` file and add your Gemini API key:
   ```
   GEMINI_API_KEY=your_api_key_here
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

5. Open your browser to `http://localhost:5173`

## Code Structure

The project follows this structure:

```
STRInvoicer/
├── components/           # React components
│   ├── StepLoad.tsx     # File upload and configuration
│   ├── StepMap.tsx      # Column mapping interface
│   ├── StepReview.tsx   # Data review and categorization
│   └── StepInvoice.tsx  # Invoice generation
├── services/            # Business logic services
│   ├── excelService.ts  # Excel file reading and parsing
│   └── processor.ts     # Data processing and reconciliation
├── App.tsx              # Main application component
├── types.ts             # TypeScript type definitions
├── constants.ts         # Application constants
├── index.tsx            # Application entry point
├── index.html           # HTML template
├── package.json         # Dependencies and scripts
└── tsconfig.json        # TypeScript configuration
```

### Key Files for Excel Handling

- **`services/excelService.ts`**: Core Excel reading functionality
- **`services/processor.ts`**: Data transformation including date conversion
- **`types.ts`**: Type definitions for data structures
- **`components/StepLoad.tsx`**: File upload UI and initial processing

## Excel Handling Logic

### Overview

The application uses the `xlsx` library (SheetJS) to read Excel and CSV files. The main Excel-related functionality includes:

1. **File Reading**: Converting Excel/CSV files to JSON arrays
2. **Date Conversion**: Converting Excel serial dates to ISO format
3. **Classification Parsing**: Reading account-to-category mapping files

### Excel Service (`services/excelService.ts`)

#### `readSpreadsheet(file: File): Promise<any[]>`

Reads an Excel or CSV file and converts it to a JSON array.

**Implementation Details**:
- Uses `FileReader` to read the file as a binary string
- Parses the workbook with `XLSX.read()`
- Extracts the first sheet
- Converts sheet to JSON with empty cells defaulting to `''`

**When to Modify**:
- Adding support for multi-sheet workbooks
- Changing default value handling
- Adding data validation during read
- Supporting additional file formats

**Example Modification** (reading specific sheet):
```typescript
export const readSpreadsheetByName = async (
  file: File, 
  sheetName: string
): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        
        // Check if sheet exists
        if (!workbook.Sheets[sheetName]) {
          throw new Error(`Sheet "${sheetName}" not found`);
        }
        
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
        resolve(jsonData);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsBinaryString(file);
  });
};
```

#### `parseClassificationMap(file: File): Promise<Record<string, string>>`

Parses a classification mapping file.

**Implementation Details**:
- Uses `readSpreadsheet()` to read the file
- Searches for columns containing "account" and "category"
- Case-insensitive column matching
- Trims whitespace and normalizes category to uppercase

**When to Modify**:
- Adding support for additional column name variations
- Changing case sensitivity rules
- Adding validation for category values
- Supporting multi-column keys

**Best Practices**:
- Always validate that required columns exist
- Provide helpful error messages if parsing fails
- Handle edge cases (empty rows, missing values)
- Consider case-insensitive matching for flexibility

### Data Processor (`services/processor.ts`)

#### `parseDateLoose(val: any): string | null`

Converts various date formats to ISO date strings.

**Implementation Details**:
```typescript
const parseDateLoose = (val: any): string | null => {
  if (!val) return null;
  
  // Excel serial date conversion
  if (typeof val === 'number') {
    const date = new Date(Math.round((val - 25569) * 86400 * 1000));
    return isValid(date) ? date.toISOString().split('T')[0] : null;
  }
  
  // String date parsing
  const str = String(val).trim();
  const d = new Date(str);
  if (isValid(d)) return d.toISOString().split('T')[0];
  
  return null;
};
```

**Excel Serial Date Formula**:
- Excel stores dates as days since January 1, 1900
- Adjustment factor: 25569 days (difference between Excel epoch and Unix epoch)
- Conversion: `(serial - 25569) * 86400 * 1000` milliseconds

**When to Modify**:
- Supporting additional date formats (DD/MM/YYYY, etc.)
- Handling different Excel date systems (Mac Excel uses 1904 system)
- Adding timezone support
- Improving date validation

**Example Enhancement** (1904 date system support):
```typescript
const parseDateLoose = (
  val: any, 
  use1904System: boolean = false
): string | null => {
  if (!val) return null;
  
  if (typeof val === 'number') {
    // 1904 system: epoch is January 1, 1904 (24107 days before 1970)
    // 1900 system: epoch is January 1, 1900 (25569 days before 1970)
    const offset = use1904System ? 24107 : 25569;
    const date = new Date(Math.round((val - offset) * 86400 * 1000));
    return isValid(date) ? date.toISOString().split('T')[0] : null;
  }
  
  const str = String(val).trim();
  const d = new Date(str);
  if (isValid(d)) return d.toISOString().split('T')[0];
  
  return null;
};
```

#### `parseNumber(val: any): number`

Converts various number formats to numeric values.

**Implementation Details**:
- Handles numeric types directly
- Strips currency symbols and thousands separators
- Supports accounting format: `(123.45)` = -123.45
- Returns 0 for invalid values

**When to Modify**:
- Supporting international number formats
- Adding decimal place rounding
- Handling percentage values
- Custom currency handling

## Making Changes

### Guidelines for Excel Handling Modifications

1. **Maintain Backward Compatibility**: Ensure existing Excel files continue to work
2. **Validate Input**: Always validate file content and structure
3. **Error Handling**: Provide clear error messages for invalid data
4. **Performance**: Consider file size limits and processing time
5. **Type Safety**: Use TypeScript types for all data structures

### Common Modification Scenarios

#### Adding a New Column to OTA or GL Mapping

1. Update the `MappingState` interface in `types.ts`:
   ```typescript
   export interface MappingState {
     ota: {
       // ... existing fields
       new_field: string;
     };
     // ...
   }
   ```

2. Update `generateInitialMappings()` in `services/processor.ts`:
   ```typescript
   return {
     ota: {
       // ... existing mappings
       new_field: findMatch(otaHeaders, ['new', 'field', 'name']),
     },
     // ...
   };
   ```

3. Update `processData()` to handle the new field:
   ```typescript
   const otaBookings: CanonicalOtaRow[] = files.otaRaw
     .map(row => ({
       // ... existing fields
       new_field: String(row[mappings.ota.new_field] || ''),
     }));
   ```

4. Update `CanonicalOtaRow` interface in `types.ts` if needed

#### Adding a New Expense Category

1. Update the `ExpenseCategory` enum in `types.ts`:
   ```typescript
   export enum ExpenseCategory {
     // ... existing categories
     NEW_CATEGORY = 'NEW_CATEGORY'
   }
   ```

2. Update classification logic in `services/processor.ts`:
   ```typescript
   if (row.default_category === ExpenseCategory.NEW_CATEGORY) {
     row.assigned_category = ExpenseCategory.NEW_CATEGORY;
     row.include_flag = true; // or false, depending on logic
   }
   ```

3. Update UI components to display the new category

#### Enhancing Excel Date Parsing

1. Modify `parseDateLoose()` in `services/processor.ts`
2. Add new format detection logic
3. Test with various date formats
4. Update documentation with supported formats

### Development Workflow

1. **Create a branch** for your feature or fix:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** following the code style guidelines

3. **Test thoroughly** using the procedures in [TESTING.md](TESTING.md)

4. **Commit your changes** with clear commit messages:
   ```bash
   git add .
   git commit -m "feat: Add support for multi-sheet Excel files"
   ```

5. **Push to your branch**:
   ```bash
   git push origin feature/your-feature-name
   ```

## Testing Your Changes

### Manual Testing Requirements

Before submitting changes related to Excel handling:

1. **Test with sample files**:
   - Create test files with various formats
   - Include edge cases (empty cells, special characters, large files)
   - Test both `.xlsx` and `.csv` formats

2. **Test date conversion**:
   - Verify Excel serial dates convert correctly
   - Test string dates in various formats
   - Check invalid date handling

3. **Test number parsing**:
   - Test various number formats
   - Verify negative numbers
   - Check currency symbols and separators

4. **Test classification mapping**:
   - Verify case-insensitive matching
   - Test with missing accounts
   - Check category validation

5. **Regression testing**:
   - Ensure existing functionality still works
   - Test the complete workflow end-to-end

### Testing Checklist

- [ ] Code compiles without TypeScript errors
- [ ] Excel files upload and parse correctly
- [ ] Date conversion works for serial dates
- [ ] Number parsing handles various formats
- [ ] Classification map applies correctly
- [ ] No console errors or warnings
- [ ] Large files (500+ rows) process successfully
- [ ] Error messages are clear and helpful

## Submitting Changes

### Pull Request Process

1. **Ensure all tests pass** and there are no regressions

2. **Update documentation**:
   - Update README.md if adding features
   - Update TESTING.md if changing test procedures
   - Update this CONTRIBUTING.md if changing development processes

3. **Write a clear PR description**:
   - Describe the changes and why they're needed
   - List any breaking changes
   - Include testing steps
   - Reference related issues

4. **Submit the pull request** and wait for review

### PR Title Format

Use conventional commits format:
- `feat: Add multi-sheet Excel support`
- `fix: Correct date conversion for 1904 system`
- `docs: Update Excel handling documentation`
- `refactor: Improve error handling in excelService`

## Code Style Guidelines

### TypeScript

- Use TypeScript for all new code
- Define interfaces for all data structures
- Avoid `any` type when possible
- Use async/await instead of callbacks

### Naming Conventions

- **Files**: camelCase for utilities, PascalCase for components
- **Functions**: camelCase (e.g., `parseNumber`, `readSpreadsheet`)
- **Interfaces**: PascalCase (e.g., `ConfigState`, `CanonicalOtaRow`)
- **Enums**: PascalCase with UPPER_CASE values

### Error Handling

- Always catch and handle errors from async operations
- Provide meaningful error messages
- Use try-catch blocks for file operations
- Return null or default values for parsing failures

### Comments

- Add comments for complex logic
- Document non-obvious behavior
- Explain "why" not "what" when possible
- Keep comments up-to-date with code changes

### Example Code Style

```typescript
/**
 * Converts Excel serial date to ISO date string.
 * 
 * Excel stores dates as the number of days since January 1, 1900.
 * This function converts that to a standard ISO date format (YYYY-MM-DD).
 * 
 * @param serialDate - Excel serial date number
 * @returns ISO date string or null if invalid
 */
const convertExcelSerialDate = (serialDate: number): string | null => {
  if (typeof serialDate !== 'number' || serialDate < 0) {
    return null;
  }
  
  try {
    // Convert Excel serial to JavaScript Date
    // 25569 is the offset between Excel and Unix epochs
    const date = new Date(Math.round((serialDate - 25569) * 86400 * 1000));
    
    // Validate the date
    if (!isValid(date)) {
      return null;
    }
    
    // Return ISO format (YYYY-MM-DD)
    return date.toISOString().split('T')[0];
  } catch (error) {
    console.error('Error converting Excel serial date:', error);
    return null;
  }
};
```

## Questions or Issues?

If you have questions about contributing or encounter issues:

1. Check existing documentation
2. Search for similar issues in the issue tracker
3. Open a new issue with a clear description
4. Reach out to the maintainers

## License

By contributing to this project, you agree that your contributions will be licensed under the same license as the project.
