# GitHub Copilot Instructions for STR Invoicer

## Project Overview

STR Invoicer is an **offline-first web application** designed to streamline financial management and invoice generation for short-term rental (STR) property managers. The application processes OTA (Online Travel Agency) booking data, reconciles general ledger expenses, categorizes transactions, and generates professional invoices for property owners.

**Key Characteristics:**
- All processing happens client-side in the browser
- No backend server or external API calls (except optional AI Studio features)
- Complete offline functionality for data privacy and security
- Session persistence for saving and resuming complex reconciliations

## Tech Stack

- **Frontend Framework:** React 19 with functional components and hooks
- **Language:** TypeScript (strict type checking)
- **Build Tool:** Vite
- **Styling:** Tailwind CSS (utility classes in JSX, no separate CSS files)
- **Date Handling:** date-fns
- **File Processing:** xlsx (SheetJS) for Excel/CSV parsing
- **Charts:** Recharts for data visualization
- **Icons:** Lucide React
- **ID Generation:** uuid

## Application Architecture

### Four-Step Workflow

The application follows a strict four-step process that users must complete in order:

1. **LOAD** - Upload OTA and GL files, configure settings (dates, manager info, fees)
2. **MAP** - Map CSV columns to required canonical fields
3. **REVIEW** - Categorize expenses, reconcile transactions, flag issues
4. **INVOICE** - Generate and export professional invoices

### Data Types

Always work with these canonical data types after processing:

- **CanonicalOtaRow** - Normalized OTA booking records
- **CanonicalGlRow** - Normalized general ledger transaction records

Raw CSV data is transformed into these canonical types to ensure consistent handling regardless of input format.

### Expense Categories

Use these six categories for expense classification:

- `OWNER_ONLY` - Owner's expense, not reimbursed
- `MANAGER_ONLY` - Manager's expense
- `REIMBURSABLE` - Expense to charge the owner
- `SHARED` - Split between owner and manager (with percentage)
- `EXCLUDE` - Ignore in calculations
- `REVIEW_ALWAYS` - Needs manual review

## Coding Standards

### TypeScript Guidelines

- **Always use TypeScript** for all new code
- **Define explicit types** - avoid `any` unless absolutely necessary
- **Use interfaces** for object shapes, especially props
- **Leverage type inference** but be explicit for function returns
- **Prefer type safety** over convenience

Example:
```typescript
interface ExpenseRowProps {
  expense: CanonicalGlRow;
  onCategoryChange: (id: string, category: ExpenseCategory) => void;
}

export const ExpenseRow: React.FC<ExpenseRowProps> = ({ expense, onCategoryChange }) => {
  // Implementation
};
```

### React Best Practices

- **Use functional components** exclusively (no class components)
- **Use React hooks** (useState, useEffect, useMemo, useCallback)
- **Keep components focused** - single responsibility principle
- **Extract reusable logic** into custom hooks
- **Avoid prop drilling** - use composition or context when appropriate
- **Memoize expensive calculations** with useMemo and useCallback

### Naming Conventions

Follow these conventions strictly:

- **Components:** PascalCase - `StepLoad`, `InvoiceTable`, `ExpenseRow`
- **Functions:** camelCase - `processData`, `generateInvoice`, `calculateFee`
- **Constants:** UPPER_SNAKE_CASE - `REQUIRED_OTA_FIELDS`, `DEFAULT_FEE_PERCENT`
- **Types/Interfaces:** PascalCase - `ConfigState`, `CanonicalOtaRow`, `ProcessStep`
- **Files:** Match the export name - `StepLoad.tsx`, `processor.ts`, `types.ts`

### File Organization

```
STRInvoicer/
├── components/          # React components (Step*.tsx files)
├── services/            # Business logic (processor.ts, excelService.ts)
├── App.tsx             # Main application component
├── types.ts            # All TypeScript type definitions
├── constants.ts        # Application-wide constants
├── index.tsx           # Application entry point
└── vite.config.ts      # Build configuration
```

**Guidelines:**
- One component per file (unless tightly coupled helper components)
- Keep business logic in `services/` separate from UI components
- All types and interfaces go in `types.ts`
- All constants go in `constants.ts`

### Import Organization

Order imports consistently:

```typescript
// 1. External libraries
import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';

// 2. Internal types
import { ProcessStep, ConfigState } from './types';

// 3. Internal services
import { processData } from './services/processor';

// 4. Internal components
import { StepLoad } from './components/StepLoad';
```

### Code Style

- **Use meaningful variable names** - clarity over brevity
- **Keep functions small** - single responsibility
- **Avoid deep nesting** - extract nested logic into functions
- **Comment complex logic** - explain "why", not "what"
- **Use JSDoc** for public functions and complex operations

Example:
```typescript
/**
 * Processes OTA and GL data, categorizes expenses, and reconciles transactions.
 * 
 * @param files - Raw data from uploaded files
 * @param config - User configuration including dates and fee structure
 * @param mappings - Column mappings from user input
 * @returns Processed data ready for review and invoice generation
 */
export const processData = (
  files: FilesState,
  config: ConfigState,
  mappings: MappingState
): ProcessedDataState => {
  // Implementation
};
```

## Development Workflow

### Branching Strategy

- `main` - Production-ready code, always stable
- `feature/*` - New features (e.g., `feature/add-export-to-pdf`)
- `fix/*` - Bug fixes (e.g., `fix/date-parsing-error`)
- `docs/*` - Documentation updates (e.g., `docs/update-api-reference`)

### Commit Messages

Follow Conventional Commits specification:

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, etc.)
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

Example:
```
feat: add expense filtering by category

- Add filter dropdown to expense table
- Implement category-based filtering logic
- Update UI to show active filters
```

## Common Patterns

### State Management

State is managed locally within components using React hooks. For shared state across steps, lift state up to the main `App.tsx` component.

### Error Handling

- Validate user input before processing
- Handle file parsing errors gracefully
- Provide clear error messages to users
- Log errors to console for debugging (console.error)
- Never let the app crash - catch and handle all errors

### Performance Considerations

- Use `React.memo` for expensive components
- Use `useMemo` for expensive calculations
- Use `useCallback` for event handlers passed as props
- Lazy load large datasets when possible
- Debounce user input for search and filters

### Session Persistence

Users can save and load sessions as JSON files. Ensure all state is serializable:
- Avoid storing functions or DOM references in state
- Use ISO strings for dates in saved sessions
- Parse dates back when loading sessions

## Testing

Currently, the project uses manual testing. When writing new features:

1. Test the happy path (normal workflow)
2. Test edge cases (empty files, invalid data, missing fields)
3. Test error handling (intentionally cause errors)
4. Test across browsers (Chrome, Firefox, Safari)
5. Test responsive behavior on different screen sizes

## Privacy and Security

**Critical:** This app is designed for privacy. Never:
- Send financial data to external servers
- Store sensitive data in localStorage without user consent
- Include telemetry or analytics that track user data
- Add dependencies that phone home or track usage

All processing must remain client-side unless explicitly part of optional AI Studio features.

## Additional Resources

- **README.md** - Project overview and setup instructions
- **CONTRIBUTING.md** - Detailed contribution guidelines
- **DEVELOPER_ONBOARDING.md** - Comprehensive developer guide
- **API.md** - API reference for types and functions
- **TESTING.md** - Testing guidelines and manual checklist

## Questions?

When in doubt:
1. Check existing code for similar patterns
2. Review the documentation files
3. Follow the principle of least change
4. Prioritize code clarity and type safety
5. Ask for clarification in pull requests
