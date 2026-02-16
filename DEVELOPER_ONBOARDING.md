# Developer Onboarding Guide

Welcome to the STR Invoicer development team! This guide will help you get started quickly and understand the project structure, conventions, and workflows.

## 📋 Table of Contents

- [Welcome](#welcome)
- [Quick Start](#quick-start)
- [Project Overview](#project-overview)
- [Architecture](#architecture)
- [Development Setup](#development-setup)
- [Key Concepts](#key-concepts)
- [Code Organization](#code-organization)
- [Development Workflow](#development-workflow)
- [Common Tasks](#common-tasks)
- [Troubleshooting](#troubleshooting)
- [Resources](#resources)

## Welcome

STR Invoicer is designed to help short-term rental property managers process financial data and generate professional invoices. As a developer, you'll be working with:

- **Frontend Framework:** React 19 with TypeScript
- **Build Tool:** Vite
- **UI Styling:** Tailwind CSS (utility classes in JSX)
- **Data Processing:** Client-side JavaScript (no backend)
- **File Handling:** SheetJS (xlsx) for Excel/CSV parsing

## Quick Start

### Prerequisites Checklist

Before you begin, ensure you have:

- [ ] Node.js 18.x or higher installed
- [ ] npm or yarn package manager
- [ ] Git configured with your GitHub account
- [ ] A code editor (VS Code recommended)
- [ ] Basic knowledge of React, TypeScript, and Git

### First-Time Setup (10 minutes)

1. **Clone the repository:**

   ```bash
   git clone https://github.com/kdubyaOCM/STRInvoicer.git
   cd STRInvoicer
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Start the development server:**

   ```bash
   npm run dev
   ```

4. **Open your browser:**
   Navigate to http://localhost:5173

5. **Verify the setup:**
   - You should see the STR Invoicer interface
   - Try uploading a sample OTA and GL file (create test CSV files)
   - Navigate through the four steps

### Your First Contribution

Start with something small to get familiar:

1. **Find a "good first issue"** on GitHub
2. **Create a branch:** `git checkout -b feature/my-first-change`
3. **Make a small change** (e.g., fix a typo in documentation)
4. **Test your change** locally
5. **Commit and push:** Follow our [CONTRIBUTING.md](CONTRIBUTING.md) guide
6. **Create a pull request**

## Project Overview

### What Does STR Invoicer Do?

STR Invoicer automates the invoice generation process for property managers:

1. **Upload Data** - Import OTA bookings and general ledger transactions
2. **Map Columns** - Match CSV columns to expected fields
3. **Review & Categorize** - Classify expenses and reconcile income
4. **Generate Invoice** - Create professional invoices with calculations

### Target Users

- Property managers handling multiple STR properties
- Property management companies
- Individual property owners
- Accountants working with STR finances

### Key Features

- **Offline-first** - All processing happens in the browser
- **Privacy-focused** - No data sent to external servers
- **Session persistence** - Save and resume complex reconciliations
- **Flexible categorization** - Multiple expense classification options
- **Export capabilities** - Excel and PDF output

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────┐
│          Browser (Client-Side)          │
├─────────────────────────────────────────┤
│                                         │
│  ┌──────────────────────────────────┐  │
│  │     React Components (UI)        │  │
│  │  - StepLoad, StepMap, etc.       │  │
│  └──────────────┬───────────────────┘  │
│                 │                       │
│  ┌──────────────▼───────────────────┐  │
│  │     Services (Business Logic)    │  │
│  │  - processor.ts                  │  │
│  │  - excelService.ts               │  │
│  └──────────────┬───────────────────┘  │
│                 │                       │
│  ┌──────────────▼───────────────────┐  │
│  │     Browser APIs                 │  │
│  │  - FileReader, Blob, etc.        │  │
│  └──────────────────────────────────┘  │
│                                         │
└─────────────────────────────────────────┘
```

### Data Flow

```
CSV/Excel Upload
      ↓
File Reading (excelService.ts)
      ↓
Raw Data Arrays
      ↓
Column Mapping (User Input)
      ↓
Data Processing (processor.ts)
      ↓
Normalized & Categorized Data
      ↓
Review & Adjustment (User Input)
      ↓
Invoice Generation
      ↓
Export (Excel/PDF)
```

### Tech Stack

| Layer               | Technology     | Purpose                               |
| ------------------- | -------------- | ------------------------------------- |
| **UI Framework**    | React 19       | Component-based UI                    |
| **Language**        | TypeScript     | Type safety and developer experience  |
| **Build Tool**      | Vite           | Fast development and optimized builds |
| **Styling**         | Tailwind CSS   | Utility-first CSS framework           |
| **Date Handling**   | date-fns       | Date parsing and manipulation         |
| **File Processing** | xlsx (SheetJS) | Excel/CSV file parsing                |
| **Charts**          | Recharts       | Data visualization                    |
| **Icons**           | Lucide React   | Icon components                       |
| **ID Generation**   | uuid           | Unique identifier generation          |

## Development Setup

### Recommended VS Code Extensions

Install these extensions for the best development experience:

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss",
    "dsznajder.es7-react-js-snippets",
    "formulahendry.auto-rename-tag",
    "eamodio.gitlens"
  ]
}
```

### VS Code Settings

Create `.vscode/settings.json`:

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true
}
```

### Environment Variables

For local development, create `.env.local` (optional):

```env
# Only needed if using AI Studio features
GEMINI_API_KEY=your_api_key_here
```

**Note:** The `.env.local` file is gitignored and should never be committed.

## Key Concepts

### 1. The Four-Step Workflow

Every user session follows these steps:

1. **LOAD** - Upload files and configure settings
2. **MAP** - Map CSV columns to required fields
3. **REVIEW** - Categorize expenses and reconcile transactions
4. **INVOICE** - Generate and export the final invoice

### 2. Canonical Data Types

Raw CSV data is normalized into canonical types:

- **CanonicalOtaRow** - Standardized OTA booking record
- **CanonicalGlRow** - Standardized GL transaction record

This normalization allows us to work with consistent data structures regardless of input format.

### 3. Expense Categories

Six categories for classifying expenses:

- **OWNER_ONLY** - Owner's expense, not reimbursed
- **MANAGER_ONLY** - Manager's expense
- **REIMBURSABLE** - Expense to charge the owner
- **SHARED** - Split between owner and manager
- **EXCLUDE** - Ignore in calculations
- **REVIEW_ALWAYS** - Needs manual review

### 4. Session Persistence

Users can save their work at any point as a JSON file containing:

- Current step
- Uploaded data
- Configuration
- Mappings
- Processed data

This allows resuming complex reconciliations later.

### 5. Reconciliation

Matching OTA payouts with GL income entries to avoid double-counting:

- Date-based matching (±7 days)
- Amount-based matching ($0.01 tolerance)
- Manual override available

## Code Organization

### File Structure

```
STRInvoicer/
├── components/          # React components
│   ├── StepLoad.tsx    # Step 1: File upload and config
│   ├── StepMap.tsx     # Step 2: Column mapping
│   ├── StepReview.tsx  # Step 3: Review and categorize
│   └── StepInvoice.tsx # Step 4: Invoice generation
├── services/            # Business logic
│   ├── processor.ts    # Data processing and normalization
│   └── excelService.ts # File reading utilities
├── App.tsx             # Main application component
├── types.ts            # TypeScript type definitions
├── constants.ts        # Application constants
├── index.tsx           # Application entry point
├── vite.config.ts      # Vite configuration
├── tsconfig.json       # TypeScript configuration
└── package.json        # Dependencies and scripts
```

### Naming Conventions

- **Components:** PascalCase (e.g., `StepLoad.tsx`)
- **Services:** camelCase (e.g., `processor.ts`)
- **Types/Interfaces:** PascalCase (e.g., `ConfigState`)
- **Functions:** camelCase (e.g., `processData`)
- **Constants:** UPPER_SNAKE_CASE (e.g., `REQUIRED_OTA_FIELDS`)

### Import Organization

Organize imports in this order:

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

// 5. Styles (if any)
import './styles.css';
```

## Development Workflow

### Daily Workflow

1. **Start your day:**

   ```bash
   git checkout main
   git pull origin main
   npm install  # If dependencies changed
   ```

2. **Create a feature branch:**

   ```bash
   git checkout -b feature/your-feature
   ```

3. **Start development server:**

   ```bash
   npm run dev
   ```

4. **Make changes and test:**
   - Edit code
   - Check browser at http://localhost:5173
   - Test your changes thoroughly

5. **Commit and push:**

   ```bash
   git add .
   git commit -m "feat: your feature description"
   git push origin feature/your-feature
   ```

6. **Create pull request** on GitHub

### Hot Module Replacement (HMR)

Vite provides instant updates without page reload:

- **Component changes** - Updates instantly
- **Style changes** - Updates instantly
- **Type changes** - May require manual refresh

### Building for Production

```bash
# Create optimized production build
npm run build

# Preview production build locally
npm run preview
```

Build output goes to `dist/` directory.

## Common Tasks

### Adding a New Component

1. Create component file: `components/MyComponent.tsx`

```typescript
import React from 'react';

interface MyComponentProps {
  title: string;
  onClick: () => void;
}

export const MyComponent: React.FC<MyComponentProps> = ({ title, onClick }) => {
  return (
    <div className="p-4 bg-white rounded shadow">
      <h2 className="text-xl font-bold">{title}</h2>
      <button onClick={onClick} className="mt-2 px-4 py-2 bg-blue-500 text-white rounded">
        Click Me
      </button>
    </div>
  );
};
```

2. Import and use in parent component:

```typescript
import { MyComponent } from './components/MyComponent';

// In your component:
<MyComponent title="Hello" onClick={() => console.log('Clicked!')} />
```

### Adding a New Type

Add to `types.ts`:

```typescript
export interface NewType {
  id: string;
  name: string;
  value: number;
}
```

### Adding a New Service Function

Add to appropriate service file (e.g., `services/processor.ts`):

```typescript
/**
 * Brief description of what this function does
 */
export const myNewFunction = (param1: Type1, param2: Type2): ReturnType => {
  // Implementation
  return result;
};
```

### Debugging Tips

1. **React DevTools:** Install browser extension for component inspection
2. **Console Logging:** Use `console.log()`, `console.table()` for data inspection
3. **TypeScript Errors:** Check terminal and browser console
4. **Network Tab:** Check file uploads and data transfers
5. **Breakpoints:** Use browser debugger with source maps

### Testing Your Changes

Since automated tests aren't yet implemented, manually test:

1. **Happy path:** Test the normal workflow
2. **Edge cases:** Empty files, invalid data, missing fields
3. **Error handling:** Intentionally cause errors
4. **Cross-browser:** Test in Chrome, Firefox, Safari
5. **Responsive:** Test on different screen sizes

## Troubleshooting

### Common Issues

#### Issue: Port 5173 already in use

**Solution:**

```bash
# Kill the process using the port
lsof -ti:5173 | xargs kill -9

# Or use a different port
npm run dev -- --port 3000
```

#### Issue: Module not found errors

**Solution:**

```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

#### Issue: TypeScript errors in editor but app runs

**Solution:**

- Restart TypeScript server in VS Code: `Cmd/Ctrl + Shift + P` → "TypeScript: Restart TS Server"
- Check `tsconfig.json` is correct
- Ensure using workspace TypeScript version

#### Issue: Changes not reflecting in browser

**Solution:**

- Hard refresh: `Cmd/Ctrl + Shift + R`
- Clear browser cache
- Restart dev server
- Check for syntax errors in terminal

#### Issue: Build fails

**Solution:**

```bash
# Check for TypeScript errors
npx tsc --noEmit

# Clear Vite cache
rm -rf node_modules/.vite

# Try building again
npm run build
```

### Getting Help

1. **Check documentation** - README, CONTRIBUTING, API.md
2. **Search issues** - Someone may have encountered the same problem
3. **Ask in discussions** - GitHub Discussions (future)
4. **Contact maintainers** - For urgent or sensitive issues

## Resources

### Internal Documentation

- [README.md](README.md) - Project overview and setup
- [CONTRIBUTING.md](CONTRIBUTING.md) - Contribution guidelines
- [API.md](API.md) - API reference and types
- [TESTING.md](TESTING.md) - Testing guidelines

### External Resources

- **React:** https://react.dev/
- **TypeScript:** https://www.typescriptlang.org/docs/
- **Vite:** https://vitejs.dev/
- **Tailwind CSS:** https://tailwindcss.com/docs
- **date-fns:** https://date-fns.org/
- **Recharts:** https://recharts.org/
- **SheetJS:** https://docs.sheetjs.com/

### Learning Resources

- **TypeScript + React:** https://react-typescript-cheatsheet.netlify.app/
- **React Hooks:** https://react.dev/reference/react
- **Git Workflow:** https://www.atlassian.com/git/tutorials

### Community

- **GitHub Issues:** Report bugs and request features
- **GitHub Discussions:** Ask questions and share ideas (future)
- **Pull Requests:** Contribute code improvements

## Next Steps

Now that you're set up:

1. **Explore the codebase** - Read through the main files
2. **Try the application** - Go through all four steps with sample data
3. **Pick a first issue** - Look for "good first issue" labels
4. **Ask questions** - Don't hesitate to reach out
5. **Start contributing** - Make your first pull request

## Checklist for Your First Week

- [ ] Successfully run the app locally
- [ ] Read through all documentation
- [ ] Understand the four-step workflow
- [ ] Review the main components and services
- [ ] Make a small documentation improvement
- [ ] Create your first pull request
- [ ] Attend a team sync (if applicable)
- [ ] Set up your development environment completely

---

**Welcome aboard! We're excited to have you on the team.** 🎉

**Questions?** Don't hesitate to ask. We're here to help!

**Last Updated:** February 2026
