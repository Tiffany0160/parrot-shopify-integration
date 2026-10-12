'use strict';

/**
 * Parrot Products → Shopify
 *
 * Pricing:
 * 1. Apply the configured markup.
 * 2. Add VAT to the marked-up price.
 * 3. Round UP to the next R10.00.
 *
 * Example:
 * Supplier price: R199.50
 * Markup: 17%
 * VAT: 15%
 * Final Shopify price: R270.00
 */

const MARKUP_PERCENT = Number(
    process.env.MARKUP_PERCENT || 17
);

const VAT_PERCENT = Number(
    process.env.VAT_PERCENT || 15
);

const ROUND_UP_TO = Number(
    process.env.ROUND_UP_TO || 10
);

/**
 * Safely convert a value to a number.
 */
function toNumber(value) {
    if (value === null || value === undefined || value === '') {
        return 0;
    }

    const number = Number(value);

    return Number.isFinite(number) ? number : 0;
}

/**
 * Calculate the final selling price.
 *
 * Formula:
 * Supplier price × (1 + markup / 100)
 *              × (1 + VAT / 100)
 *
 * The result is rounded UP to the next R10.00.
 */
function calculateSellingPrice(supplierPrice) {
    const cost = toNumber(supplierPrice);

    if (cost <= 0) {
        throw new Error(
            `Invalid supplier price: ${supplierPrice}`
        );
    }

    if (
        !Number.isFinite(MARKUP_PERCENT) ||
        MARKUP_PERCENT < 0
    ) {
        throw new Error('MARKUP_PERCENT must be valid and non-negative.');
    }

    if (
        !Number.isFinite(VAT_PERCENT) ||
        VAT_PERCENT < 0
    ) {
        throw new Error('VAT_PERCENT must be valid and non-negative.');
    }

    if (
        !Number.isFinite(ROUND_UP_TO) ||
        ROUND_UP_TO <= 0
    ) {
        throw new Error('ROUND_UP_TO must be greater than zero.');
    }

    const priceAfterMarkup =
        cost * (1 + MARKUP_PERCENT / 100);

    const priceIncludingVat =
        priceAfterMarkup * (1 + VAT_PERCENT / 100);

    // Always round UP to the next R10.00.
    const roundedPrice =
        Math.ceil((priceIncludingVat - 1e-9) / ROUND_UP_TO)
        * ROUND_UP_TO;

    return roundedPrice.toFixed(2);
}

/**
 * Read a product's supplier price.
 */
function getSupplierPrice(product) {
    return toNumber(product.CustomerPrice);
}

/**
 * Read the product category.
 */
function getCategory(product) {
    const category = product.PublishingCategory;

    if (typeof category === 'string') {
        return category;
    }

    if (
        category &&
        typeof category === 'object' &&
        category.CategoryName
    ) {
        return category.CategoryName;
    }

    return 'Parrot Products';
}

/**
 * Read product images.
 */
function getProductImages(product) {
    const source = product.ProductImageLinks;

    if (!source) {
        return [];
    }

    let images = source;

    if (typeof images === 'string') {
        try {
            images = JSON.parse(images);
        } catch {
            images = images
                .split(/[;,]/)
                .map(url => url.trim());
        }
    }

    if (!Array.isArray(images)) {
        images = [images];
    }

    return images
        .map(image => {
            if (typeof image === 'string') {
                return image.trim();
            }

            if (image && typeof image === 'object') {
                return (
                    image.Url ||
                    image.URL ||
                    image.url ||
                    image.Link ||
                    image.link ||
                    ''
                );
            }

            return '';
        })
        .filter(url => /^https?:\/\//i.test(url));
}

/**
 * Convert supplier stock into a valid non-negative integer.
 */
function getStock(product) {
    return Math.max(
        0,
        Math.floor(toNumber(product.TotalWarehouseStock))
    );
}

/**
 * Map a Parrot supplier product.
 */
function mapParrotProduct(product) {
    if (!product || typeof product !== 'object') {
        throw new Error('Invalid Parrot product.');
    }

    const sku = String(product.StockCode || '').trim();

    if (!sku) {
        throw new Error('Product is missing its StockCode SKU.');
    }

    const supplierPrice = getSupplierPrice(product);

    const title = String(
        product.FriendlyTitle ||
        product.Description ||
        product.Title ||
        sku
    ).trim();

    const vendor = String(
        product.Brand || 'PARROT PRODUCTS'
    ).trim();

    const category = getCategory(product);

    const images = getProductImages(product);

    const stock = getStock(product);

    const barcode = String(
        product.ProductBarCode || ''
    ).trim();

    const price = calculateSellingPrice(supplierPrice);

    const tags = [
        'Parrot Products',
        vendor,
        category
    ].filter(Boolean);

    return {
        sku,
        title,
        vendor,
        productType: category,
        category,
        price,
        barcode,
        images,
        stock,
        tags,
        supplierPrice,
        markupPercent: MARKUP_PERCENT,
        vatPercent: VAT_PERCENT
    };
}

module.exports = {
    mapParrotProduct,
    calculateSellingPrice
};