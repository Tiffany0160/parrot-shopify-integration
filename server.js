'use strict';

require('dotenv').config();

const {
    loadCachedProducts
} = require('./parrot/feed');

const {
    mapParrotProduct
} = require('./parrot/mapper');


function main() {

    console.log('');
    console.log(
        '======================================'
    );
    console.log(
        ' PARROT FEED TEST'
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
        `Products loaded: ${products.length}`
    );


    if (
        products.length === 0
    ) {
        throw new Error(
            'No products were found.'
        );
    }


    const product =
        mapParrotProduct(
            products[0]
        );


    console.log('');
    console.log(
        'FIRST PRODUCT'
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
        `Supplier Price: R${product.supplierPrice}`
    );

    console.log(
        `Stock: ${product.inventoryQuantity}`
    );

    console.log(
        `Images: ${product.images.length}`
    );

    console.log(
        `Tariff Code: ${product.tariffCode}`
    );

    console.log('');

    console.log(
        'Feed and mapper are working.'
    );

    console.log('');
}


try {

    main();

} catch (error) {

    console.error('');
    console.error(
        'FEED TEST FAILED'
    );
    console.error('');
    console.error(
        error.message
    );

    process.exitCode = 1;
}