
import { addKeyword, EVENTS } from '@builderbot/bot'
import { sendMessageChatwood, searchUser, recover, createConversationChatwood } from '../services/chatwood.js'
import { reset, start, stop } from '../utils/idle-custom.js'
import { numberClean } from '../utils/utils.js'
const ADMIN_NUMBER = process.env.ADMIN_NUMBER
//good bye
const flowGoodBye = addKeyword(EVENTS.ACTION).addAnswer(["Hasta luego...", "Si desea hablar nuevamente con el bot, escriba hola."])

//talk
const flowTalkAgent = addKeyword(EVENTS.ACTION)
    .addAction(async (ctx, { gotoFlow }) => start(ctx, gotoFlow,))
    .addAnswer([`Desea comunicarse con un agente?`, 'Escriba sí o no.'], { capture: true, delay: 2800 }, async (ctx, { state, gotoFlow, globalState }) => {
        reset(ctx, gotoFlow);
        await sendMessageChatwood([`Desea comunicarse con un agente?`, 'Escriba sí o no.'], 'incoming', globalState.get('c_id')); // Registrar la pregunta primero
        await state.update({ check: ctx.body });
        await sendMessageChatwood(state.get('check'), 'outgoing', globalState.get('c_id'))
        const res = state.get('check').toLowerCase()

        console.log(state.get('check'))

        if (res === 'sí' || res === 'si') {
            console.log('flow talk...')
            return gotoFlow(freeFlow)
        }
        else {
            stop(ctx);
            return gotoFlow(flowGoodBye);
        }
    })

//flujo libre
const freeFlow = addKeyword('si')
    .addAction(async (ctx, { gotoFlow }) => start(ctx, gotoFlow,))
    .addAnswer('Estas conectado con un agente.', { capture: true }, async (ctx, { state, globalState, blacklist }) => {
        await sendMessageChatwood('Estas conectado con un agente.', 'incoming', globalState.get('c_id'))
        const phone = numberClean(ctx.from)
        const check = blacklist.checkIf(phone)
        console.log('free flow checked', check)
        if (check) {
            blacklist.add(phone)
            await sendMessageChatwood(`phone is banned`, 'incoming', globalState.get('c_id'))
            console.log('0000')
        }
        console.log('----', blacklist.checkIf(phone))
        await state.update({ msgs: ctx.body });
        await sendMessageChatwood(state.get('msgs'), 'outgoing', globalState.get('c_id'))
        console.log('Chat en modo libre')

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
        const localPath = await provider.saveFile(ctx, { path: '...' })
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