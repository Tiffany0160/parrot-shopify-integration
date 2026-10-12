# parrot-shopify-integration

# Parrot Products → Shopify Integration

## 1. Project Overview

The Parrot Products → Shopify Integration is a Node.js application developed to automate the transfer and synchronisation of products from the Parrot Products supplier feed into a Shopify store.

The integration reduces manual product loading by processing supplier product information and synchronising it with Shopify.

The project is configured for **Kernell Electronics**.

### Main objectives

* Import products from the Parrot Products supplier feed.
* Create new products in Shopify.
* Update existing Shopify products using their supplier SKUs.
* Calculate selling prices using a configurable markup percentage.
* Apply a 17% markup to supplier prices.
* Synchronise product inventory quantities.
* Import product images when available.
* Map product brands, categories, barcodes, and other product information.
* Process products in manageable batches of 500.
* Keep track of completed products using a checkpoint file.
* Record errors for troubleshooting.
* Refresh prices independently without reimporting product images or changing inventory.

---

## 2. Technologies Used

| Technology                | Purpose                                                 |
| ------------------------- | ------------------------------------------------------- |
| Node.js                   | Runs the integration application                        |
| JavaScript                | Implements product mapping and synchronisation          |
| Shopify Admin GraphQL API | Creates and updates Shopify products                    |
| Shopify authentication    | Authenticates API requests                              |
| Parrot Products feed      | Provides supplier product information                   |
| dotenv                    | Loads environment variables from `.env`                 |
| Axios                     | Makes HTTP requests where used by the application       |
| JSON                      | Stores cached feed data, checkpoints, and error reports |
| PowerShell                | Runs the integration commands on Windows                |

---

## 3. Project Location

The project is located at:

```text
C:\Users\tiffa\OneDrive\Desktop\parrot-shopify-integration
```

Open PowerShell and navigate to the project directory:

```powershell
cd C:\Users\tiffa\OneDrive\Desktop\parrot-shopify-integration
```

All commands in this README assume that PowerShell is running from this directory.

---

## 4. Project Structure

The project contains the following important files and directories.

```text
parrot-shopify-integration/
│
├── .env
├── package.json
├── package-lock.json
│
├── data/
│   ├── parrot-products.json
│   └── parrot-sync-checkpoint.json
│
├── logs/
│   ├── parrot-sync-errors.json
│   └── parrot-price-refresh-report.json
│
└── src/
    ├── batch-sync.js
    ├── refresh-prices.js
    │
    ├── parrot/
    │   ├── feed.js
    │   └── mapper.js
    │
    └── shopify/
        ├── client.js
        └── products.js
```

**Note:** This is the documented logical structure of the project. Check your actual folders in File Explorer before creating any missing files. Additional test scripts or other files may also exist.

### File descriptions

| File or directory                       | Purpose                                                                          |
| --------------------------------------- | -------------------------------------------------------------------------------- |
| `.env`                                  | Stores Shopify settings, supplier feed settings, markup, and other configuration |
| `package.json`                          | Defines the Node.js project and its dependencies                                 |
| `data/parrot-products.json`             | Cached Parrot Products feed                                                      |
| `data/parrot-sync-checkpoint.json`      | Tracks completed products so batches can skip previously completed work          |
| `logs/parrot-sync-errors.json`          | Records synchronisation errors                                                   |
| `logs/parrot-price-refresh-report.json` | Records price refresh results, including products that could not be updated      |
| `src/batch-sync.js`                     | Processes products in batches                                                    |
| `src/refresh-prices.js`                 | Updates prices for products already found in Shopify                             |
| `src/parrot/feed.js`                    | Loads the cached supplier feed                                                   |
| `src/parrot/mapper.js`                  | Maps supplier fields and calculates Shopify selling prices                       |
| `src/shopify/client.js`                 | Handles Shopify authentication and GraphQL requests                              |
| `src/shopify/products.js`               | Finds, creates, and updates Shopify products and inventory                       |

---

## 5. Installation and Setup

### Requirements

Install Node.js on the Windows computer.

Verify that Node.js and npm are available:

```powershell
node --version
```

```powershell
npm --version
```

Navigate to the project directory:

```powershell
cd C:\Users\tiffa\OneDrive\Desktop\parrot-shopify-integration
```

Install the project dependencies:

```powershell
npm install
```

If the dependencies have already been installed, you generally do not need to repeat this step unless the project dependencies change.

---

## 6. Environment Configuration

The `.env` file contains configuration used by the integration.

Open it from PowerShell:

```powershell
notepad .env
```

The configuration should include the appropriate values for your Shopify application, store, supplier feed, inventory location, and pricing rules.

### Example configuration

The following is an illustrative template. Keep your existing working values for credentials, feed access, store, and location.

```dotenv
# Shopify store
SHOPIFY_STORE_DOMAIN=rrqz14-1d.myshopify.com
SHOPIFY_API_VERSION=2026-07

# Shopify authentication
SHOPIFY_CLIENT_ID=YOUR_SHOPIFY_CLIENT_ID
SHOPIFY_CLIENT_SECRET=YOUR_SHOPIFY_CLIENT_SECRET

# Shopify inventory location
SHOPIFY_LOCATION_ID=gid://shopify/Location/84123287730

# Supplier feed
TARSUS_XML_URL=
# Not used by the Parrot integration.
# Configure the actual Parrot feed settings required by your code.

# Product settings
MARKUP_PERCENT=17

# Synchronisation settings
BATCH_SIZE=500

# Product publishing setting, if used by the current code
CREATE_AS_DRAFT=false

# Application port, if used by the current code
PORT=4000
```

**Important configuration notes:**

* The example above documents the shared Shopify and pricing settings. It is not a replacement for your working Parrot `.env` file.
* `TARSUS_XML_URL` belongs to a different supplier integration and is not used by the Parrot integration.
* Keep the existing Parrot feed configuration required by `src/parrot/feed.js`.
* Only keep environment variables that your actual application uses.
* The Shopify location ID must be a valid location belonging to your store.
* The Shopify API version and authentication configuration must match the implementation in `src/shopify/client.js`.
* Do not commit `.env` or any real credentials to GitHub.

### Verify the markup

Run:

```powershell
Select-String -Path .\.env -Pattern "^MARKUP_PERCENT="
```

Expected output:

```text
.env:17:MARKUP_PERCENT=17
```

The line number may differ depending on your `.env` file.

---

## 7. Supplier Feed

The application uses a cached Parrot Products feed.

The cached file is:

```text
data/parrot-products.json
```

The feed currently contains **1,478 products**.

The feed provides product details that the application maps into Shopify product fields.

### Supplier fields

The mapping uses fields such as:

| Parrot field                      | Purpose                                               |
| --------------------------------- | ----------------------------------------------------- |
| `StockCode`                       | Product SKU                                           |
| `CustomerPrice`                   | Supplier price used for the selling-price calculation |
| `FriendlyTitle`                   | Preferred product title                               |
| `Description`                     | Fallback product description or title                 |
| `Brand`                           | Product vendor or brand                               |
| `ProductBarCode`                  | Product barcode                                       |
| `ProductImageLinks`               | Product image URLs                                    |
| `TotalWarehouseStock`             | Supplier stock quantity                               |
| `PublishingCategory.CategoryName` | Product category                                      |
| Tariff information                | Additional product metadata where available           |

The actual values depend on the supplier feed.

### Feed caching

Caching allows the application to work from the saved feed rather than downloading the supplier feed for every product.

If the supplier's product information changes, the cache must be refreshed through the feed-loading process implemented by the application.

Before running a full synchronisation, confirm that the cached feed is available and contains the expected products.

---

## 8. Product Mapping

The Parrot mapper converts supplier information into the format required by Shopify.

### Product mapping rules

| Shopify field | Source or rule                                                           |
| ------------- | ------------------------------------------------------------------------ |
| SKU           | `StockCode`                                                              |
| Product title | `FriendlyTitle`, with fallback fields where necessary                    |
| Vendor        | `Brand`, with a fallback of `PARROT PRODUCTS`                            |
| Product type  | Supplier publishing category                                             |
| Barcode       | `ProductBarCode`                                                         |
| Images        | URLs in `ProductImageLinks`                                              |
| Inventory     | `TotalWarehouseStock`                                                    |
| Price         | Supplier price plus the configured markup                                |
| Tags          | Brand, category, tariff information where available, and Parrot Products |

The application should identify existing products by SKU to avoid creating duplicate products when the same supplier SKU already exists in Shopify.

---

## 9. Selling Price and Markup Calculation

The current markup is configured at **17%**.

The mapper reads the `MARKUP_PERCENT` environment variable to calculate the selling price.

### Formula

```text
Selling Price = Supplier Price × (1 + Markup Percentage / 100)
```

With a 17% markup:

```text
Selling Price = Supplier Price × 1.17
```

The resulting price is rounded to two decimal places.

### Examples

| SKU     | Supplier price | Markup | Shopify selling price |
| ------- | -------------: | -----: | --------------------: |
| AB0012B |         R96.85 |    17% |               R113.31 |
| AB1010  |         R45.83 |    17% |                R53.62 |
| AB1012  |         R38.35 |    17% |                R44.87 |
| AC1001  |        R570.80 |    17% |               R667.84 |

These examples illustrate the configured calculation; actual supplier prices can change.

### Important pricing behaviour

The markup is applied to the supplier price. It is not a 17% discount.

For example, if the supplier price is R100.00:

```text
Supplier price: R100.00
Markup:         R17.00
Selling price:  R117.00
```

Changing `MARKUP_PERCENT` does not automatically change products already stored in Shopify. A synchronisation or price refresh must update their existing prices.

---

## 10. Batch Synchronisation

The integration processes products in batches to make the import easier to manage.

The configured batch size is 500 products.

### Total products

```text
Total products: 1478
Batch size: 500
Total batches: 3
```

### Batch breakdown

| Batch     | Product positions | Number of products |
| --------- | ----------------: | -----------------: |
| Batch 1   |             1–500 |                500 |
| Batch 2   |          501–1000 |                500 |
| Batch 3   |         1001–1478 |                478 |
| **Total** |        **1–1478** |          **1,478** |

### Run Batch 1

```powershell
node .\src\batch-sync.js 1
```

### Run Batch 2

```powershell
node .\src\batch-sync.js 2
```

### Run Batch 3

```powershell
node .\src\batch-sync.js 3
```

### Recommended execution order

Run the batches in order:

1. Start Batch 1.
2. Wait for Batch 1 to finish.
3. Start Batch 2.
4. Wait for Batch 2 to finish.
5. Start Batch 3.
6. Wait for Batch 3 to finish.
7. Review the errors and price-refresh reports.

Do not run multiple batches simultaneously. Overlapping synchronisation requests can cause unnecessary API calls and make troubleshooting more difficult.

### How batch processing works

For each product, the integration is intended to:

1. Read the supplier product.
2. Map its information.
3. Calculate its selling price using the configured markup.
4. Search Shopify for the SKU.
5. Create the product if it does not exist.
6. Update the product if it already exists and needs synchronisation.
7. Synchronise its inventory quantity.
8. Record successful completion in the checkpoint.
9. Record failures for troubleshooting.

The precise operations performed depend on the current implementation in the project files.

---

## 11. Checkpoint Behaviour

The checkpoint file is:

```text
data/parrot-sync-checkpoint.json
```

It tracks products that the batch synchronisation has already completed.

You may see:

```text
ALREADY COMPLETED - SKIPPING
```

This means the batch process recognises that the product has already been recorded as completed.

### Why this matters

Suppose Batch 1 completed a product when the markup was 15%.

You then change the markup to 17%.

Running Batch 1 again may skip that product because it is already checkpointed. The product will therefore not necessarily receive the new price through the batch process.

### Checkpoint rules

* Do not delete the checkpoint just to update prices.
* Do not assume that rerunning a completed batch will reprocess every product.
* Use the price refresh script to update prices for existing products.
* Review the checkpoint and error reports when determining which products still need to be synchronised.

The checkpoint is important for resuming work without unnecessarily repeating completed operations.

---

## 12. Refresh Prices to 17%

The price refresh script is:

```text
src/refresh-prices.js
```

It is designed to update the prices of existing Shopify products using the current markup configuration.

It does not rely on the batch checkpoint in the same way as the batch synchronisation process.

### Step 1: Confirm the markup

```powershell
Select-String -Path .\.env -Pattern "^MARKUP_PERCENT="
```

Confirm that the output shows:

```text
MARKUP_PERCENT=17
```

### Step 2: Check the script

```powershell
node --check .\src\refresh-prices.js
```

If no syntax error is printed, the file passes the JavaScript syntax check.

### Step 3: Run the price refresh

```powershell
node .\src\refresh-prices.js
```

### Step 4: Wait for completion

The script should:

1. Load the cached Parrot feed.
2. Read the current markup.
3. Connect to Shopify.
4. Process the supplier products.
5. Calculate each new selling price.
6. Find matching Shopify products by SKU.
7. Update prices for products found in Shopify.
8. Report missing products and failed updates.
9. Save a price-refresh report.

Example output:

```text
PARROT → SHOPIFY PRICE REFRESH

Markup: 17%
Parrot products: 1478

Testing Shopify connection...
Connected to: Kernell Electronics

[1/1478] AB0012B
12-Digit Desktop Calculator Black Dual Power

New price: R113.31
PRICE UPDATED: R113.31
```

### Important limitations

The price refresh updates prices; it is not a full product import.

It does not create products that are missing from Shopify. It also does not synchronise stock or images.

If a product is not found, check the price-refresh report and run the appropriate batch synchronisation for that product after verifying its checkpoint status.

Do not start the price refresh while a batch is still running. Wait until the batch finishes to avoid overlapping Shopify API operations.

---

## 13. Inventory Synchronisation

The integration uses the supplier stock quantity to update Shopify inventory.

The source field is:

```text
TotalWarehouseStock
```

The integration sets the inventory quantity for the configured Shopify location.

### Example

```text
SKU: AB0012P

Shopify current stock: 0
Parrot stock: 4779

Shopify inventory successfully set to 4779.
```

The actual stock quantities depend on the supplier feed.

### Inventory requirements

* The product must have a valid Shopify variant.
* The variant must have an inventory item.
* Inventory tracking must be enabled where required.
* The Shopify location must be valid.
* The application must have the necessary Shopify API permissions.

The integration should report inventory errors so that they can be investigated.

**Note:** Supplier stock is subject to change. The quantity imported is the quantity supplied in the feed at the time of synchronisation.

---

## 14. Product Images

The supplier feed provides product image URLs through:

```text
ProductImageLinks
```

The product mapping and Shopify product synchronisation code are responsible for converting these links into Shopify product media.

The price refresh script does not update product images.

If images are missing:

1. Confirm that the supplier feed contains image URLs.
2. Check that the image URLs are accessible.
3. Review the relevant Shopify product.
4. Check the batch error log.
5. Verify that the current product synchronisation code processes images correctly.

Do not assume that every supplier product has images.

---

## 15. Testing the Integration

Before processing the entire feed, test the integration with a small number of products.

The project has previously used test scripts such as:

```powershell
node .\src\test-product.js
```

and:

```powershell
node .\src\test-ab0012p.js
```

These commands should only be used if those files still exist in your project.

### Recommended checks

* Verify that Shopify authentication works.
* Confirm that the correct Shopify store is connected.
* Check that a supplier SKU is found correctly.
* Confirm that the mapper calculates the correct selling price.
* Confirm that existing products are updated rather than duplicated.
* Confirm that inventory is updated to the supplier quantity.
* Verify that product images are processed as expected.
* Review the error and checkpoint files.

Test scripts may make changes to live Shopify products. Use appropriate test products and verify the intended changes before running them.

---

## 16. Troubleshooting

### Problem: `ALREADY COMPLETED - SKIPPING`

**Cause:** The SKU is already recorded as completed in the checkpoint.

**Solution:** If the goal is to update existing prices, run:

```powershell
node .\src\refresh-prices.js
```

If the product is missing from Shopify, investigate its checkpoint and error status before deciding whether to rerun the batch.

### Problem: Shopify authentication fails

**Possible causes:**

* Incorrect client ID or client secret.
* Incorrect store domain.
* Missing or insufficient Shopify API permissions.
* Authentication configuration does not match the application code.

**Checks:**

```powershell
node --check .\src\shopify\client.js
```

Confirm that the required authentication values are present in `.env`. Never share the actual secret values in logs or messages.

### Problem: Product not found in Shopify

**Possible causes:**

* The product has not yet been created.
* The SKU in Shopify differs from the supplier SKU.
* The product was skipped by the batch process.
* A previous synchronisation failed.

**Solution:** Check the SKU in Shopify, the checkpoint file, and the relevant error or price-refresh report.

### Problem: Price did not change

**Possible causes:**

* The product was skipped by the batch checkpoint.
* The price-refresh script did not find the product.
* The Shopify update failed.
* The markup setting is incorrect.
* A different script or environment configuration was used.

**Checks:**

```powershell
Select-String -Path .\.env -Pattern "^MARKUP_PERCENT="
```

Then, after any running batch has finished:

```powershell
node .\src\refresh-prices.js
```

Check the final summary and price-refresh report.

### Problem: Inventory update fails

**Possible causes:**

* Inventory tracking is disabled.
* The Shopify location is invalid.
* The inventory item is unavailable.
* The inventory quantity changed between the read and update operations.
* Shopify returned an API validation error.

Review the full error message before retrying the operation.

### Problem: JavaScript syntax error

Check the relevant file:

```powershell
node --check .\src\batch-sync.js
```

```powershell
node --check .\src\refresh-prices.js
```

```powershell
node --check .\src\parrot\mapper.js
```

A successful syntax check produces no error output.

---

## 17. Logs and Reports

The project uses log and checkpoint files to help monitor progress.

| File                                    | Purpose                                      |
| --------------------------------------- | -------------------------------------------- |
| `data/parrot-sync-checkpoint.json`      | Tracks completed products                    |
| `logs/parrot-sync-errors.json`          | Records synchronisation failures             |
| `logs/parrot-price-refresh-report.json` | Records price-refresh results and exceptions |

### After a batch finishes

Check the batch output and error report.

### After a price refresh finishes

Check the final summary and price-refresh report.

Pay particular attention to:

* Products updated successfully.
* Products not found in Shopify.
* Products that failed to update.
* Any products that were skipped.
* Any inventory or image errors reported by the synchronisation code.

Do not claim that all 1,478 products are synchronised until the results have been checked.

---

## 18. Recommended Full Synchronisation Procedure

Use this sequence when processing the complete Parrot feed.

### Step 1: Open the project

```powershell
cd C:\Users\tiffa\OneDrive\Desktop\parrot-shopify-integration
```

### Step 2: Verify the markup

```powershell
Select-String -Path .\.env -Pattern "^MARKUP_PERCENT="
```

Confirm:

```text
MARKUP_PERCENT=17
```

### Step 3: Check the JavaScript files

```powershell
node --check .\src\batch-sync.js
```

```powershell
node --check .\src\refresh-prices.js
```

```powershell
node --check .\src\parrot\mapper.js
```

### Step 4: Run Batch 1

```powershell
node .\src\batch-sync.js 1
```

Wait until it finishes.

### Step 5: Run Batch 2

```powershell
node .\src\batch-sync.js 2
```

Wait until it finishes.

### Step 6: Run Batch 3

```powershell
node .\src\batch-sync.js 3
```

Wait until it finishes.

### Step 7: Refresh prices

```powershell
node .\src\refresh-prices.js
```

This updates prices for existing matching products using the 17% markup.

### Step 8: Review the results

Review:

```text
logs/parrot-sync-errors.json
logs/parrot-price-refresh-report.json
```

Also inspect the final batch output and the checkpoint file.

### Step 9: Verify products in Shopify

Check a selection of products to confirm:

* SKU is correct.
* Title is correct.
* Selling price reflects the 17% markup.
* Vendor and category are correct.
* Images are present where supplied.
* Inventory matches the supplier feed.
* No unintended duplicate products were created.

---

## 19. Important Operational Rules

1. **Keep the markup at 17%** unless the required pricing strategy changes.
2. Do not run multiple batches at the same time.
3. Do not run the price refresh while a batch is still processing.
4. Do not delete the checkpoint just to update product prices.
5. Remember that the price refresh updates existing products; it does not create missing products.
6. Review errors before retrying failed products.
7. Protect the Shopify credentials and supplier feed access details.
8. Do not commit `.env` to a public GitHub repository.
9. Verify the Shopify location and API permissions before running a full synchronisation.
10. Confirm the final reports before declaring the import complete.

---

## 20. Security and Git

The `.env` file may contain sensitive authentication information.

Add or verify the following entries in `.gitignore`:

```gitignore
.env
node_modules/
```

If your project stores logs or supplier data that should not be published, consider adding:

```gitignore
data/
logs/
```

Only ignore `data/` and `logs/` if you do not need to distribute those files as part of your intended project workflow.

Before pushing the project to GitHub, inspect the files being committed to ensure that no credentials, private supplier feed links, or access tokens are included.

---

## 21. Current Project Status

The following reflects the last confirmed project state documented during development.

| Item                      | Status                                                  |
| ------------------------- | ------------------------------------------------------- |
| Cached Parrot feed        | 1,478 products loaded                                   |
| Shopify connection        | Successfully connected to Kernell Electronics           |
| Markup configuration      | 17%                                                     |
| Batch size                | 500 products                                            |
| Batch count               | 3                                                       |
| Product SKU lookup        | Tested                                                  |
| Existing product updates  | Tested                                                  |
| Product creation          | Tested                                                  |
| Inventory updates         | Tested                                                  |
| Price refresh script      | Created and syntax checked                              |
| Price refresh             | Successfully updating the products shown in the console |
| Full 1,478-product import | Requires final batch and report verification            |

The successful updates shown during testing demonstrate that important parts of the integration are working. The entire project should only be marked fully synchronised after all batches have finished and the final error and price-refresh reports have been reviewed.

---

## 22. Useful Commands Reference

| Task                            | Command                                                         |
| ------------------------------- | --------------------------------------------------------------- |
| Navigate to project             | `cd C:\Users\tiffa\OneDrive\Desktop\parrot-shopify-integration` |
| Verify markup                   | `Select-String -Path .\.env -Pattern "^MARKUP_PERCENT="`        |
| Check batch script              | `node --check .\src\batch-sync.js`                              |
| Check price refresh             | `node --check .\src\refresh-prices.js`                          |
| Check mapper                    | `node --check .\src\parrot\mapper.js`                           |
| Run Batch 1                     | `node .\src\batch-sync.js 1`                                    |
| Run Batch 2                     | `node .\src\batch-sync.js 2`                                    |
| Run Batch 3                     | `node .\src\batch-sync.js 3`                                    |
| Refresh existing product prices | `node .\src\refresh-prices.js`                                  |
| Open `.env`                     | `notepad .env`                                                  |

---

## 23. Conclusion

The Parrot Products → Shopify Integration is designed to automate product importing, pricing, and inventory synchronisation for Kernell Electronics.

It uses a cached supplier feed, product mapping, Shopify API integration, batch processing, checkpoint tracking, and a separate price-refresh process.

The current configuration applies a 17% markup to supplier prices and processes the 1,478-product feed in three batches.

The recommended approach is to process the batches sequentially, refresh existing prices after the batches finish, and review the final reports to identify missing products or failed operations.
