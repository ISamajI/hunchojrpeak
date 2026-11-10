// Questionnaire definition — shared by the client portal and the owner dashboard.
// Field types: text, email, tel, date, number, money, ssn, select, radio, yesno, checkboxes, textarea, repeat, note
// showIf: { field, is } | { field, in: [...] } | { field, includes } (for checkboxes)
window.STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'];

window.TAX_SCHEMA = [
  {
    id: 'personal', title: 'About You', icon: '1',
    intro: 'Enter your information exactly as it appears on your Social Security card.',
    fields: [
      { name: 'first_name', label: 'Legal first name', type: 'text', required: true, half: true },
      { name: 'middle_initial', label: 'Middle initial', type: 'text', half: true, max: 1 },
      { name: 'last_name', label: 'Legal last name', type: 'text', required: true, half: true },
      { name: 'suffix', label: 'Suffix (Jr., Sr., III)', type: 'text', half: true },
      { name: 'ssn', label: 'Social Security Number', type: 'ssn', required: true, half: true, sensitive: true },
      { name: 'dob', label: 'Date of birth', type: 'date', required: true, half: true },
      { name: 'occupation', label: 'Occupation', type: 'text', required: true, half: true },
      { name: 'phone', label: 'Mobile phone', type: 'tel', required: true, half: true },
      { name: 'email', label: 'Email', type: 'email', required: true },
      { name: 'address', label: 'Street address (include apt/unit)', type: 'text', required: true },
      { name: 'city', label: 'City', type: 'text', required: true, third: true },
      { name: 'state', label: 'State', type: 'select', options: window.STATES, required: true, third: true },
      { name: 'zip', label: 'ZIP code', type: 'text', required: true, third: true, pattern: '^\\d{5}(-\\d{4})?$', patternMsg: 'Enter a 5-digit ZIP.' },
      { name: 'moved', label: 'Did you move to a different state during the year?', type: 'yesno', required: true },
      { name: 'moved_details', label: 'Which state(s) and the dates you lived in each', type: 'textarea', showIf: { field: 'moved', is: 'yes' } },
      { name: 'id_type', label: 'Photo ID type', type: 'select', options: ["Driver's license", 'State ID', 'Passport'], half: true },
      { name: 'id_number', label: 'ID number', type: 'text', half: true, sensitive: true },
      { name: 'id_state', label: 'Issuing state', type: 'select', options: window.STATES, third: true },
      { name: 'id_issued', label: 'Issue date', type: 'date', third: true },
      { name: 'id_expires', label: 'Expiration date', type: 'date', third: true },
      { name: 'ip_pin', label: 'Did the IRS send you an Identity Protection PIN (IP PIN)?', type: 'yesno' },
      { name: 'ip_pin_value', label: 'IP PIN (6 digits)', type: 'text', sensitive: true, showIf: { field: 'ip_pin', is: 'yes' }, half: true },
      { name: 'blind_or_disabled', label: 'Are you legally blind or permanently disabled?', type: 'yesno' },
      { name: 'claimed_by_other', label: 'Can someone else claim you as a dependent?', type: 'yesno', required: true },
    ],
  },
  {
    id: 'filing', title: 'Filing Status & Spouse', icon: '2',
    fields: [
      { name: 'marital_status', label: 'Marital status on December 31', type: 'radio', required: true,
        options: ['Single', 'Married', 'Divorced / legally separated', 'Widowed'] },
      { name: 'widow_year', label: 'Year spouse passed away', type: 'number', half: true, showIf: { field: 'marital_status', is: 'Widowed' } },
      { name: 'filing_pref', label: 'How do you want to file?', type: 'radio', showIf: { field: 'marital_status', is: 'Married' },
        options: ['Married filing jointly', 'Married filing separately', 'Not sure — advise me'] },
      { name: 'spouse_heading', type: 'note', text: 'Spouse information', showIf: { field: 'marital_status', is: 'Married' } },
      { name: 'spouse_first', label: 'Spouse legal first name', type: 'text', half: true, showIf: { field: 'marital_status', is: 'Married' }, required: true },
      { name: 'spouse_last', label: 'Spouse legal last name', type: 'text', half: true, showIf: { field: 'marital_status', is: 'Married' }, required: true },
      { name: 'spouse_ssn', label: 'Spouse SSN', type: 'ssn', half: true, sensitive: true, showIf: { field: 'marital_status', is: 'Married' }, required: true },
      { name: 'spouse_dob', label: 'Spouse date of birth', type: 'date', half: true, showIf: { field: 'marital_status', is: 'Married' }, required: true },
      { name: 'spouse_occupation', label: 'Spouse occupation', type: 'text', half: true, showIf: { field: 'marital_status', is: 'Married' } },
      { name: 'spouse_phone', label: 'Spouse phone', type: 'tel', half: true, showIf: { field: 'marital_status', is: 'Married' } },
      { name: 'spouse_ip_pin', label: 'Spouse IP PIN (if any)', type: 'text', half: true, sensitive: true, showIf: { field: 'marital_status', is: 'Married' } },
      { name: 'filed_last_year', label: 'Did you file a tax return last year?', type: 'yesno', required: true },
      { name: 'prior_preparer', label: 'Who prepared it?', type: 'select', options: ['Veronica (returning client)', 'Another preparer', 'Myself (TurboTax, etc.)'], showIf: { field: 'filed_last_year', is: 'yes' }, half: true },
      { name: 'prior_agi', label: "Last year's AGI (if known)", type: 'money', showIf: { field: 'filed_last_year', is: 'yes' }, half: true,
        help: 'Found on line 11 of last year’s Form 1040. Needed to e-file.' },
      { name: 'irs_letters', label: 'Did you receive any letters from the IRS or state this year?', type: 'yesno' },
      { name: 'irs_letters_details', label: 'Briefly describe (and upload a copy in Documents)', type: 'textarea', showIf: { field: 'irs_letters', is: 'yes' } },
    ],
  },
  {
    id: 'dependents', title: 'Dependents', icon: '3',
    fields: [
      { name: 'has_dependents', label: 'Do you have children or other dependents to claim?', type: 'yesno', required: true },
      { name: 'dependents', label: 'Dependent', type: 'repeat', addLabel: '+ Add another dependent', showIf: { field: 'has_dependents', is: 'yes' },
        fields: [
          { name: 'first', label: 'First name', type: 'text', required: true, half: true },
          { name: 'last', label: 'Last name', type: 'text', required: true, half: true },
          { name: 'ssn', label: 'SSN / ITIN', type: 'ssn', required: true, half: true, sensitive: true },
          { name: 'dob', label: 'Date of birth', type: 'date', required: true, half: true },
          { name: 'relationship', label: 'Relationship', type: 'select', required: true, half: true,
            options: ['Son', 'Daughter', 'Stepchild', 'Foster child', 'Grandchild', 'Niece / Nephew', 'Brother / Sister', 'Parent', 'Other relative', 'Other'] },
          { name: 'months', label: 'Months lived with you', type: 'number', min: 0, max: 12, required: true, half: true },
          { name: 'student', label: 'Full-time student?', type: 'yesno', half: true },
          { name: 'disabled', label: 'Permanently disabled?', type: 'yesno', half: true },
          { name: 'income', label: 'Did they earn over $5,000?', type: 'yesno', half: true },
          { name: 'support', label: 'Did you provide over half their support?', type: 'yesno', half: true },
        ] },
      { name: 'childcare', label: 'Did you pay for daycare / childcare so you could work?', type: 'yesno', showIf: { field: 'has_dependents', is: 'yes' } },
      { name: 'childcare_providers', label: 'Provider', type: 'repeat', addLabel: '+ Add another provider', showIf: { field: 'childcare', is: 'yes' },
        fields: [
          { name: 'name', label: 'Provider name', type: 'text', required: true, half: true },
          { name: 'ein', label: 'Provider EIN or SSN', type: 'text', half: true, sensitive: true },
          { name: 'address', label: 'Provider address', type: 'text' },
          { name: 'amount', label: 'Amount paid', type: 'money', required: true, half: true },
        ] },
    ],
  },
  {
    id: 'income', title: 'Income', icon: '4',
    intro: 'Check every type of income you (or your spouse) received. Upload the forms in the Documents step.',
    fields: [
      { name: 'income_types', label: 'Income received this year', type: 'checkboxes', required: true, options: [
        'W-2 job / employer wages',
        '1099-NEC / 1099-K — self-employed, gig work, Uber/DoorDash, side business',
        '1099-INT / 1099-DIV — bank interest or dividends',
        '1099-B — sold stocks or investments',
        'Cryptocurrency / digital assets',
        '1099-R — retirement, pension, 401(k) or IRA withdrawal',
        'SSA-1099 — Social Security benefits',
        '1099-G — unemployment',
        'Rental property income',
        'Sold a home or property',
        'Gambling winnings (W-2G)',
        'Alimony received (divorce before 2019)',
        'Other income',
        'No income',
      ] },
      { name: 'w2_count', label: 'How many W-2s (you + spouse)?', type: 'number', min: 0, half: true, showIf: { field: 'income_types', includes: 'W-2 job / employer wages' } },
      { name: 'se_heading', type: 'note', text: 'Self-employment / business', showIf: { field: 'income_types', includes: '1099-NEC / 1099-K — self-employed, gig work, Uber/DoorDash, side business' } },
      { name: 'businesses', label: 'Business', type: 'repeat', addLabel: '+ Add another business', showIf: { field: 'income_types', includes: '1099-NEC / 1099-K — self-employed, gig work, Uber/DoorDash, side business' },
        fields: [
          { name: 'name', label: 'Business name (or your name)', type: 'text', required: true, half: true },
          { name: 'type', label: 'What do you do?', type: 'text', required: true, half: true },
          { name: 'ein', label: 'EIN (if any)', type: 'text', half: true },
          { name: 'owner', label: 'Whose business?', type: 'select', options: ['Me', 'Spouse', 'Both'], half: true },
          { name: 'gross', label: 'Total income received', type: 'money', required: true, half: true },
          { name: 'cash', label: 'Of that, cash / Cash App / Zelle not on a 1099', type: 'money', half: true },
          { name: 'supplies', label: 'Supplies & materials', type: 'money', third: true },
          { name: 'phone_internet', label: 'Phone & internet (business %)', type: 'money', third: true },
          { name: 'advertising', label: 'Advertising', type: 'money', third: true },
          { name: 'insurance', label: 'Business insurance', type: 'money', third: true },
          { name: 'contract_labor', label: 'Paid helpers / contractors', type: 'money', third: true },
          { name: 'other_expenses', label: 'Other expenses', type: 'money', third: true },
          { name: 'miles', label: 'Business miles driven', type: 'number', half: true },
          { name: 'home_office', label: 'Home office sq ft (exclusive use)', type: 'number', half: true },
          { name: 'expense_notes', label: 'Describe other expenses', type: 'textarea' },
        ] },
      { name: 'crypto_details', label: 'Crypto: did you sell, trade, or get paid in crypto? Describe.', type: 'textarea', showIf: { field: 'income_types', includes: 'Cryptocurrency / digital assets' } },
      { name: 'rentals', label: 'Rental property', type: 'repeat', addLabel: '+ Add another rental', showIf: { field: 'income_types', includes: 'Rental property income' },
        fields: [
          { name: 'address', label: 'Property address', type: 'text', required: true },
          { name: 'rent', label: 'Rent collected', type: 'money', required: true, third: true },
          { name: 'mortgage_int', label: 'Mortgage interest', type: 'money', third: true },
          { name: 'taxes', label: 'Property taxes', type: 'money', third: true },
          { name: 'repairs', label: 'Repairs', type: 'money', third: true },
          { name: 'insurance', label: 'Insurance', type: 'money', third: true },
          { name: 'utilities', label: 'Utilities / HOA / mgmt', type: 'money', third: true },
        ] },
      { name: 'home_sale_details', label: 'Home/property sale: address, sale date, sale price, purchase price, was it your main home?', type: 'textarea', showIf: { field: 'income_types', includes: 'Sold a home or property' } },
      { name: 'other_income_details', label: 'Describe other income and amounts', type: 'textarea', showIf: { field: 'income_types', includes: 'Other income' } },
      { name: 'estimated_payments', label: 'Did you make estimated tax payments to the IRS or state?', type: 'yesno' },
      { name: 'estimated_amount', label: 'Total federal estimated payments', type: 'money', half: true, showIf: { field: 'estimated_payments', is: 'yes' } },
      { name: 'estimated_state', label: 'Total state estimated payments', type: 'money', half: true, showIf: { field: 'estimated_payments', is: 'yes' } },
    ],
  },
  {
    id: 'deductions', title: 'Deductions & Credits', icon: '5',
    intro: 'Check anything that applies. Not sure? Check it — we’ll sort it out.',
    fields: [
      { name: 'deductions', label: 'This year I (or my spouse)…', type: 'checkboxes', options: [
        'Paid mortgage interest (Form 1098)',
        'Paid property taxes',
        'Gave to charity / church',
        'Had large medical or dental bills',
        'Paid student loan interest (1098-E)',
        'Paid college tuition (1098-T)',
        'Teacher who bought classroom supplies',
        'Contributed to a traditional IRA',
        'Have an HSA (1099-SA / 5498-SA)',
        'Had health insurance through the Marketplace (1095-A)',
        'Bought an electric vehicle',
        'Installed solar, heat pump, windows, or other energy upgrades',
        'Paid alimony (divorce before 2019)',
        'None of these',
      ] },
      { name: 'charity_cash', label: 'Cash/check donations total', type: 'money', half: true, showIf: { field: 'deductions', includes: 'Gave to charity / church' } },
      { name: 'charity_items', label: 'Value of donated items (clothes, goods)', type: 'money', half: true, showIf: { field: 'deductions', includes: 'Gave to charity / church' } },
      { name: 'medical_total', label: 'Out-of-pocket medical/dental total', type: 'money', half: true, showIf: { field: 'deductions', includes: 'Had large medical or dental bills' } },
      { name: 'property_tax_total', label: 'Property taxes paid', type: 'money', half: true, showIf: { field: 'deductions', includes: 'Paid property taxes' } },
      { name: 'educator_total', label: 'Classroom supplies spent', type: 'money', half: true, showIf: { field: 'deductions', includes: 'Teacher who bought classroom supplies' } },
      { name: 'ira_total', label: 'IRA contribution amount', type: 'money', half: true, showIf: { field: 'deductions', includes: 'Contributed to a traditional IRA' } },
      { name: 'alimony_paid', label: 'Alimony paid + recipient SSN', type: 'text', sensitive: true, showIf: { field: 'deductions', includes: 'Paid alimony (divorce before 2019)' } },
      { name: 'health_coverage', label: 'Did everyone in your household have health insurance all year?', type: 'yesno' },
    ],
  },
  {
    id: 'refund', title: 'Refund & Payment', icon: '6',
    fields: [
      { name: 'refund_method', label: 'If you get a refund, how do you want it?', type: 'radio', required: true,
        options: ['Direct deposit (fastest)', 'Paper check', 'Apply to next year’s taxes'] },
      { name: 'bank_name', label: 'Bank name', type: 'text', half: true, required: true, showIf: { field: 'refund_method', is: 'Direct deposit (fastest)' } },
      { name: 'account_type', label: 'Account type', type: 'select', options: ['Checking', 'Savings'], half: true, required: true, showIf: { field: 'refund_method', is: 'Direct deposit (fastest)' } },
      { name: 'routing', label: 'Routing number (9 digits)', type: 'text', half: true, sensitive: true, required: true, pattern: '^\\d{9}$', patternMsg: 'Routing number is 9 digits.', showIf: { field: 'refund_method', is: 'Direct deposit (fastest)' } },
      { name: 'account', label: 'Account number', type: 'text', half: true, sensitive: true, required: true, pattern: '^\\d{4,17}$', patternMsg: 'Digits only.', showIf: { field: 'refund_method', is: 'Direct deposit (fastest)' } },
      { name: 'account_confirm', label: 'Re-enter account number', type: 'text', half: true, sensitive: true, required: true, matches: 'account', showIf: { field: 'refund_method', is: 'Direct deposit (fastest)' } },
      { name: 'balance_due', label: 'If you owe, how will you pay?', type: 'radio',
        options: ['Withdraw from the bank account above', 'I’ll pay online / by check myself', 'I need a payment plan'] },
      { name: 'contact_pref', label: 'Best way to reach you', type: 'select', options: ['Text', 'Call', 'Email'], half: true },
      { name: 'notes', label: 'Anything else I should know? (life changes, questions)', type: 'textarea' },
    ],
  },
];

window.DOC_CATEGORIES = [
  'Photo ID (front & back)', 'Social Security cards', 'W-2', '1099 forms', '1098 (mortgage / tuition / student loan)',
  '1095-A', 'Last year’s tax return', 'IRS / state letters', 'Business receipts / summary', 'Other',
];

window.STATUS_LABELS = {
  draft: 'Not submitted', submitted: 'New — submitted', in_progress: 'In progress', needs_info: 'Needs info', completed: 'Completed',
};

// Returns true if a field should be visible given the current answers (scope = row data for repeats).
window.isVisible = function (field, data, root) {
  const c = field.showIf;
  if (!c) return true;
  const v = (data && c.field in data) ? data[c.field] : root?.[c.field];
  if ('is' in c) return v === c.is;
  if ('in' in c) return c.in.includes(v);
  if ('includes' in c) return Array.isArray(v) && v.includes(c.includes);
  return !!v;
};
