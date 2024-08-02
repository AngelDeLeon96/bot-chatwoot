// state.js
const controlBot = (phone, bot, remainingTime, timers, TIMER_BOT) => {
    if (!bot.dynamicBlacklist.checkIf(phone)) {
        // Si el bot no está desactivado para este usuario
        const elapsedTime = TIMER_BOT - (Date.now() - timers[phone]);
        if (timers[phone]) {
            remainingTime[phone] = elapsedTime;
            // Borra el temporizador actual
            clearTimeout(timers[phone]);
            timers[phone] = null;
        }
        console.log(`Tiempo restante para ${phone}: ${remainingTime[phone]} ms`);
    }
};

export default controlBot;