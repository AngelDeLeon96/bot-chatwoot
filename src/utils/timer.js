import { addKeyword, EVENTS } from '@builderbot/bot'
import controlBot from './control-bot.js';


// Objeto para almacenar los temporizadores para cada usuario
const timers = {};
const TIMER = process.env.TIMER ?? 1000
const TIMER_BOT = process.env.TIMER_BOT
//flujo final por inactividad
const flujoFinal = addKeyword(EVENTS.ACTION).addAnswer(['Gracias por contactarnos. Hemos procedido con la cancelación debido a inactividad.', 'Si desea iniciar el chatbot, por favor escribir: Hola o iniciar.'])

//reactiva el bot despues de X tiempo
const reactivarBot = (ctx, gotoFlow, blacklist, ms = TIMER_BOT) => {
    timers[ctx.from] = setTimeout(() => {
        console.log(`User timeout: ${ctx.from}`);
        blacklist.remove(ctx.from.replace("+", ""))
        return gotoFlow(flujoFinal);
    }, ms);
}

// Flujo para manejar la inactividad
const idleFlow = addKeyword(EVENTS.ACTION).addAction(
    async (_, { endFlow }) => {
        return endFlow("Response time has expired");
    }
);

// Función para iniciar el temporizador de inactividad para un usuario
const start = (ctx, gotoFlow, ms = TIMER) => {
    timers[ctx.from] = setTimeout(() => {
        console.log(`User timeout: ${ctx.from}`);
        return gotoFlow(flujoFinal);
    }, ms);
}

// Función para reiniciar el temporizador de inactividad para un usuario
const reset = (ctx, gotoFlow, ms = TIMER) => {
    stop(ctx);
    if (timers[ctx.from]) {
        console.log(`reset countdown for the user: ${ctx.from}`);
        clearTimeout(timers[ctx.from]);
    }
    start(ctx, gotoFlow, ms);
}

// Función para detener el temporizador de inactividad para un usuario
const stop = (ctx) => {
    if (timers[ctx.from]) {
        clearTimeout(timers[ctx.from]);
    }
}

export {
    start,
    reset,
    stop,
    reactivarBot,
    flujoFinal,
}
