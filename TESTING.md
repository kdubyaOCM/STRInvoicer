# Testing Guide

This document provides comprehensive information about testing the STR Invoicer application.

## 📋 Table of Contents

- [Overview](#overview)
- [Testing Environment Setup](#testing-environment-setup)
- [Running Tests](#running-tests)
- [Writing New Tests](#writing-new-tests)
- [Testing Best Practices](#testing-best-practices)
- [Manual Testing](#manual-testing)

## Overview

Currently, STR Invoicer is in active development and does not have an automated test suite configured. This document outlines the plan for future test implementation and provides guidance for manual testing in the interim.

## Testing Environment Setup

### Prerequisites

Before setting up the testing environment, ensure you have:

- Node.js (version 18.x or higher)
- npm or yarn package manager
- All project dependencies installed (`npm install`)

### Future Test Framework (Planned)

When automated testing is implemented, the recommended testing stack will include:

- **Vitest** - Fast unit test framework compatible with Vite
- **React Testing Library** - For testing React components
- **@testing-library/user-event** - For simulating user interactions
- **@testing-library/jest-dom** - For custom DOM matchers

### Installation (When Tests Are Added)

```bash
npm install --save-dev vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

## Running Tests

### Current State

As of now, there are no automated tests configured. Manual testing is required for validation.

### Future Commands (Planned)

When test infrastructure is added, the following commands will be available:

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage report
npm test -- --coverage

# Run specific test file
npm test -- processor.test.ts
```

## Writing New Tests

### Test File Structure

Tests should be organized following these conventions:

```
STRInvoicer/
├── __tests__/
│   ├── unit/
│   │   ├── processor.test.ts
│   │   ├── excelService.test.ts
│   │   └── types.test.ts
│   ├── integration/
│   │   ├── dataFlow.test.ts
│   │   └── sessionPersistence.test.ts
│   └── components/
│       ├── StepLoad.test.tsx
│       ├── StepMap.test.tsx
│       ├── StepReview.test.tsx
│       └── StepInvoice.test.tsx
└── ...
```

### Unit Test Example

Here's an example of how to test the data processor:

```typescript
// __tests__/unit/processor.test.ts
import { describe, it, expect } from 'vitest';
import { processData, generateInitialMappings } from '../../services/processor';
import { ExpenseCategory } from '../../types';

describe('Data Processor', () => {
  describe('generateInitialMappings', () => {
    it('should auto-detect common OTA field names', () => {
      const otaData = [
        {
          'Booking ID': '123',
          'Check In': '2024-01-01',
          'Guest Name': 'John Doe',
          Payout: 100,
        },
      ];
      const glData = [];

      const mappings = generateInitialMappings(otaData, glData);

      expect(mappings.ota.reservation_id).toBe('Booking ID');
      expect(mappings.ota.check_in_date).toBe('Check In');
    });
  });

  describe('processData', () => {
    it('should correctly categorize expenses', () => {
      // Test implementation
    });

    it('should reconcile OTA payouts with GL income', () => {
      // Test implementation
    });
  });
});
```

### Component Test Example

Here's an example of how to test React components:

```typescript
// __tests__/components/StepLoad.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StepLoad } from '../../components/StepLoad';

describe('StepLoad Component', () => {
  it('should render file upload controls', () => {
    const mockOnNext = vi.fn();
    const mockOnResume = vi.fn();

    render(
      <StepLoad
        initialConfig={{}}
        onNext={mockOnNext}
        onResumeSession={mockOnResume}
      />
    );

    expect(screen.getByText(/Upload OTA Data/i)).toBeInTheDocument();
    expect(screen.getByText(/Upload GL Data/i)).toBeInTheDocument();
  });

  it('should validate required fields before proceeding', () => {
    // Test implementation
  });
});
```

### Integration Test Example

```typescript
// __tests__/integration/dataFlow.test.ts
import { describe, it, expect } from 'vitest';

describe('End-to-End Data Flow', () => {
  it('should process data through all steps correctly', async () => {
    // 1. Load sample data
    // 2. Generate mappings
    // 3. Process data
    // 4. Verify output structure
    // 5. Generate invoice
  });
});
```

## Testing Best Practices

### General Guidelines

1. **Test Naming**: Use descriptive test names that explain what is being tested

   ```typescript
   // Good
   it('should calculate management fee as 20% of gross revenue when feeBaseMode is gross_revenue');

   // Not ideal
   it('calculates fee');
   ```

2. **Test Organization**: Group related tests using `describe` blocks

3. **Test Isolation**: Each test should be independent and not rely on other tests

4. **Mock External Dependencies**: Mock file uploads, API calls, and browser APIs

5. **Test Edge Cases**: Include tests for:
   - Empty data sets
   - Invalid input formats
   - Boundary conditions
   - Error handling

### Component Testing Guidelines

1. **User-Centric Tests**: Test components from the user's perspective
2. **Avoid Implementation Details**: Test behavior, not implementation
3. **Accessibility**: Include tests for keyboard navigation and screen readers
4. **Visual Regression**: Consider snapshot tests for complex UI components

### Data Processing Tests

Key areas to test:

1. **Date Parsing**:
   - Excel serial dates
   - Various date formats
   - Invalid dates

2. **Number Parsing**:
   - Negative numbers in parentheses
   - Currency symbols
   - Decimal precision

3. **Categorization Logic**:
   - Auto-classification rules
   - Manual assignment
   - Split percentages

4. **Reconciliation**:
   - Matching OTA payouts with GL income
   - Handling unmatched transactions
   - Date range filtering

## Manual Testing

Until automated tests are implemented, use this checklist for manual testing:

### Load Data Step

- [ ] Upload valid OTA CSV file
- [ ] Upload valid GL CSV file
- [ ] Upload OTA Excel (.xlsx) file
- [ ] Upload GL Excel (.xlsx) file
- [ ] Verify error handling for invalid files
- [ ] Test with empty files
- [ ] Test with missing required columns
- [ ] Configure all required fields (dates, names, percentages)
- [ ] Resume from saved session file
- [ ] Verify validation messages for incomplete config

### Map Columns Step

- [ ] Verify auto-detected mappings are correct
- [ ] Manually map all required OTA fields
- [ ] Manually map all required GL fields
- [ ] Test with CSV files having different column names
- [ ] Navigate back to Load step and verify data persists
- [ ] Proceed with incomplete mappings (should show error)

### Review & Assign Step

- [ ] Verify OTA bookings display correctly
- [ ] Verify GL transactions display correctly
- [ ] Classify expenses to different categories
- [ ] Set split percentages for shared expenses
- [ ] Mark items for exclusion
- [ ] Add notes to specific transactions
- [ ] Reconcile OTA payouts with GL income
- [ ] Save draft session
- [ ] Filter and search transactions
- [ ] Sort by different columns

### Invoice Generation Step

- [ ] Verify revenue summary is accurate
- [ ] Verify expense categorization is correct
- [ ] Verify management fee calculation
- [ ] Verify net payout calculation
- [ ] Export to Excel and verify file contents
- [ ] Print/PDF export and verify formatting
- [ ] Verify all owner and manager information displays correctly
- [ ] Check calculations for edge cases (zero revenue, all expenses)

### Cross-Browser Testing

Test the application in:

- [ ] Google Chrome (latest)
- [ ] Mozilla Firefox (latest)
- [ ] Microsoft Edge (latest)
- [ ] Safari (latest, macOS)

### Responsive Design Testing

Test on different screen sizes:

- [ ] Desktop (1920x1080)
- [ ] Laptop (1366x768)
- [ ] Tablet (768x1024)
- [ ] Mobile (375x667)

### Performance Testing

- [ ] Load large datasets (1000+ OTA bookings, 5000+ GL transactions)
- [ ] Measure page load time
- [ ] Test session save/restore with large data
- [ ] Check memory usage during processing

### Data Validation Testing

Test with various data scenarios:

- [ ] Multiple OTA platforms (different formats)
- [ ] Different date formats (MM/DD/YYYY, DD/MM/YYYY, ISO)
- [ ] Different number formats (with/without currency symbols)
- [ ] Negative values (refunds, credits)
- [ ] Missing optional fields
- [ ] Special characters in names and descriptions
- [ ] Very long text fields

## Contributing to Tests

When adding new features, please:

1. Add corresponding test cases
2. Update this documentation with new test scenarios
3. Ensure all existing tests pass
4. Maintain test coverage above 80%
5. Document any complex test scenarios

## Future Enhancements

Planned improvements to the testing infrastructure:

- [ ] Set up Vitest with React Testing Library
- [ ] Implement CI/CD pipeline for automated testing
- [ ] Add E2E tests with Playwright or Cypress
- [ ] Set up visual regression testing
- [ ] Implement code coverage reporting
- [ ] Add performance benchmarking tests
- [ ] Create test data generators for various scenarios

## Questions and Support

If you have questions about testing or encounter issues:

1. Check this documentation first
2. Review existing test examples (when available)
3. Create an issue on GitHub with the `testing` label
4. Contact the maintainers for guidance

---

**Last Updated:** February 2026  
**Status:** Testing framework to be implemented
