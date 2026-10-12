'use strict';

require('dotenv').config();

const { ShopifyClient } = require('./shopify/client');

async function main() {
    console.log('');
    console.log('======================================');
    console.log(' SHOPIFY LOCATION TEST');
    console.log('======================================');
    console.log('');

    const shopify = new ShopifyClient();

    console.log('Getting Shopify locations...');
    console.log('');

    const locations = await shopify.getLocations();

    if (!locations || locations.length === 0) {
        throw new Error(
            'No Shopify locations were returned.'
        );
    }

    console.log(`Locations found: ${locations.length}`);
    console.log('');

    locations.forEach((location, index) => {
        console.log(`Location ${index + 1}`);
        console.log('--------------------------------------');
        console.log(`Name: ${location.name}`);
        console.log(`ID: ${location.id}`);
        console.log(`Active: ${location.isActive}`);
        console.log('');
    });

    const activeLocations = locations.filter(
        location => location.isActive
    );

    if (activeLocations.length === 0) {
        throw new Error(
            'No active Shopify locations were found.'
        );
    }

    console.log('======================================');
    console.log(' ACTIVE LOCATION');
    console.log('======================================');
    console.log('');

    console.log(
        `Name: ${activeLocations[0].name}`
    );

    console.log(
        `ID: ${activeLocations[0].id}`
    );

    console.log('');

    console.log(
        'Use this ID for SHOPIFY_LOCATION_ID.'
    );

    console.log('');
}

main().catch(error => {
    console.error('');
    console.error('======================================');
    console.error(' LOCATION TEST FAILED');
    console.error('======================================');
    console.error('');

    console.error(error.message);

    console.error('');

    process.exitCode = 1;
});