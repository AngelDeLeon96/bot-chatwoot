
const debounce = (func, ms) => {
    let timeout = 0;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), ms);
    }
}

export default debounce;

