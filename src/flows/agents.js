
import { addKeyword, EVENTS } from '@builderbot/bot'
import { sendMessageChatwood } from '../services/chatwood.js'
import { reactivarBot, reset, start, stop } from '../utils/timer.js'

//good bye
const flowGoodBye = addKeyword(EVENTS.ACTION)
    .addAnswer(["Hasta luego...", "Si desea hablar nuevamente con el bot, escriba hola."], async (_, { endFlow, }) => {
        return endFlow('Trones');
    })


//hablar con un agente
const flowTalkAgent = addKeyword(EVENTS.ACTION)
    .addAction(async (ctx, { gotoFlow }) => start(ctx, gotoFlow))
    .addAnswer([`Desea comunicarse con un agente?`, 'Escriba:', '1️⃣ para ✅sí ', '2️⃣ para ⭕️no'], { capture: true }, async (ctx, { state, gotoFlow, globalState }) => {
        reset(ctx, gotoFlow);
        const MSF = `Escriba 1 para ✅sí o 2 para ⭕️no.`
        sendMessageChatwood([`¿Desea comunicarse con un agente?`, MSF], 'incoming', globalState.get('conversation_id'));
        await state.update({ check: ctx.body });
    })
    .addAction(async (ctx, { globalState, state, gotoFlow, endFlow, fallBack }) => {
        stop(ctx)
        const MSF = `Escriba 1 para ✅sí o 2 para ⭕️no.`
        sendMessageChatwood(state.get('check'), 'outgoing', globalState.get('conversation_id'))
        switch (state.get('check')) {
            case '1':
                //stop(ctx) debe detener aqui o no en la documentacion dice que n
                return gotoFlow(freeFlow)
            case '2':
                //stop(ctx)
                sendMessageChatwood('⏰Comunicación terminada con el usuario', 'incoming', globalState.get('conversation_id'))
                //return gotoFlow(flowGoodBye)
                return endFlow("Gracias por comunicarse con nosotros...\nSi desea volverse a comunicar, escriba: hola");
            default:
                return fallBack(MSF)
        }
    })


//flujo libre
const freeFlow = addKeyword(EVENTS.ACTION)
    .addAction(async (ctx, { gotoFlow, endFlow, blacklist }) => reactivarBot(ctx, gotoFlow, endFlow, blacklist))
    .addAnswer('Estas conectado con un agente.', async (ctx, { globalState, blacklist }) => {
        sendMessageChatwood('Estas conectado con un agente.', 'incoming', globalState.get('conversation_id'))
        let number = ctx.from.replace("+", "")
        let check = blacklist.checkIf(number)
        console.log(number, check)
        if (!check) {
            console.log('user blocked', check)
            blacklist.add(number)
            sendMessageChatwood(`Bot desactivado, el usuario puede hablar libremente, durante 30min.`, 'incoming', globalState.get('conversation_id'))
            return
        }
        console.log(number, check)
    })

//flujo por si no se marca opcion
const flowDefault = addKeyword(EVENTS.ACTION)
    .addAnswer("Intenta nuevamente...",)

//flow salir
const flowMsgFinal = addKeyword(EVENTS.ACTION)
    .addAction(async (ctx, { flowDynamic, state, globalState, gotoFlow }) => {
        stop(ctx)
        const MSG = `Hemos recibido su información. Un agente se estará comunicando con usted a este número: ${ctx.from}.`;
        await flowDynamic(MSG);
        await sendMessageChatwood(MSG, 'incoming', globalState.get('conversation_id'));
        return gotoFlow(flowTalkAgent)
    })

//docs
const mediaFlow = addKeyword(EVENTS.MEDIA)
    .addAnswer('Hemos recibido image/video', async (ctx, { provider, gotoFlow }) => {
        const localPath = await provider.saveFile(ctx, { path: '../../public/docs' })
        console.log(localPath)
        return gotoFlow(flowMsgFinal)
    })

//documents
const documentFlow = addKeyword(EVENTS.DOCUMENT)
    .addAnswer("Hemos recibido el documento que no ha adjuntado.", async (ctx, { provider, gotoFlow }) => {
        const localPath = await provider.saveFile(ctx, { path: '../../public/docs' })
        console.log(localPath)
        return gotoFlow(flowMsgFinal)
    })

export { flowTalkAgent, freeFlow, flowGoodBye, flowDefault, flowMsgFinal, documentFlow, mediaFlow };