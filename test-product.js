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
    console.log(
        '======================================'
    );
    console.log(
        ' PARROT → SHOPIFY ONE PRODUCT TEST'
    );
    console.log(
        '======================================'
    );
    console.log('');


    console.log(
        'Loading cached Parrot feed...'
    );


    const products =
        loadCachedProducts();


    console.log(
        `Products available: ${products.length}`
    );


    if (
        products.length === 0
    ) {
        throw new Error(
            'The cached Parrot feed contains no products.'
        );
    }


    const sourceProduct =
        products[0];


    const product =
        mapParrotProduct(
            sourceProduct
        );


    console.log('');
    console.log(
        'TEST PRODUCT'
    );
    console.log(
        '--------------------------------------'
    );

    console.log(
        `SKU: ${product.sku}`
    );

    console.log(
        `Title: ${product.title}`
    );

    console.log(
        `Vendor: ${product.vendor}`
    );

    console.log(
        `Category: ${product.productType}`
    );

    console.log(
        `Barcode: ${product.barcode}`
    );

    console.log(
        `Price: R${product.price}`
    );

    console.log(
        `Supplier price: R${product.supplierPrice}`
    );

    console.log(
        `Stock: ${product.inventoryQuantity}`
    );

    console.log(
        `Images: ${product.images.length}`
    );

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


    console.log(
        `Checking Shopify for SKU ${product.sku}...`
    );


    const existing =
        await findProductBySku(
            shopify,
            product.sku
        );


    if (existing) {

        console.log('');

        console.log(
            'WARNING: THIS SKU ALREADY EXISTS'
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
            `SKU: ${existing.sku}`
        );

        console.log('');

        console.log(
            'The test will UPDATE this product instead of creating a duplicate.'
        );

        console.log('');

    } else {

        console.log('');

        console.log(
            'SKU does not exist in Shopify.'
        );

        console.log(
            'The test will CREATE the product.'
        );

        console.log('');
    }


    console.log(
        'Starting ONE PRODUCT sync...'
    );

    console.log('');


    const result =
        await syncProduct(
            shopify,
            product,
            locationId
        );


    console.log('');

    console.log(
        '======================================'
    );

    console.log(
        ' ONE PRODUCT SYNC SUCCESS'
    );

    console.log(
        '======================================'
    );

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
        'The Parrot product was successfully sent to Shopify.'
    );

    console.log('');
}


main().catch(error => {

    console.error('');

    console.error(
        '======================================'
    );

    console.error(
        ' ONE PRODUCT SYNC FAILED'
    );

    console.error(
        '======================================'
    );

    console.error('');

    console.error(
        error.message
    );

    console.error('');

    process.exitCode = 1;
});