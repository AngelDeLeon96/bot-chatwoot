
import { addKeyword, EVENTS } from '@builderbot/bot'
import { sendMessageChatwood } from '../services/chatwood.js'
import { reactivarBot, reset, start, stop } from '../utils/timer.js'
import { numberClean } from '../utils/utils.js'
import controlBot from '../utils/control-bot.js'

//good bye
const flowGoodBye = addKeyword(EVENTS.ACTION).addAnswer(["Hasta luego...", "Si desea hablar nuevamente con el bot, escriba hola."])


//hablar con un agente
const flowTalkAgent = addKeyword(EVENTS.ACTION)
    .addAction(async (ctx, { gotoFlow }) => start(ctx, gotoFlow))
    .addAnswer([`Desea comunicarse con un agente?`, 'Escriba sí o no.'], { capture: true, delay: 2800 }, async (ctx, { state, gotoFlow, globalState }) => {
        reset(ctx, gotoFlow);
        await sendMessageChatwood([`Desea comunicarse con un agente?`, 'Escriba sí o no.'], 'incoming', globalState.get('c_id'));
        await state.update({ check: ctx.body });
    }).addAction(async (ctx, { state, gotoFlow, globalState, flowDynamic, blacklist }) => {
        await sendMessageChatwood(`El usuario ${ctx.name} quiere contactar con un agente.`, 'outgoing', globalState.get('c_id'))
        const res = state.get('check').toLowerCase()
        if (res === 'sí' || res === 'si') {
            return gotoFlow(freeFlow)

        }
        else {
            return gotoFlow(flowGoodBye);
        }

    })

//flujo libre
const freeFlow = addKeyword(EVENTS.ACTION)
    .addAction(async (ctx, { gotoFlow }) => reactivarBot(ctx, gotoFlow,))
    .addAnswer('Estas conectado con un agente.', { capture: false }, async (ctx, { state, globalState, blacklist, gotoFlow }) => {
        reset(ctx, gotoFlow)
        await sendMessageChatwood('Estas conectado con un agente.', 'incoming', globalState.get('c_id'))
        const check = blacklist.checkIf(ctx.from.replace("+", ""))
        console.log('free flow checked', check)
        if (check) {
            blacklist.add(ctx.from.replace("+", ""))
            await sendMessageChatwood(`phone is banned`, 'incoming', globalState.get('c_id'))
        }
    })

//flujo por si no se marca opcion
const flowDefault = addKeyword(EVENTS.ACTION).addAnswer("We don't have that Option 🤔")

//flow salir
const flowMsgFinal = addKeyword(EVENTS.ACTION)
    .addAction(async (ctx, { flowDynamic, state, globalState, gotoFlow }) => {
        const MSG = `Hemos recibido su información. Un agente se estará comunicando con usted a este número: ${ctx.from}. Tenga un buen día.`;
        await flowDynamic(MSG);
        await sendMessageChatwood(MSG, 'incoming', globalState.get('c_id'));
        return gotoFlow(flowTalkAgent)
    })

//docs
const mediaFlow = addKeyword(EVENTS.MEDIA)
    .addAnswer('Hemos recibido image/video', async (ctx, { provider, gotoFlow }) => {
        const localPath = await provider.saveFile(ctx, { path: '../../public' })
        console.log(localPath)
        return gotoFlow(flowMsgFinal)
    })

//documents
const documentFlow = addKeyword(EVENTS.DOCUMENT)
    .addAnswer("Hemos recibido el documento que no ha adjuntado.", async (ctx, { provider, gotoFlow }) => {
        const localPath = await provider.saveFile(ctx, { path: '...' })
        console.log(localPath)
        return gotoFlow(flowMsgFinal)
    })

export { flowTalkAgent, freeFlow, flowGoodBye, flowDefault, flowMsgFinal, documentFlow, mediaFlow };