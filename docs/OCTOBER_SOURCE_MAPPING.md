# October workbook and PDF mapping

Inspected before implementation. Primary database: `Qoute_1-10-2026.xlsx`. Presentation: `Mr.Sumit_RevisedQuotation_070920261740.pdf`. Previous records and documents must survive the upgrade.

## Sheets

| Sheet | Application mapping |
|---|---|
| How to use this sheet | Area/item/specification workflow, dry-area reuse, sq ft/running ft/unit calculation, custom items, separate master/project rates; A1 contains the instructions, T59 requires separate loft lines |
| Master List | A Item (forward-filled), B full Specification, C Price, D Hardware, E AREA divisor; 239 rows, 41 formulas; retain raw values, formulas and source references |
| Kitchen | Base Unit, Wall Unit, Loft, Janitor Unit, Counter Top, Accessories, Appliances; A specification/B rate, explicit unpriced accessories and appliances |
| Bedrooms | Swing/Hinged Wardrobe, Loft, Sliding Wardrobe, Base & Wall units, Wall Panel, Dressing Unit, Furnishing, Aristro Wardrobes |
| Toilet | Vanities and Wall Unit; wet-area specifications |
| Other Wet Areas | Base Unit, Wall Unit and Loft; wet-area specifications |
| Living | TV UNIT/WALL UNIT/TALL UNIT shared specification group, Loft and Counter Top; instruction lists TV, crockery and pooja configurations |
| Accessories & Applicances | Instruction only: add Hafele prices with 45% discount; no supplied catalogue prices, so no prices invented |
| Doors | Explicitly keep empty; Main Doors, Bed Room Doors, Toilet Doors, Balcony/Sliding Doors as unpriced selections |
| Foyer & Veranda | Base unit/WALL UNIT/TALL UNIT group, Loft and Counter Top |
| Wall Panels | Shared wall panel specifications and prices; reusable in dry areas |
| Lists (hidden) | Preserve helper/dropdown data in source archive and audit |
| MasterFlat (hidden) | 238 legacy lookup combinations, full original fields and prices retained; match exact material/specification text only |

All cell contents and cached values are in `docs/new-source/cells.json`. Workbook XML, including styles, validations, names, hidden data, merges, row/column dimensions, page settings and drawing references, is retained alongside it. No source workbook is modified.

## Pricing

- Extraction produces 658 distinct item/specification combinations and 1,145 source price records across visible/area/hidden data. Repeated matching specifications share records and retain every source reference.
- 32 exact matches disagree between visible Master List and hidden MasterFlat. Official rates remain unavailable until Admin resolves them.
- Full specification text is authoritative. Parsed carcass/shutter/finish are search fields; they do not replace the original text or force every specification into three fields.
- Hardware rates in Master List are `D/E`. Bedroom sliding rates are `E+(C/D)`; B128 uses 1270 + 68000 / 30 = 3536.666666..., not a denominator of 1. Different named source configurations are retained separately.
- Constant formulas such as `=1390` remain 1390; the importer does not infer a different material surcharge.
- Missing rates remain null. Project overrides are separate from master prices, attributed to a user/time, and cannot bypass unresolved global conflicts.

## Quotations

Area sections reference configurable database areas. Room labels may be project-specific (e.g. Bedroom 1/2/3) while using the Bedrooms catalogue. Square feet use width × length; running feet use entered running length; accessories use quantity × rate; flat additions are charged once. Custom items are explicitly allowed by the instructions and store description/material/finish/unit/project rate without adding a master product.

Generation saves immutable customer, product, master/project rate, override attribution, measurements, totals, terms, company, logo, bank and user/time snapshots. Both generated document byte streams are saved per version. Existing PDF versions remain unchanged; historical versions without an Excel document are identified rather than rebuilt from current master data.

## PDF reference

The source PDF has one US Letter page (612 × 792 points), despite the requested A4 output. It is compact, with a top-right logo, company text, customer table, two-level blue header, yellow section rows, pale green section totals, yellow subtotal/GST and green grand total. It contains 35 lines, eight sections, 13 terms, customer/company signatures and bank details.

The user's clarification makes the PDF a visual reference only. No sample customer, measurements, prices, amounts, adjustments or bank data are imported. Existing company settings from the earlier Excel are retained. Admin can enter approved bank details in Company Settings; output uses those saved settings. Output uses requested A4 and controlled pagination.

The user explicitly approved the earlier complete terms together with the PDF's lifetime warranty sentence. These become the current terms setting; old quotations retain their saved terms. PDF sample arithmetic is excluded from business rules and validation data.
