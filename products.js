'use strict';

/*
 * PARROT PRODUCTS → SHOPIFY
 *
 * This file:
 * 1. Finds Shopify products by SKU
 * 2. Creates missing products
 * 3. Updates existing products
 * 4. Sends product images
 * 5. Synchronizes inventory
 *
 * IMPORTANT:
 * Shopify 2026-07 requires changeFromQuantity
 * in InventoryQuantityInput.
 */


/*
 * --------------------------------------------------
 * BUILD SHOPIFY PRODUCT INPUT
 * --------------------------------------------------
 */
function buildProductInput(
    product,
    existing = null
) {
    const files = [];

    /*
     * Add product images.
     *
     * Do NOT specify filename.
     * Shopify uses the filename from originalSource.
     */
    if (
        Array.isArray(product.images)
    ) {
        for (
            const imageUrl of product.images
        ) {
            if (!imageUrl) {
                continue;
            }

            files.push({
                originalSource: imageUrl,

                alt: product.title,

                contentType: 'IMAGE'
            });
        }
    }

    const tags =
        Array.isArray(product.tags)
            ? product.tags
            : [];

    /*
     * Default Shopify variant.
     */
    const variant = {
        optionValues: [
            {
                optionName: 'Title',

                name: 'Default Title'
            }
        ],

        sku:
            product.sku,

        barcode:
            product.barcode || null,

        price:
            product.price
    };

    /*
     * Existing product:
     * update the existing variant.
     *
     * This prevents duplicate variants/products.
     */
    if (
        existing &&
        existing.variantId
    ) {
        variant.id =
            existing.variantId;
    }

    return {
        title:
            product.title,

        descriptionHtml:
            product.description || '',

        vendor:
            product.vendor ||
            'PARROT PRODUCTS',

        productType:
            product.productType ||
            'Parrot Products',

        tags,

        status:
            process.env.CREATE_AS_DRAFT === 'true'
                ? 'DRAFT'
                : 'ACTIVE',

        productOptions: [
            {
                name: 'Title',

                values: [
                    {
                        name: 'Default Title'
                    }
                ]
            }
        ],

        variants: [
            variant
        ],

        files
    };
}


/*
 * --------------------------------------------------
 * FIND PRODUCT BY SKU
 * --------------------------------------------------
 *
 * This is the duplicate protection.
 *
 * Existing SKU:
 *     UPDATE
 *
 * Missing SKU:
 *     CREATE
 */
async function findProductBySku(
    shopify,
    sku
) {
    const query = `
        query FindProductBySku(
            $query: String!
        ) {
            productVariants(
                first: 10
                query: $query
            ) {
                nodes {
                    id
                    sku

                    product {
                        id
                        title
                    }

                    inventoryItem {
                        id
                    }
                }
            }
        }
    `;

    const data =
        await shopify.graphql(
            query,
            {
                query:
                    `sku:${sku}`
            }
        );

    const nodes =
        data.productVariants &&
        data.productVariants.nodes
            ? data.productVariants.nodes
            : [];

    /*
     * Exact SKU match.
     */
    const match =
        nodes.find(
            variant =>
                String(
                    variant.sku || ''
                ).trim() ===
                String(
                    sku || ''
                ).trim()
        );

    if (!match) {
        return null;
    }

    return {
        productId:
            match.product.id,

        variantId:
            match.id,

        inventoryItemId:
            match.inventoryItem
                ? match.inventoryItem.id
                : null,

        sku:
            match.sku
    };
}


/*
 * --------------------------------------------------
 * CREATE OR UPDATE PRODUCT
 * --------------------------------------------------
 */
async function createOrUpdateProduct(
    shopify,
    product,
    existing = null
) {
    const input =
        buildProductInput(
            product,
            existing
        );

    const mutation = `
        mutation ProductSet(
            $input: ProductSetInput!
        ) {
            productSet(
                input: $input
                synchronous: true
            ) {

                product {
                    id
                    title
                    vendor
                    productType
                    status

                    variants(
                        first: 10
                    ) {
                        nodes {
                            id
                            sku
                            barcode
                            price

                            inventoryItem {
                                id
                            }
                        }
                    }
                }

                userErrors {
                    field
                    message
                    code
                }
            }
        }
    `;

    /*
     * Existing product:
     * include its Product ID.
     *
     * New product:
     * no ID = Shopify creates it.
     */
    const variables = {
        input:
            existing
                ? {
                    ...input,

                    id:
                        existing.productId
                }
                : input
    };

    const data =
        await shopify.graphql(
            mutation,
            variables
        );

    const result =
        data.productSet;

    /*
     * Shopify product errors.
     */
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

    if (!result.product) {
        throw new Error(
            'Shopify did not return the product.'
        );
    }

    const variants =
        result.product.variants &&
        result.product.variants.nodes
            ? result.product.variants.nodes
            : [];

    /*
     * Find the exact SKU.
     */
    let variant =
        variants.find(
            item =>
                String(
                    item.sku || ''
                ).trim() ===
                String(
                    product.sku || ''
                ).trim()
        );

    /*
     * Fallback to first variant.
     */
    if (!variant) {
        variant =
            variants[0];
    }

    if (!variant) {
        throw new Error(
            'Shopify did not return a product variant.'
        );
    }

    return {
        action:
            existing
                ? 'UPDATED'
                : 'CREATED',

        productId:
            result.product.id,

        variantId:
            variant.id,

        inventoryItemId:
            variant.inventoryItem
                ? variant.inventoryItem.id
                : null,

        sku:
            variant.sku ||
            product.sku,

        title:
            result.product.title,

        price:
            variant.price ||
            product.price,

        barcode:
            variant.barcode ||
            product.barcode
    };
}


/*
 * --------------------------------------------------
 * GET CURRENT SHOPIFY INVENTORY
 * --------------------------------------------------
 */
async function getInventoryQuantity(
    shopify,
    inventoryItemId,
    locationId
) {
    const query = `
        query CurrentInventory(
            $inventoryItemId: ID!
        ) {

            inventoryItem(
                id: $inventoryItemId
            ) {

                id

                inventoryLevels(
                    first: 100
                ) {

                    nodes {

                        location {
                            id
                        }

                        quantities(
                            names: ["available"]
                        ) {
                            name
                            quantity
                        }
                    }
                }
            }
        }
    `;

    const data =
        await shopify.graphql(
            query,
            {
                inventoryItemId
            }
        );

    if (
        !data.inventoryItem
    ) {
        throw new Error(
            `Shopify inventory item was not found: ${inventoryItemId}`
        );
    }

    const levels =
        data.inventoryItem.inventoryLevels &&
        data.inventoryItem.inventoryLevels.nodes
            ? data.inventoryItem.inventoryLevels.nodes
            : [];

    /*
     * Find the requested Shopify location.
     */
    const level =
        levels.find(
            item =>
                item.location &&
                item.location.id ===
                locationId
        );

    if (!level) {
        return null;
    }

    const quantities =
        level.quantities || [];

    const available =
        quantities.find(
            item =>
                item.name ===
                'available'
        );

    if (!available) {
        return null;
    }

    return Number(
        available.quantity
    ) || 0;
}


/*
 * --------------------------------------------------
 * SET INVENTORY
 * --------------------------------------------------
 *
 * Shopify 2026-07:
 *
 * quantity
 * changeFromQuantity
 *
 * changeFromQuantity MUST be included.
 *
 * Example:
 *
 * Shopify = 0
 * Parrot  = 4779
 *
 * changeFromQuantity = 0
 * quantity             = 4779
 */
async function setInventory(
    shopify,
    inventoryItemId,
    locationId,
    newQuantity
) {
    const quantity =
        Number(newQuantity);

    if (
        !Number.isFinite(quantity)
    ) {
        throw new Error(
            `Invalid inventory quantity: ${newQuantity}`
        );
    }

    /*
     * Shopify inventory must be a whole number.
     */
    const finalQuantity =
        Math.max(
            0,
            Math.floor(quantity)
        );

    /*
     * Get the current Shopify quantity.
     */
    const currentQuantity =
        await getInventoryQuantity(
            shopify,
            inventoryItemId,
            locationId
        );

    console.log(
        `Shopify current stock: ${
            currentQuantity === null
                ? 'NOT STOCKED'
                : currentQuantity
        }`
    );

    console.log(
        `Parrot stock: ${finalQuantity}`
    );

    /*
     * Already correct.
     */
    if (
        currentQuantity !== null &&
        currentQuantity ===
            finalQuantity
    ) {
        console.log(
            'Shopify inventory is already correct.'
        );

        return {
            changed: false,

            quantity:
                currentQuantity
        };
    }

    /*
     * IMPORTANT:
     *
     * changeFromQuantity must be explicitly
     * included in the GraphQL variables.
     *
     * If the current quantity is known,
     * use it.
     *
     * If Shopify has no inventory level,
     * explicitly send null to skip the
     * compare-and-swap check.
     */
    const changeFromQuantity =
        currentQuantity === null
            ? null
            : currentQuantity;

    console.log(
        `Shopify changeFromQuantity: ${
            changeFromQuantity === null
                ? 'null'
                : changeFromQuantity
        }`
    );

    /*
     * Shopify 2026-07 requires an idempotency key.
     */
    const mutation = `
        mutation InventorySet(
            $input: InventorySetQuantitiesInput!
            $idempotencyKey: String!
        ) {

            inventorySetQuantities(
                input: $input
            ) @idempotent(
                key: $idempotencyKey
            ) {

                inventoryAdjustmentGroup {
                    createdAt
                    reason
                    referenceDocumentUri

                    changes {
                        name
                        delta
                        quantityAfterChange
                    }
                }

                userErrors {
                    field
                    message
                    code
                }
            }
        }
    `;

    /*
     * IMPORTANT:
     *
     * changeFromQuantity is explicitly present.
     *
     * We do NOT use:
     *
     * compareQuantity
     *
     * ignoreCompareQuantity
     */
    const variables = {
        input: {
            name:
                'available',

            reason:
                'correction',

            quantities: [
                {
                    inventoryItemId,

                    locationId,

                    quantity:
                        finalQuantity,

                    changeFromQuantity:
                        changeFromQuantity
                }
            ]
        },

        idempotencyKey:
            `parrot-${inventoryItemId}-${locationId}-${finalQuantity}`
    };

    const data =
        await shopify.graphql(
            mutation,
            variables
        );

    const result =
        data.inventorySetQuantities;

    /*
     * Shopify inventory errors.
     */
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

    console.log(
        `Shopify inventory successfully set to ${finalQuantity}.`
    );

    return {
        changed:
            true,

        quantity:
            finalQuantity
    };
}


/*
 * --------------------------------------------------
 * FULL PRODUCT SYNC
 * --------------------------------------------------
 */
async function syncProduct(
    shopify,
    product,
    locationId
) {
    /*
     * FIRST:
     * Search Shopify by SKU.
     *
     * This prevents duplicate products.
     */
    const existing =
        await findProductBySku(
            shopify,
            product.sku
        );

    if (existing) {
        console.log(
            `Existing Shopify product found for SKU ${product.sku}`
        );
    } else {
        console.log(
            `No existing Shopify product found for SKU ${product.sku}`
        );
    }

    /*
     * CREATE or UPDATE.
     */
    const result =
        await createOrUpdateProduct(
            shopify,
            product,
            existing
        );

    console.log(
        `Product ${result.action.toLowerCase()} successfully.`
    );

    /*
     * Inventory requires an inventory item ID.
     */
    if (
        !result.inventoryItemId
    ) {
        throw new Error(
            'Shopify did not return an inventory item ID.'
        );
    }

    /*
     * Synchronize Parrot stock with Shopify.
     */
    await setInventory(
        shopify,
        result.inventoryItemId,
        locationId,
        product.inventoryQuantity
    );

    return {
        ...result,

        inventoryQuantity:
            product.inventoryQuantity,

        barcode:
            product.barcode,

        price:
            product.price
    };
}


/*
 * --------------------------------------------------
 * EXPORTS
 * --------------------------------------------------
 */
module.exports = {
    buildProductInput,
    findProductBySku,
    createOrUpdateProduct,
    getInventoryQuantity,
    setInventory,
    syncProduct
};