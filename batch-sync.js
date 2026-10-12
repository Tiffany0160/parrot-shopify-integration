
'use strict';

require('dotenv').config();

const fs = require('fs');
const path = require('path');

const {
    loadCachedProducts
} = require('./parrot/feed');

const {
    mapParrotProduct
} = require('./parrot/mapper');

const {
    ShopifyClient
} = require('./shopify/client');

const {
    syncProduct
} = require('./shopify/products');

const DATA_DIR = path.join(__dirname, '..', 'data');
const LOGS_DIR = path.join(__dirname, '..', 'logs');

const CHECKPOINT_FILE = path.join(
    DATA_DIR,
    'parrot-sync-checkpoint.json'
);

const ERROR_FILE = path.join(
    LOGS_DIR,
    'parrot-sync-errors.json'
);

const BATCH_SIZE = Number(process.env.BATCH_SIZE || 500);
const MARKUP_PERCENT = Number(process.env.MARKUP_PERCENT);

const DELAY_MS = 250;

function ensureDirectories() {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.mkdirSync(LOGS_DIR, { recursive: true });
}

function loadCheckpoint() {
    if (!fs.existsSync(CHECKPOINT_FILE)) {
        return { completed: {} };
    }

    try {
        const data = JSON.parse(
            fs.readFileSync(CHECKPOINT_FILE, 'utf8')
        );

        if (!data.completed) {
            data.completed = {};
        }

        return data;
    } catch {
        return { completed: {} };
    }
}

function saveCheckpoint(checkpoint) {
    ensureDirectories();

    fs.writeFileSync(
        CHECKPOINT_FILE,
        JSON.stringify(checkpoint, null, 2),
        'utf8'
    );
}

function loadErrors() {
    if (!fs.existsSync(ERROR_FILE)) {
        return [];
    }

    try {
        return JSON.parse(
            fs.readFileSync(ERROR_FILE, 'utf8')
        );
    } catch {
        return [];
    }
}

function saveError(error) {
    ensureDirectories();

    const errors = loadErrors();

    errors.push({
        time: new Date().toISOString(),
        sku: error.sku || '',
        title: error.title || '',
        message: error.message || String(error)
    });

    fs.writeFileSync(
        ERROR_FILE,
        JSON.stringify(errors, null, 2),
        'utf8'
    );
}

function sleep(milliseconds) {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
}

function getBatchNumber() {
    const batchNumber = Number(process.argv[2]);

    if (!Number.isInteger(batchNumber) || batchNumber < 1) {
        throw new Error(
            'Specify a batch number, for example: node .\\src\\batch-sync.js 1'
        );
    }

    return batchNumber;
}

async function main() {
    ensureDirectories();

    if (
        !Number.isFinite(MARKUP_PERCENT) ||
        MARKUP_PERCENT < 0
    ) {
        throw new Error(
            'Invalid MARKUP_PERCENT. Check your .env file.'
        );
    }

    if (
        !Number.isInteger(BATCH_SIZE) ||
        BATCH_SIZE < 1
    ) {
        throw new Error(
            'BATCH_SIZE must be a positive whole number.'
        );
    }

    const batchNumber = getBatchNumber();

    const products = loadCachedProducts();

    const totalProducts = products.length;

    const totalBatches = Math.ceil(
        totalProducts / BATCH_SIZE
    );

    if (batchNumber > totalBatches) {
        throw new Error(
            `Batch ${batchNumber} does not exist. There are ${totalBatches} batches.`
        );
    }

    const startIndex = (batchNumber - 1) * BATCH_SIZE;

    const endIndex = Math.min(
        startIndex + BATCH_SIZE,
        totalProducts
    );

    const batchProducts = products.slice(
        startIndex,
        endIndex
    );

    console.log('');
    console.log('======================================');
    console.log(' PARROT → SHOPIFY BATCH SYNC');
    console.log('======================================');
    console.log('');

    console.log(`Markup: ${MARKUP_PERCENT}%`);
    console.log(`Total products: ${totalProducts}`);
    console.log(`Batch size: ${BATCH_SIZE}`);
    console.log(`Total batches: ${totalBatches}`);
    console.log(`Current batch: ${batchNumber}/${totalBatches}`);
    console.log(`Products in this batch: ${batchProducts.length}`);
    console.log(`Product range: ${startIndex + 1}-${endIndex}`);
    console.log('');

    const locationId = process.env.SHOPIFY_LOCATION_ID;

    if (!locationId) {
        throw new Error(
            'SHOPIFY_LOCATION_ID is missing from .env'
        );
    }

    const shopify = new ShopifyClient();

    console.log('Testing Shopify connection...');

    const shop = await shopify.testConnection();

    console.log(`Connected to: ${shop.name}`);
    console.log('');

    const checkpoint = loadCheckpoint();

    let created = 0;
    let updated = 0;
    let skipped = 0;
    let failed = 0;

    for (let i = 0; i < batchProducts.length; i++) {
        const globalIndex = startIndex + i;
        const sourceProduct = batchProducts[i];

        let product;

        try {
            /*
             * The mapper calculates the price using
             * MARKUP_PERCENT from the current environment.
             */
            product = mapParrotProduct(sourceProduct);
        } catch (error) {
            failed++;

            saveError({
                sku: sourceProduct.StockCode || '',
                title: sourceProduct.FriendlyTitle || '',
                message: `Mapping error: ${error.message}`
            });

            console.log('');
            console.log(
                `[${globalIndex + 1}/${totalProducts}] MAPPING ERROR`
            );
            console.log(error.message);

            continue;
        }

        console.log('');
        console.log('----------------------------------------------');
        console.log(`[${globalIndex + 1}/${totalProducts}] ${product.sku}`);
        console.log(product.title);
        console.log(`Supplier price: R${product.supplierPrice.toFixed(2)}`);
        console.log(`Shopify price at ${MARKUP_PERCENT}%: R${product.price}`);
        console.log('----------------------------------------------');

        /*
         * IMPORTANT:
         *
         * Checkpointed products are skipped. They will NOT
         * receive a new price just because the markup changed.
         *
         * The separate refresh-prices.js script must be run
         * to update the prices of products already completed.
         */
        if (checkpoint.completed[product.sku]) {
            skipped++;

            console.log(
                'ALREADY COMPLETED - SKIPPING'
            );

            continue;
        }

        try {
            const result = await syncProduct(
                shopify,
                product,
                locationId
            );

            if (result.action === 'CREATED') {
                created++;
            } else if (result.action === 'UPDATED') {
                updated++;
            }

            checkpoint.completed[product.sku] = {
                completedAt: new Date().toISOString(),
                action: result.action,
                productId: result.productId,
                variantId: result.variantId,
                inventoryQuantity: result.inventoryQuantity,
                markupPercent: MARKUP_PERCENT,
                price: product.price
            };

            saveCheckpoint(checkpoint);

            console.log(`SUCCESS: ${result.action}`);

            await sleep(DELAY_MS);
        } catch (error) {
            failed++;

            console.error(`FAILED: ${error.message}`);

            saveError({
                sku: product.sku,
                title: product.title,
                message: error.message
            });

            console.log(
                'Product was not added to the checkpoint.'
            );
        }
    }

    console.log('');
    console.log('======================================');
    console.log(' BATCH COMPLETE');
    console.log('======================================');
    console.log('');

    console.log(`Markup: ${MARKUP_PERCENT}%`);
    console.log(`Batch: ${batchNumber}/${totalBatches}`);
    console.log(`Products: ${batchProducts.length}`);
    console.log(`Created: ${created}`);
    console.log(`Updated: ${updated}`);
    console.log(`Skipped: ${skipped}`);
    console.log(`Failed: ${failed}`);
    console.log('');

    console.log(`Checkpoint: ${CHECKPOINT_FILE}`);
    console.log(`Errors: ${ERROR_FILE}`);
    console.log('');
}

main().catch(error => {
    console.error('');
    console.error('======================================');
    console.error(' BATCH SYNC FAILED');
    console.error('======================================');
    console.error('');
    console.error(error.message);
    console.error('');

    process.exitCode = 1;
});

