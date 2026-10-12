'use strict';

const fs = require('fs');
const path = require('path');
const axios = require('axios');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');

const CACHE_FILE = path.join(
    DATA_DIR,
    'parrot-products.json'
);


function normalizeProducts(data) {
    if (Array.isArray(data)) {
        return data;
    }

    if (
        data &&
        Array.isArray(data.Products)
    ) {
        return data.Products;
    }

    if (
        data &&
        Array.isArray(data.Data)
    ) {
        return data.Data;
    }

    if (
        data &&
        data.ArrayOfProductInformationForWeb &&
        Array.isArray(
            data.ArrayOfProductInformationForWeb
                .ProductInformationForWeb
        )
    ) {
        return data.ArrayOfProductInformationForWeb
            .ProductInformationForWeb;
    }

    throw new Error(
        'Could not find the product array in the Parrot feed.'
    );
}


function ensureDataDirectory() {
    fs.mkdirSync(
        DATA_DIR,
        {
            recursive: true
        }
    );
}


function saveProducts(products) {
    ensureDataDirectory();

    fs.writeFileSync(
        CACHE_FILE,
        JSON.stringify(
            products,
            null,
            2
        ),
        'utf8'
    );
}


function loadCachedProducts() {
    if (
        !fs.existsSync(CACHE_FILE)
    ) {
        throw new Error(
            `Cached Parrot feed not found: ${CACHE_FILE}`
        );
    }

    const raw =
        fs.readFileSync(
            CACHE_FILE,
            'utf8'
        );

    const products =
        JSON.parse(raw);

    if (!Array.isArray(products)) {
        throw new Error(
            'Cached Parrot feed is not a product array.'
        );
    }

    return products;
}


async function downloadParrotFeed() {
    const feedUrl =
        process.env.PARROT_FEED_URL;

    if (!feedUrl) {
        throw new Error(
            'PARROT_FEED_URL is missing from .env'
        );
    }

    console.log('');
    console.log(
        '======================================'
    );
    console.log(
        ' DOWNLOADING PARROT PRODUCT FEED'
    );
    console.log(
        '======================================'
    );
    console.log('');

    try {
        const response =
            await axios.get(
                feedUrl,
                {
                    timeout: 120000,
                    headers: {
                        Accept:
                            'application/json'
                    }
                }
            );

        const products =
            normalizeProducts(
                response.data
            );

        console.log(
            `Products received: ${products.length}`
        );

        saveProducts(products);

        console.log(
            `Saved to: ${CACHE_FILE}`
        );

        return products;

    } catch (error) {

        if (
            error.response &&
            error.response.status === 429
        ) {
            throw new Error(
                'Parrot returned HTTP 429. The feed is temporarily rate-limited. Use the cached feed instead.'
            );
        }

        throw error;
    }
}


module.exports = {
    downloadParrotFeed,
    loadCachedProducts,
    normalizeProducts,
    CACHE_FILE
};