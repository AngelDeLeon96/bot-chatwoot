
import { addKeyword, EVENTS } from '@builderbot/bot';
import { reset, start, startBot, stop } from '../utils/timer.js';
import { showMSG } from '../i18n/i18n.js';
import Queue from 'queue-promise';
const queue = new Queue({
    concurrent: 1,
    interval: 500
});

//good bye
const flowGoodBye = addKeyword(EVENTS.ACTION)
    .addAnswer([showMSG('gracias'), showMSG('reiniciar_bot')], async (_, { endFlow, }) => {
        return endFlow('Trones');
    })
//
const flowAddTime = addKeyword(EVENTS.ACTION)
    .addAction(async (ctx, { gotoFlow }) => start(ctx, gotoFlow))
    .addAnswer([showMSG('aumentar_tiempo'), showMSG('opciones')], { capture: true }, async (ctx, { state, gotoFlow, globalState }) => {
        reset(ctx, gotoFlow);
        //sendMessageChatwood([showMSG('aumentar_tiempo'), showMSG('opciones')], 'outgoing', globalState.get('conversation_id'));
        await state.update({ response: ctx.body });
        console.log(state.get('response'))
    })
    .addAction(async (ctx, { state, gotoFlow, endFlow, fallBack, globalState }) => {
        stop(ctx);
        //sendMessageChatwood(state.get('response'), 'incoming', globalState.get('conversation_id'));
        //switch
        switch (state.get('response')) {
            case '1':
                console.log('si')
                return gotoFlow(freeFlow);
            case '2':
                console.log('no')
                return endFlow(showMSG('bot_reactivated'));
            default:
                return fallBack();
        }
    })

//hablar con un agente
const flowTalkAgent = addKeyword(EVENTS.ACTION)
    .addAction(async (ctx, { gotoFlow }) => start(ctx, gotoFlow))
    .addAnswer([showMSG('desea_comunicarse'), 'Escriba:', showMSG('opcion_1'), showMSG('opcion_2')], { capture: true }, async (ctx, { state, gotoFlow, globalState }) => {
        reset(ctx, gotoFlow);
        //sendMessageChatwood([showMSG("desea_comunicarse"), showMSG('opciones')], 'outgoing', globalState.get('conversation_id'));
        await state.update({ check: ctx.body });
    })
    .addAction(async (ctx, { globalState, state, gotoFlow, endFlow, fallBack }) => {
        stop(ctx)
        const MSF = showMSG('opciones');
        //sendMessageChatwood(`${showMSG('usuario_respondio')} ${state.get('check')}`, 'incoming', globalState.get('conversation_id'));
        switch (state.get('check')) {
            case '1':
                //stop(ctx) debe detener aqui o no en la documentacion dice que no, vamos al flujo libre
                return gotoFlow(freeFlow);
            case '2':
                //stop(ctx)

                return endFlow(`${showMSG('gracias')}\n${showMSG('reiniciar_bot')}`);
            default:
                return fallBack(MSF);
        }
    })


//flujo libre
const freeFlow = addKeyword(EVENTS.ACTION)
    .addAction(async (ctx, { gotoFlow, endFlow, blacklist }) => startBot(ctx, gotoFlow, endFlow, blacklist))
    .addAnswer(`${showMSG('connected')} ${process.env.TIMER_BOT / 60000} minutos.`, async (ctx, { globalState, blacklist }) => {
        //sendMessageChatwood(showMSG('connected'), 'outgoing', globalState.get('conversation_id'))
        let number = ctx.from.replace("+", "")
        let check = blacklist.checkIf(number)
        console.log(number, check)
        if (!check) {
            console.log(`bot desactivado para: ${number} por ${(process.env.TIMER_BOT / 60000)}min.`)
            blacklist.add(number)
            //sendMessageChatwood(showMSG('bot_deactivated'), 'outgoing', globalState.get('conversation_id'))
            return
        }
        //console.log(number, check)
    })

//flujo por si no se marca opcion
const flowDefault = addKeyword(EVENTS.ACTION)
    .addAnswer("Intenta nuevamente...",)

//flow salir
const flowMsgFinal = addKeyword(EVENTS.ACTION)
    .addAnswer(`${showMSG('gracias')}\n${showMSG('agente_comunicara')}`)
    .addAction(async (ctx, { endFlow }) => {
        stop(ctx)
        //sendMessageChatwood(MSG, 'outgoing', globalState.get('conversation_id'));
        return endFlow()
    })

//docs
const mediaFlow = addKeyword(EVENTS.MEDIA)
    .addAnswer(`media capturada`)
    .addAction(async (ctx, { flowDynamic, provider }) => {
        console.log('2. media flow', ctx);
    })

//documents
const documentFlow2 = addKeyword(EVENTS.DOCUMENT)
    .addAnswer("Wow! I'm sorry I can't read this document right now")
    .addAction(async (ctx, { flowDynamic, provider }) => {
        console.log('2. doc flow', ctx);
    })

//voice notes
const voiceNoteFlow = addKeyword(EVENTS.VOICE_NOTE)
    .addAnswer(`${showMSG('gracias')} ${showMSG('no_permitida_voz')} ${showMSG('solicitud_agente')} ${showMSG('reiniciar_bot')}`, async (ctx, { endFlow }) => {
        return endFlow()
    })

export { flowAddTime, flowTalkAgent, freeFlow, flowGoodBye, flowDefault, flowMsgFinal, documentFlow2, mediaFlow, voiceNoteFlow };