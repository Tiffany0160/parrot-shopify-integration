'use strict';

const axios = require('axios');


class ShopifyClient {

    constructor() {

        this.storeDomain =
            process.env.SHOPIFY_STORE_DOMAIN;

        this.apiVersion =
            process.env.SHOPIFY_API_VERSION ||
            '2026-07';

        this.clientId =
            process.env.SHOPIFY_CLIENT_ID;

        this.clientSecret =
            process.env.SHOPIFY_CLIENT_SECRET;

        if (!this.storeDomain) {
            throw new Error(
                'SHOPIFY_STORE_DOMAIN is missing.'
            );
        }

        if (!this.clientId) {
            throw new Error(
                'SHOPIFY_CLIENT_ID is missing.'
            );
        }

        if (!this.clientSecret) {
            throw new Error(
                'SHOPIFY_CLIENT_SECRET is missing.'
            );
        }

        this.graphqlUrl =
            `https://${this.storeDomain}/admin/api/${this.apiVersion}/graphql.json`;

        this.token = null;

        this.tokenExpiresAt = 0;
    }


    async getAccessToken() {

        const now =
            Date.now();

        if (
            this.token &&
            now <
                this.tokenExpiresAt -
                60000
        ) {
            return this.token;
        }

        const tokenUrl =
            `https://${this.storeDomain}/admin/oauth/access_token`;

        try {

            const response =
                await axios.post(
                    tokenUrl,

                    new URLSearchParams({
                        grant_type:
                            'client_credentials',

                        client_id:
                            this.clientId,

                        client_secret:
                            this.clientSecret
                    }).toString(),

                    {
                        headers: {
                            'Content-Type':
                                'application/x-www-form-urlencoded'
                        },

                        timeout: 30000
                    }
                );

            if (
                !response.data ||
                !response.data.access_token
            ) {
                throw new Error(
                    'Shopify did not return an access token.'
                );
            }

            this.token =
                response.data.access_token;

            const expiresIn =
                Number(
                    response.data.expires_in
                ) || 86399;

            this.tokenExpiresAt =
                Date.now() +
                expiresIn * 1000;

            return this.token;

        } catch (error) {

            if (
                error.response &&
                error.response.data
            ) {
                throw new Error(
                    `Shopify token error: ${JSON.stringify(
                        error.response.data
                    )}`
                );
            }

            throw error;
        }
    }


    async graphql(
        query,
        variables = {}
    ) {

        const token =
            await this.getAccessToken();

        try {

            const response =
                await axios.post(

                    this.graphqlUrl,

                    {
                        query,
                        variables
                    },

                    {
                        headers: {
                            'Content-Type':
                                'application/json',

                            'X-Shopify-Access-Token':
                                token
                        },

                        timeout: 120000
                    }
                );

            if (
                response.data &&
                response.data.errors &&
                response.data.errors.length
            ) {
                throw new Error(
                    JSON.stringify(
                        response.data.errors
                    )
                );
            }

            return response.data.data;

        } catch (error) {

            if (
                error.response &&
                error.response.data
            ) {
                throw new Error(
                    `Shopify API error: ${JSON.stringify(
                        error.response.data
                    )}`
                );
            }

            throw error;
        }
    }


    async testConnection() {

        const query = `
            query {
                shop {
                    id
                    name
                    myshopifyDomain
                }
            }
        `;

        const data =
            await this.graphql(
                query
            );

        if (!data.shop) {
            throw new Error(
                'Shopify returned no shop information.'
            );
        }

        return data.shop;
    }


    async getLocations() {

        const query = `
            query {
                locations(first: 100) {
                    nodes {
                        id
                        name
                        isActive
                    }
                }
            }
        `;

        const data =
            await this.graphql(
                query
            );

        return (
            data.locations.nodes || []
        );
    }


    async getPrimaryLocation() {

        const locations =
            await this.getLocations();

        const active =
            locations.filter(
                location =>
                    location.isActive
            );

        if (
            active.length === 0
        ) {
            throw new Error(
                'No active Shopify locations were found.'
            );
        }

        return active[0];
    }
}


module.exports = {
    ShopifyClient
};