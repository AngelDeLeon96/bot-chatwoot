const locks = new Map();

const acquireLock = async (lockKey, timeout = 5000) => {
    const startTime = Date.now();

    while (locks.has(lockKey)) {
        if (Date.now() - startTime > timeout) {
            throw new Error('Timeout al intentar adquirir el bloqueo');
        }
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    locks.set(lockKey, true);
    return lockKey;
};

const releaseLock = async (lockKey) => {
    locks.delete(lockKey);
};

export { acquireLock, releaseLock };