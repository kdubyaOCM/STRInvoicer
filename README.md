<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# STR Invoicer

**STR Invoicer** is an offline-first web application designed to streamline financial management and invoice generation for short-term rental (STR) property managers. This tool enables managers to process OTA (Online Travel Agency) booking data, reconcile general ledger expenses, categorize transactions, and generate professional invoices for property owners.

## 🎯 Purpose

This application addresses the unique challenges faced by STR property managers who need to:

- **Reconcile revenue data** from multiple OTA platforms (Airbnb, Vrbo, Booking.com, etc.)
- **Categorize and track expenses** with proper classification (owner, manager, shared, reimbursable)
- **Generate professional invoices** showing revenue, expenses, management fees, and net payouts
- **Maintain complete offline functionality** for data privacy and security
- **Save and resume sessions** for complex reconciliation tasks

## 👥 Intended Users

- Short-term rental property managers handling multiple properties
- Property management companies requiring detailed financial reporting
- Individual property owners managing their own STR properties
- Accountants and bookkeepers working with STR financials

## 📋 Prerequisites

Before running STR Invoicer, ensure you have:

- **Node.js** (version 18.x or higher recommended)
- **npm** (comes with Node.js) or **yarn** package manager
- A modern web browser (Chrome, Firefox, Edge, or Safari)
- Optional: **Gemini API key** (if using AI-powered features in AI Studio deployment)

## 🚀 Installation

1. **Clone the repository:**

   ```bash
   git clone https://github.com/kdubyaOCM/STRInvoicer.git
   cd STRInvoicer
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Set up environment variables (optional):**

   If you're deploying to AI Studio or need AI features, create a `.env.local` file in the root directory:

   ```bash
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

   For local offline usage, this step is optional.

## 💻 Usage

### Running Locally

Start the development server:

```bash
npm run dev
```

The application will be available at `http://localhost:5173` (or another port if 5173 is in use).

### Building for Production

To create a production build:

```bash
npm run build
```

To preview the production build:

```bash
npm run preview
```

### Code Quality & Linting

To maintain code quality and consistency:

```bash
# Format code with Prettier
npm run format

# Check code formatting
npm run format:check

# Type check without emitting files
npm run type-check
```

**Note**: This project uses TypeScript strict mode and Prettier for code quality. The strict TypeScript compiler catches most code quality issues that would typically be found by ESLint.

### Workflow

The STR Invoicer follows a 4-step workflow:

#### 1. **Load Data**

- Upload OTA booking data (CSV/Excel format)
- Upload general ledger expenses (CSV/Excel format)
- Configure period dates, manager info, and fee structure
- Optional: Resume from a previously saved session

#### 2. **Map Columns**

- Map your CSV columns to required fields
- The app auto-detects common field names
- Verify mappings for accurate data processing

#### 3. **Review & Assign**

- Review processed bookings and expenses
- Classify expenses (Owner, Manager, Shared, Reimbursable)
- Reconcile OTA payouts with income entries
- Flag items requiring attention
- Save draft sessions for later continuation

#### 4. **Generate Invoice**

- Preview the complete invoice
- Review revenue summary, expense breakdown, and fee calculations
- Export to Excel or print PDF
- Save session data for records

### Data Privacy

STR Invoicer is designed with privacy in mind:

- **All processing happens locally** in your browser
- **No data is sent to external servers** (except optional AI Studio features)
- **Session files are saved locally** on your device
- You maintain complete control over your financial data

### Security

This application uses the `xlsx` library which has known vulnerabilities. However, the risk is minimal because:

- All file processing occurs client-side only
- No data is transmitted to servers
- Users only process their own trusted files

For more information, see [SECURITY.md](SECURITY.md).

## 🤝 Contributing

We welcome contributions from the community! Please see our [CONTRIBUTING.md](CONTRIBUTING.md) file for detailed guidelines on:

- Code of conduct
- How to submit issues and feature requests
- Pull request process and review guidelines
- Coding standards and style guides
- Development workflow and branching strategy

### Quick Start for Contributors

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature-name`
3. Make your changes following our coding standards
4. Test your changes thoroughly
5. Commit with clear, descriptive messages
6. Push to your fork and submit a pull request
7. Await code review and address feedback

## 🧪 Testing

For information about running and writing tests, please refer to our [TESTING.md](TESTING.md) documentation.

## 📖 Documentation

This project includes comprehensive documentation to help you get started:

- **[README.md](README.md)** - Project overview, installation, and usage (you are here)
- **[SECURITY.md](SECURITY.md)** - Security considerations and vulnerability disclosure
- **[CONTRIBUTING.md](CONTRIBUTING.md)** - Contribution guidelines and coding standards
- **[TESTING.md](TESTING.md)** - Testing guidelines and manual testing checklist
- **[API.md](API.md)** - API reference for types, interfaces, and functions
- **[DEVELOPER_ONBOARDING.md](DEVELOPER_ONBOARDING.md)** - Comprehensive guide for new developers
- **[CHANGELOG.md](CHANGELOG.md)** - Project version history and release notes

## 📚 Additional Resources

- **View your app in AI Studio:** https://ai.studio/apps/drive/1JESjI5e9HPDtnTHMufsD7mcXbKROPfGU
- **React Documentation:** https://react.dev/
- **Vite Documentation:** https://vitejs.dev/
- **TypeScript Handbook:** https://www.typescriptlang.org/docs/
- **date-fns Documentation:** https://date-fns.org/
- **Recharts Documentation:** https://recharts.org/
- **xlsx (SheetJS) Documentation:** https://docs.sheetjs.com/

## 📄 License

This project is provided as-is for use in managing short-term rental finances.

## 🐛 Issues and Support

If you encounter any issues or have questions:

1. Check existing [Issues](https://github.com/kdubyaOCM/STRInvoicer/issues) to see if your problem has been reported
2. Create a new issue with detailed information about your problem
3. Include steps to reproduce, expected behavior, and actual behavior

## 🙏 Acknowledgments

Built with modern web technologies including React, TypeScript, Vite, and a suite of excellent open-source libraries.
