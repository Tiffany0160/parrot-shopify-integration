'use strict';

require('dotenv').config();

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
    findProductBySku,
    syncProduct
} = require('./shopify/products');


async function main() {

    console.log('');
    console.log('======================================');
    console.log(' PARROT → SHOPIFY AB0012P TEST');
    console.log('======================================');
    console.log('');

    const products =
        loadCachedProducts();

    console.log(
        `Products available: ${products.length}`
    );

    /*
     * Find AB0012P in the cached Parrot feed.
     */
    const sourceProduct =
        products.find(
            product =>
                String(
                    product.StockCode || ''
                ).trim() === 'AB0012P'
        );

    if (!sourceProduct) {
        throw new Error(
            'AB0012P was not found in the Parrot feed.'
        );
    }

    const product =
        mapParrotProduct(
            sourceProduct
        );

    console.log('');
    console.log('PARROT PRODUCT');
    console.log('--------------------------------------');
    console.log(`SKU: ${product.sku}`);
    console.log(`Title: ${product.title}`);
    console.log(`Vendor: ${product.vendor}`);
    console.log(`Category: ${product.productType}`);
    console.log(`Barcode: ${product.barcode}`);
    console.log(`Price: R${product.price}`);
    console.log(`Supplier price: R${product.supplierPrice}`);
    console.log(`Stock: ${product.inventoryQuantity}`);
    console.log(`Images: ${product.images.length}`);
    console.log('');

    const locationId =
        process.env.SHOPIFY_LOCATION_ID;

    if (!locationId) {
        throw new Error(
            'SHOPIFY_LOCATION_ID is missing from .env'
        );
    }

    console.log(
        `Shopify location: ${locationId}`
    );

    console.log('');

    const shopify =
        new ShopifyClient();

    console.log(
        'Testing Shopify connection...'
    );

    const shop =
        await shopify.testConnection();

    console.log(
        `Connected to: ${shop.name}`
    );

    console.log('');

    /*
     * Check Shopify for AB0012P.
     */
    console.log(
        'Checking Shopify for SKU AB0012P...'
    );

    const existing =
        await findProductBySku(
            shopify,
            'AB0012P'
        );

    console.log('');

    if (existing) {

        console.log(
            'EXISTING PRODUCT FOUND'
        );

        console.log(
            '--------------------------------------'
        );

        console.log(
            `Product ID: ${existing.productId}`
        );

        console.log(
            `Variant ID: ${existing.variantId}`
        );

        console.log(
            `Inventory Item ID: ${existing.inventoryItemId}`
        );

        console.log(
            `SKU: ${existing.sku}`
        );

        console.log('');

        console.log(
            'This test will UPDATE the existing product.'
        );

        console.log(
            'It will NOT create a duplicate.'
        );

    } else {

        console.log(
            'WARNING: AB0012P WAS NOT FOUND IN SHOPIFY'
        );

        console.log(
            'The sync would CREATE it.'
        );
    }

    console.log('');

    console.log(
        'Starting AB0012P sync...'
    );

    console.log('');

    const result =
        await syncProduct(
            shopify,
            product,
            locationId
        );

    console.log('');
    console.log('======================================');
    console.log(' AB0012P TEST SUCCESS');
    console.log('======================================');
    console.log('');

    console.log(
        `Action: ${result.action}`
    );

    console.log(
        `SKU: ${result.sku}`
    );

    console.log(
        `Title: ${result.title}`
    );

    console.log(
        `Price: R${result.price}`
    );

    console.log(
        `Barcode: ${result.barcode}`
    );

    console.log(
        `Product ID: ${result.productId}`
    );

    console.log(
        `Variant ID: ${result.variantId}`
    );

    console.log(
        `Inventory Item ID: ${result.inventoryItemId}`
    );

    console.log(
        `Inventory Quantity: ${result.inventoryQuantity}`
    );

    console.log('');

    console.log(
        'AB0012P inventory was successfully synchronized.'
    );

    console.log('');
}


main().catch(error => {

    console.error('');
    console.error('======================================');
    console.error(' AB0012P TEST FAILED');
    console.error('======================================');
    console.error('');

    console.error(
        error.message
    );

    console.error('');

    process.exitCode = 1;
});