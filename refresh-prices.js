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
    findProductBySku
} = require('./shopify/products');


const LOGS_DIR =
    path.join(
        __dirname,
        '..',
        'logs'
    );

const REPORT_FILE =
    path.join(
        LOGS_DIR,
        'parrot-price-refresh-report.json'
    );

const DELAY_MS = 300;


/*
 * --------------------------------------------------
 * CREATE LOG DIRECTORY
 * --------------------------------------------------
 */
function ensureDirectories() {
    fs.mkdirSync(
        LOGS_DIR,
        {
            recursive: true
        }
    );
}


/*
 * --------------------------------------------------
 * WAIT BETWEEN REQUESTS
 * --------------------------------------------------
 */
function sleep(milliseconds) {
    return new Promise(
        resolve =>
            setTimeout(
                resolve,
                milliseconds
            )
    );
}


/*
 * --------------------------------------------------
 * UPDATE AN EXISTING PRODUCT'S PRICE
 * --------------------------------------------------
 *
 * This function updates the existing variant.
 * It does not create a new product.
 */
async function updateVariantPrice(
    shopify,
    variantId,
    newPrice
) {
    const mutation = `
        mutation UpdateVariantPrice(
            $productId: ID!
            $variants: [ProductVariantsBulkInput!]!
        ) {
            productVariantsBulkUpdate(
                productId: $productId
                variants: $variants
            ) {
                productVariants {
                    id
                    sku
                    price
                }

                userErrors {
                    field
                    message
                }
            }
        }
    `;

    /*
     * Get the product ID from the variant.
     */
    const query = `
        query GetVariantProduct(
            $id: ID!
        ) {
            productVariant(
                id: $id
            ) {
                id

                product {
                    id
                }
            }
        }
    `;

    const variantData =
        await shopify.graphql(
            query,
            {
                id: variantId
            }
        );

    if (
        !variantData.productVariant ||
        !variantData.productVariant.product
    ) {
        throw new Error(
            `Could not find Shopify product for variant ${variantId}.`
        );
    }

    const productId =
        variantData.productVariant.product.id;

    const data =
        await shopify.graphql(
            mutation,
            {
                productId,

                variants: [
                    {
                        id: variantId,

                        price:
                            String(newPrice)
                    }
                ]
            }
        );

    const result =
        data.productVariantsBulkUpdate;

    if (
        result.userErrors &&
        result.userErrors.length > 0
    ) {
        throw new Error(
            result.userErrors
                .map(
                    error =>
                        `${error.field || ''}: ${error.message}`
                )
                .join('; ')
        );
    }

    if (
        !result.productVariants ||
        result.productVariants.length === 0
    ) {
        throw new Error(
            'Shopify did not return the updated variant.'
        );
    }

    return result.productVariants[0];
}


/*
 * --------------------------------------------------
 * MAIN PRICE REFRESH
 * --------------------------------------------------
 */
async function main() {
    ensureDirectories();

    const markupPercent =
        Number(
            process.env.MARKUP_PERCENT
        );

    if (
        !Number.isFinite(markupPercent) ||
        markupPercent < 0
    ) {
        throw new Error(
            'Set a valid MARKUP_PERCENT in .env.'
        );
    }

    console.log('');
    console.log(
        '======================================'
    );
    console.log(
        ' PARROT → SHOPIFY PRICE REFRESH'
    );
    console.log(
        '======================================'
    );
    console.log('');

    console.log(
        `Markup: ${markupPercent}%`
    );

    console.log(
        'Loading cached Parrot feed...'
    );

    const sourceProducts =
        loadCachedProducts();

    console.log(
        `Parrot products: ${sourceProducts.length}`
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

    const report = {
        startedAt:
            new Date().toISOString(),

        markupPercent,

        total:
            sourceProducts.length,

        updated: 0,

        unchanged: 0,

        missing: 0,

        failed: 0,

        results: []
    };

    for (
        let index = 0;
        index < sourceProducts.length;
        index++
    ) {
        const sourceProduct =
            sourceProducts[index];

        let product;

        try {
            product =
                mapParrotProduct(
                    sourceProduct
                );
        } catch (error) {
            report.failed++;

            report.results.push({
                sku:
                    sourceProduct.StockCode || '',

                status:
                    'MAPPING_FAILED',

                message:
                    error.message
            });

            console.error(
                `[${index + 1}/${sourceProducts.length}] MAPPING FAILED: ${error.message}`
            );

            continue;
        }

        console.log('');
        console.log(
            '----------------------------------------------'
        );

        console.log(
            `[${index + 1}/${sourceProducts.length}] ${product.sku}`
        );

        console.log(
            product.title
        );

        console.log(
            `New price: R${product.price}`
        );

        try {
            const existing =
                await findProductBySku(
                    shopify,
                    product.sku
                );

            if (!existing) {
                report.missing++;

                report.results.push({
                    sku:
                        product.sku,

                    title:
                        product.title,

                    newPrice:
                        product.price,

                    status:
                        'NOT_FOUND_IN_SHOPIFY'
                });

                console.log(
                    'NOT FOUND IN SHOPIFY - SKIPPING'
                );

                continue;
            }

            if (!existing.variantId) {
                throw new Error(
                    'Existing Shopify variant ID is missing.'
                );
            }

            const updatedVariant =
                await updateVariantPrice(
                    shopify,
                    existing.variantId,
                    product.price
                );

            report.updated++;

            report.results.push({
                sku:
                    product.sku,

                title:
                    product.title,

                newPrice:
                    product.price,

                shopifyVariantId:
                    updatedVariant.id,

                status:
                    'PRICE_UPDATED'
            });

            console.log(
                `PRICE UPDATED: R${updatedVariant.price}`
            );

        } catch (error) {
            report.failed++;

            report.results.push({
                sku:
                    product.sku,

                title:
                    product.title,

                newPrice:
                    product.price,

                status:
                    'FAILED',

                message:
                    error.message
            });

            console.error(
                `PRICE UPDATE FAILED: ${error.message}`
            );
        }

        /*
         * Save progress after every product so
         * the report is not lost if interrupted.
         */
        report.lastUpdatedAt =
            new Date().toISOString();

        fs.writeFileSync(
            REPORT_FILE,
            JSON.stringify(
                report,
                null,
                2
            ),
            'utf8'
        );

        await sleep(DELAY_MS);
    }

    report.finishedAt =
        new Date().toISOString();

    fs.writeFileSync(
        REPORT_FILE,
        JSON.stringify(
            report,
            null,
            2
        ),
        'utf8'
    );

    console.log('');
    console.log(
        '======================================'
    );
    console.log(
        ' PRICE REFRESH COMPLETE'
    );
    console.log(
        '======================================'
    );
    console.log('');

    console.log(
        `Markup: ${report.markupPercent}%`
    );

    console.log(
        `Source products: ${report.total}`
    );

    console.log(
        `Prices updated: ${report.updated}`
    );

    console.log(
        `Not found in Shopify: ${report.missing}`
    );

    console.log(
        `Failed: ${report.failed}`
    );

    console.log('');

    console.log(
        `Report saved to: ${REPORT_FILE}`
    );

    console.log('');
}


main().catch(error => {
    console.error('');
    console.error(
        '======================================'
    );
    console.error(
        ' PRICE REFRESH FAILED'
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