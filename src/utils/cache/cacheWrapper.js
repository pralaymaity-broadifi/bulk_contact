'use strict';

const redis = require('../redis');

const cacheWrapper = async (key, callback, ttl = 3600) => {
    try {
        const cached = await redis.get(key);

        if (cached) {
            console.log('⚡ CACHE HIT:', key);
            return cached;
        }

        console.log('❌ CACHE MISS:', key);

        const freshData = await callback();

        await redis.set(key, freshData, ttl);

        return freshData;

    } catch (err) {
        console.log('Redis Wrapper Error:', err.message);

        // fallback → return DB data
        return await callback();
    }
};

module.exports = cacheWrapper;
