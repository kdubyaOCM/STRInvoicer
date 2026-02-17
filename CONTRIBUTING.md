# Contributing to STR Invoicer

Thank you for your interest in contributing to STR Invoicer! We welcome contributions from the community and are grateful for your support in making this tool better for short-term rental property managers everywhere.

## 🌟 Welcome New Contributors!

Whether you're fixing a typo, adding a feature, or improving documentation, your contribution matters! If you're new to open source, this is a great project to start with. We're here to help you through the process.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How Can I Contribute?](#how-can-i-contribute)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Branching Strategy](#branching-strategy)
- [Coding Standards](#coding-standards)
- [Pull Request Guidelines](#pull-request-guidelines)
- [Review Process](#review-process)
- [Helpful Resources](#helpful-resources)

## Code of Conduct

### Our Pledge

We are committed to providing a welcoming and inclusive environment for everyone, regardless of experience level, gender identity, sexual orientation, disability, personal appearance, race, ethnicity, age, religion, or nationality.

### Expected Behavior

- Be respectful and considerate in your communication
- Welcome newcomers and help them get started
- Accept constructive criticism gracefully
- Focus on what's best for the community
- Show empathy towards other community members

### Unacceptable Behavior

- Harassment, trolling, or insulting comments
- Personal or political attacks
- Publishing others' private information without permission
- Any conduct that could be considered inappropriate in a professional setting

## How Can I Contribute?

### Reporting Bugs

Before submitting a bug report:

1. **Check existing issues** to see if the bug has already been reported
2. **Use the latest version** to confirm the bug still exists
3. **Gather information** about your environment (OS, browser, Node.js version)

When submitting a bug report, include:

- **Clear title** describing the issue
- **Detailed description** of the problem
- **Steps to reproduce** the bug
- **Expected behavior** vs actual behavior
- **Screenshots or error messages** if applicable
- **Environment details** (browser, OS, etc.)

Example bug report:

```markdown
**Title:** Invoice total calculation incorrect when expenses include split percentages

**Description:** When an expense is marked as "Shared" with a split percentage,
the invoice total doesn't reflect the correct split amount.

**Steps to Reproduce:**

1. Load OTA and GL data
2. Map columns and proceed to review
3. Mark an expense as "Shared" with 50% split
4. Generate invoice
5. Check the expense breakdown

**Expected:** Expense should show 50% of the amount
**Actual:** Expense shows 100% of the amount

**Environment:** Chrome 120, macOS 14.2, Node.js 20.10
```

### Suggesting Features

We love new ideas! Before suggesting a feature:

1. **Check existing issues** to see if it's already been suggested
2. **Consider the scope** - does it fit the project's goals?
3. **Think about users** - how will this benefit STR property managers?

When suggesting a feature, include:

- **Clear use case** - what problem does it solve?
- **Proposed solution** - how should it work?
- **Alternatives considered** - what other options did you think about?
- **Additional context** - mockups, examples, or references

### Improving Documentation

Documentation improvements are always welcome! This includes:

- Fixing typos or grammar
- Adding examples or clarifications
- Updating outdated information
- Adding translations (future)
- Creating tutorials or guides

### Contributing Code

See the sections below for detailed information on code contributions.

## Getting Started

### Prerequisites

- Node.js 18.x or higher
- npm or yarn
- Git
- A code editor (VS Code recommended)

### Setting Up Your Development Environment

1. **Fork the repository** on GitHub

2. **Clone your fork** locally:

   ```bash
   git clone https://github.com/YOUR-USERNAME/STRInvoicer.git
   cd STRInvoicer
   ```

3. **Add upstream remote**:

   ```bash
   git remote add upstream https://github.com/kdubyaOCM/STRInvoicer.git
   ```

4. **Install dependencies**:

   ```bash
   npm install
   ```

5. **Start the development server**:

   ```bash
   npm run dev
   ```

6. **Verify the setup** by opening http://localhost:5173 in your browser

### Recommended VS Code Extensions

- ESLint - JavaScript/TypeScript linting
- Prettier - Code formatting
- TypeScript and JavaScript Language Features
- React Developer Tools
- GitLens - Git visualization

## Development Workflow

### 1. Create a Feature Branch

Always create a new branch for your work:

```bash
git checkout -b feature/your-feature-name
```

or for bug fixes:

```bash
git checkout -b fix/issue-description
```

### 2. Make Your Changes

- Write clean, readable code
- Follow the coding standards (see below)
- Add comments for complex logic
- Update documentation if needed
- Test your changes thoroughly

**Before committing:**

```bash
# Format code with Prettier
npm run format

# Type check your changes
npm run type-check

# Build to ensure no compilation errors
npm run build
```

### 3. Commit Your Changes

Write clear, descriptive commit messages:

```bash
git add .
git commit -m "feat: add expense filtering by category

- Add filter dropdown to expense table
- Implement category-based filtering logic
- Update UI to show active filters
- Add clear filters button"
```

#### Commit Message Format

We follow the Conventional Commits specification:

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, etc.)
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

### 4. Keep Your Branch Updated

Regularly sync with the upstream repository:

```bash
git fetch upstream
git rebase upstream/main
```

### 5. Push Your Changes

```bash
git push origin feature/your-feature-name
```

### 6. Submit a Pull Request

See the Pull Request Guidelines section below.

## Branching Strategy

We use a simplified Git Flow:

- **`main`** - Production-ready code, always stable
- **`develop`** - Integration branch for features (if used)
- **`feature/*`** - New features
- **`fix/*`** - Bug fixes
- **`docs/*`** - Documentation updates
- **`refactor/*`** - Code refactoring
- **`test/*`** - Test additions/updates

### Branch Naming Conventions

Use descriptive, lowercase branch names with hyphens:

- ✅ `feature/add-export-to-pdf`
- ✅ `fix/date-parsing-error`
- ✅ `docs/update-installation-guide`
- ❌ `my-changes`
- ❌ `fix_bug`
- ❌ `UpdateDocs`

## Coding Standards

This project uses automated tools to maintain code quality and consistency:

- **Prettier** - For consistent code formatting
- **TypeScript Strict Mode** - For type safety and catching code quality issues
- **Type Checking** - Validates all code before commits

### Code Formatting and Type Checking

Always run these commands before committing:

```bash
# Format all code
npm run format

# Check if code is properly formatted
npm run format:check

# Run type checking
npm run type-check
```

### Type Safety

- **Avoid `any` types** - Use proper TypeScript types
- **Use `unknown` for uncertain types** - Then narrow with type guards
- **Define interfaces** for all data structures
- **Add JSDoc comments** to public APIs
- **Enable strict TypeScript settings** when possible

```typescript
// ✅ Good - Proper typing
interface ExpenseData {
  amount: number;
  category: ExpenseCategory;
  date: string;
}

function calculateTotal(expenses: ExpenseData[]): number {
  return expenses.reduce((sum, exp) => sum + exp.amount, 0);
}

// ❌ Avoid - Using 'any'
function calculateTotal(expenses: any): any {
  return expenses.reduce((sum: any, exp: any) => sum + exp.amount, 0);
}
```

### TypeScript Best Practices

### TypeScript/JavaScript

- **Use TypeScript** for all new code
- **Define types** explicitly, avoid `any` when possible
- **Use functional components** and React hooks
- **Keep functions small** and focused on a single responsibility
- **Use meaningful variable names** - clarity over brevity

#### Code Style

```typescript
// ✅ Good
interface InvoiceConfig {
  managerName: string;
  feePercent: number;
  periodStart: Date;
}

const calculateManagementFee = (revenue: number, feePercent: number): number => {
  return revenue * (feePercent / 100);
};

// ❌ Avoid
const calc = (r: any, f: any) => {
  return (r * f) / 100;
};
```

### React Components

- **Use functional components** with hooks
- **Keep components focused** - one responsibility per component
- **Extract reusable logic** into custom hooks
- **Use meaningful prop names**
- **Document complex components** with comments

#### Component Example

```typescript
interface ExpenseRowProps {
  expense: CanonicalGlRow;
  onCategoryChange: (id: string, category: ExpenseCategory) => void;
  onSplitChange: (id: string, percent: number) => void;
}

export const ExpenseRow: React.FC<ExpenseRowProps> = ({
  expense,
  onCategoryChange,
  onSplitChange,
}) => {
  // Component implementation
};
```

### File Organization

- **One component per file** (unless closely related)
- **Group related files** in directories
- **Use index files** for cleaner imports
- **Separate concerns** - keep business logic separate from UI

### Naming Conventions

- **Components**: PascalCase (`StepLoad`, `InvoiceTable`)
- **Functions**: camelCase (`processData`, `generateInvoice`)
- **Constants**: UPPER_SNAKE_CASE (`REQUIRED_OTA_FIELDS`)
- **Interfaces/Types**: PascalCase (`ConfigState`, `CanonicalOtaRow`)
- **Files**: Match the export name (`StepLoad.tsx`, `processor.ts`)

### Comments and Documentation

- **Use JSDoc** for public functions and complex logic
- **Explain "why"**, not "what" - the code should be self-explanatory
- **Update comments** when you change code
- **Remove commented-out code** - use version control instead

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

### Error Handling

- **Handle errors gracefully** - don't let the app crash
- **Provide helpful error messages** to users
- **Log errors** for debugging (console.error)
- **Validate input** before processing

### Performance Considerations

- **Avoid unnecessary re-renders** - use React.memo, useMemo, useCallback
- **Lazy load large datasets** when possible
- **Debounce user input** for search and filters
- **Profile performance** for large data operations

## Pull Request Guidelines

### Before Submitting

- [ ] Code follows the style guide
- [ ] All tests pass (when available)
- [ ] Documentation is updated
- [ ] Commit messages are clear and descriptive
- [ ] Branch is up-to-date with main
- [ ] Self-review completed

### Pull Request Template

Use this template when creating a PR:

```markdown
## Description

Brief description of what this PR does.

## Type of Change

- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to change)
- [ ] Documentation update

## Related Issue

Closes #123

## Changes Made

- List specific changes
- Be as detailed as needed
- Include rationale for major decisions

## Testing

Describe how you tested these changes:

- Test case 1
- Test case 2

## Screenshots (if applicable)

Add screenshots for UI changes

## Checklist

- [ ] My code follows the project's style guidelines
- [ ] I have performed a self-review
- [ ] I have commented complex code
- [ ] I have updated documentation
- [ ] My changes generate no new warnings
- [ ] I have tested on multiple browsers (if UI change)

## Additional Notes

Any additional information reviewers should know
```

### Pull Request Best Practices

1. **Keep PRs focused** - one feature or fix per PR
2. **Write descriptive titles** - explain what the PR does
3. **Provide context** - explain why the change is needed
4. **Keep PRs small** - easier to review and merge
5. **Respond to feedback** - engage with reviewers constructively
6. **Update your PR** - address review comments promptly

## Review Process

### For Contributors

When your PR is under review:

1. **Be patient** - reviews may take a few days
2. **Be responsive** - answer questions and address feedback
3. **Be open to suggestions** - reviewers are trying to help
4. **Request re-review** after making changes

### What Reviewers Look For

- Code quality and style consistency
- Correct functionality
- Edge cases and error handling
- Performance implications
- Documentation updates
- Test coverage
- User experience

### After Approval

Once your PR is approved:

1. Wait for a maintainer to merge
2. Your contribution will be included in the next release
3. You'll be credited in the release notes

## Helpful Resources

### Documentation

- [React Documentation](https://react.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Vite Guide](https://vitejs.dev/guide/)
- [Git Documentation](https://git-scm.com/doc)

### Libraries Used

- [date-fns](https://date-fns.org/) - Date manipulation
- [Recharts](https://recharts.org/) - Charts and graphs
- [xlsx (SheetJS)](https://docs.sheetjs.com/) - Excel file processing
- [Lucide React](https://lucide.dev/) - Icon components
- [uuid](https://www.npmjs.com/package/uuid) - Unique ID generation

### Learning Resources

- [TypeScript for React Developers](https://react-typescript-cheatsheet.netlify.app/)
- [React Hooks Guide](https://react.dev/reference/react)
- [Git Flow Workflow](https://www.atlassian.com/git/tutorials/comparing-workflows/gitflow-workflow)
- [How to Write a Git Commit Message](https://chris.beams.io/posts/git-commit/)

### Getting Help

- 💬 **GitHub Discussions** - Ask questions and share ideas
- 🐛 **GitHub Issues** - Report bugs and request features
- 📧 **Contact Maintainers** - For private or sensitive matters

## Recognition

All contributors will be recognized in our:

- README.md contributors section (future)
- Release notes
- GitHub contributors page

## Questions?

If you have any questions about contributing, please:

1. Check this guide thoroughly
2. Search existing issues and discussions
3. Create a new discussion or issue
4. Reach out to the maintainers

---

**Thank you for contributing to STR Invoicer! Your efforts help property managers around the world manage their finances more effectively.** 🙏

**Last Updated:** February 2026
