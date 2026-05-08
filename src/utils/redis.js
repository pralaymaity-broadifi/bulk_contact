'use strict';
require('dotenv').config();
const { Redis } = require('ioredis');

// Raw config for BullMQ
const redisConnectionOptions = {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
    password: process.env.REDIS_PASSWORD,

    // avoid timeout errors in BullMQ
    maxRetriesPerRequest: null
};

class RedisManager {
    constructor() {
        this.client = new Redis(redisConnectionOptions);

        // Runs when Redis connects successfully
        this.client.on('connect', () => {
            console.log('✅ Redis Connected');
        });

        // Runs on Redis connection errors
        this.client.on('error', (err) => {
            console.error('❌ Redis Error:', err.message);
        });
    }

    // Fetch data from Redis
    async get(key) {
        try {
            const data = await this.client.get(key);
            return data ? JSON.parse(data) : null;
        } catch (err) {
            console.error('Redis GET Error:', err.message);
            return null;
        }
    }

    // Store data in Redis with optional TTL (in seconds)
    async set(key, value, ttl = 3600) {
        try {
            await this.client.set(key, JSON.stringify(value));
            await this.client.expire(key, Number(ttl));

        } catch (err) {
            console.error('Redis SET Error:', err.message);
        }
    }

    // Delete a specific key from Redis
    async delete(key) {
        try {
            await this.client.del(key);
        } catch (err) {
            console.error('Redis DELETE Error:', err.message);
        }
    }

    // Delete multiple keys matching a pattern (e.g., "contact:list:*")
    async deleteByPattern(pattern) {
        try {
            const keys = await this.client.keys(pattern);

            if (keys.length > 0) {
                await this.client.del(keys);
            }
        } catch (err) {
            console.error('Redis Pattern Delete Error:', err.message);
        }
    }

    async getOrSet(key, callback, ttl = 3600) {
        try {
            const cached = await this.get(key);

            if (cached) {
                console.log('⚡ CACHE HIT:', key);
                return cached;
            }

            console.log('❌ CACHE MISS:', key);

            const freshData = await callback();
            await this.set(key, freshData, ttl);

            return freshData;
        } catch (err) {
            console.error('Redis getOrSet Error:', err.message);
            return null;
        }
    }
}

const redisManager = new RedisManager();

module.exports = redisManager;
module.exports.redisConnectionOptions = redisConnectionOptions;
