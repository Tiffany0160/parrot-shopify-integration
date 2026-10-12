'use strict';

require('dotenv').config();

const { ShopifyClient } = require('./shopify/client');

async function main() {
    console.log('');
    console.log('======================================');
    console.log(' SHOPIFY CONNECTION TEST');
    console.log('======================================');
    console.log('');

    console.log('Connecting to Shopify...');
    console.log('');

    const shopify = new ShopifyClient();

    const shop = await shopify.testConnection();

    console.log('SHOPIFY CONNECTION SUCCESS');
    console.log('');

    console.log(`Store name: ${shop.name}`);
    console.log(`Shop domain: ${shop.myshopifyDomain}`);
    console.log(`Shop ID: ${shop.id}`);

    console.log('');
    console.log('Shopify connection is working.');
    console.log('');
}

main().catch(error => {
    console.error('');
    console.error('======================================');
    console.error(' SHOPIFY CONNECTION FAILED');
    console.error('======================================');
    console.error('');

    console.error(error.message);

    console.error('');

    process.exitCode = 1;
});