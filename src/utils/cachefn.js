import { LRUCache } from "lru-cache";

// Configuración de la caché
const cache = new LRUCache({
    max: 100, // Número máximo de elementos en la caché
    ttl: 1000 * 60 * 10, // Tiempo de vida en milisegundos (en este caso 5 minutos)
    updateAgeOnGet: true, // Actualiza el TTL al acceder al elemento
});

// Función para obtener datos con caché
const getData = (key) => {
    let data = cache.get(key);

    return data;
}

const setCache = (key, value) => {
    cache.set(key, value)

}

const clearCache = () => {
    cache.clear();
    //console.log('Caché limpiado');
};

export { getData, setCache, clearCache }