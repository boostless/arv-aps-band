# Invoice Template Fields

This document lists all the fields that your DOCX invoice template should contain. Use these exact field names in your template (typically with curly braces like `{field_name}` or `{{field_name}}` depending on your templating library).

## Business Information (Seller)

- `seller_name` - Business name
- `seller_address` - Business address
- `seller_phone` - Phone number
- `seller_fax` - Fax number
- `seller_imones_kodas` - Company code (Įmonės kodas)
- `seller_pvm_kodas` - VAT code (PVM kodas)

### Bank Accounts

The system supports multiple bank accounts. You can access them via:

- `seller_bank_1_name` - First bank name
- `seller_bank_1_iban` - First bank IBAN
- `seller_bank_2_name` - Second bank name  
- `seller_bank_2_iban` - Second bank IBAN

Or loop through all banks using:
- `banks` array with properties: `name`, `iban`, `swift`

## Customer Information

- `customer_name` - Customer name
- `customer_address` - Customer address
- `customer_imones_kodas` - Customer company code (Įmonės kodas)
- `customer_pvm_kodas` - Customer VAT code (PVM kodas)

## Invoice Information

- `invoice_number` - Invoice number
- `israsymo_data` - Issue date (Išrašymo data)
- `apmoketi_iki` - Payment due date (Apmokėti iki)

## Line Items Table

Use a loop/repeat section for `items` array. Each item has:

- `eil_nr` - Line number (Eil. Nr.)
- `pavadinimas` - Item name (Pavadinimas)
- `vnt` - Unit (Vnt.)
- `kiekis` - Quantity (Kiekis)
- `kaina` - Unit price (Kaina)
- `suma` - Amount without VAT (Suma)
- `suma_be_pvm` - Amount without VAT (Suma be PVM)
- `suma_pvm` - VAT amount for this item (Suma PVM)
- `is_viso` - Total with VAT for this item (Iš viso)

## Totals (Below Table)

- `suma_be_pvm` - Total amount without VAT (Suma be PVM)
- `suma_pvm` - Total VAT amount (Suma PVM)
- `is_viso` - Grand total with VAT (Iš viso)

## Additional Information

- `suma_zodziais` - Amount in words (Suma žodžiais) - Currently empty, implement if needed
- `saskaitos_periodas` - Invoice period (Sąskaitos periodas) - Format: "DD.MM.YYYY - DD.MM.YYYY"
- `objekto_adresas` - Address of the object where services/products are delivered
- `created_by` - Name of person who created the invoice
- `saskaita_gavo` - Static field in template (Invoice received by) - No data from system, just empty space in template

## Example Template Structure

```
SĄSKAITA FAKTŪRA Nr. {invoice_number}
Išrašymo data: {israsymo_data}
Apmokėti iki: {apmoketi_iki}

PARDAVĖJAS:
{seller_name}
{seller_address}
Tel.: {seller_phone}, Faks: {seller_fax}
Įmonės kodas: {seller_imones_kodas}
PVM kodas: {seller_pvm_kodas}

Banko sąskaitos:
{seller_bank_1_name}: {seller_bank_1_iban}
{seller_bank_2_name}: {seller_bank_2_iban}

PIRKĖJAS:
{customer_name}
{customer_address}
Įmonės kodas: {customer_imones_kodas}
PVM kodas: {customer_pvm_kodas}

+--------+------------------+-----+--------+--------+--------+-------------+----------+----------+
| Eil.Nr | Pavadinimas      | Vnt | Kiekis | Kaina  | Suma   | Suma be PVM | Suma PVM | Iš viso  |
+--------+------------------+-----+--------+--------+--------+-------------+----------+----------+
{#items}
| {eil_nr} | {pavadinimas} | {vnt} | {kiekis} | {kaina} | {suma} | {suma_be_pvm} | {suma_pvm} | {is_viso} |
{/items}
+--------+------------------+-----+--------+--------+--------+-------------+----------+----------+

Suma be PVM: {suma_be_pvm} EUR
PVM suma: {suma_pvm} EUR
IŠ VISO: {is_viso} EUR

Suma žodžiais: {suma_zodziais}

Sąskaitos periodas: {saskaitos_periodas}
Objekto adresas: {objekto_adresas}

Sąskaitą išrašė: {created_by}
Sąskaitą gavo: _________________ (parašas)
```

## Notes

1. All monetary values are formatted with 2 decimal places
2. Dates are formatted in Lithuanian locale (DD.MM.YYYY)
3. The template syntax (curly braces) may vary depending on your DOCX templating library (Docxtemplater, etc.)
4. Make sure to configure your template to loop through the `items` array correctly
