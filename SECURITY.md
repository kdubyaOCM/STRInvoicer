# Security Policy

## Known Security Considerations

### xlsx Dependency Vulnerability

The `xlsx` library (SheetJS) has known security vulnerabilities:

- **Prototype Pollution** (GHSA-4r6h-8v6p-xvw6)
- **Regular Expression Denial of Service (ReDoS)** (GHSA-5pgg-2g8v-p4x9)

#### Risk Assessment

These vulnerabilities are **low risk** in this application because:

1. The application runs entirely client-side in the browser
2. Users only process their own files - there's no server-side processing
3. No user data is stored or transmitted to any server
4. The application does not accept files from untrusted sources

#### Mitigation Strategies

- Files are processed locally in the user's browser
- No sensitive data is transmitted over the network
- Users should only upload files they trust
- Consider migrating to a more secure alternative (e.g., `exceljs`) in future versions

## Input Validation

### File Upload Security

- Only Excel (.xlsx, .xls) and CSV files are accepted
- File size limits are enforced by the browser
- All file processing occurs client-side

### Data Sanitization

- All user inputs are validated before processing
- Date parsing includes validation checks
- Numeric values are sanitized and validated
- Special characters in financial data (parentheses, currency symbols) are handled safely

## Reporting a Vulnerability

If you discover a security vulnerability in this project:

1. **Do NOT** open a public GitHub issue
2. Email the maintainer with details about the vulnerability
3. Include steps to reproduce if possible
4. Allow reasonable time for a fix before public disclosure

## Best Practices for Users

1. **Only upload files you trust** - Do not process Excel files from unknown sources
2. **Keep your browser updated** - Ensure you're using a modern, updated browser
3. **Review generated invoices** - Always verify the accuracy of generated data
4. **Backup your data** - Save session files regularly using the "Save Progress" feature

## Privacy

- This application does not collect, store, or transmit any user data
- All processing occurs entirely within your browser
- No analytics or tracking is implemented
- Session data is only saved locally when you explicitly choose to save it
