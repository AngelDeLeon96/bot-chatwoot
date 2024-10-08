
import { createBot, createProvider, createFlow, addKeyword, EVENTS } from '@builderbot/bot'
import { MemoryDB as Database } from '@builderbot/bot'
import { BaileysProvider as Provider } from '@builderbot/provider-baileys'
import ServerHttp from './http/server.js';
import { sendMessageChatwood, recover } from './services/chatwood.js'
import { flujoFinal, reset, start, stop } from './utils/timer.js'
//flows
import { freeFlow, flowMsgFinal, documentFlow2, mediaFlow, voiceNoteFlow } from './flows/agents.js'
import { primera_vez, prima_menu, attach_forms, attach_forms_continuidad } from './flows/prima.js';
const PORT = process.env.PORT_WB ?? 1000
import Queue from 'queue-promise';
import { catch_error, esHorarioLaboral, getMimeWB, saveMediaWB } from './utils/utils.js';
import { showMSG, i18n } from './i18n/i18n.js';
import debounce from './utils/debounce.js';
import logger from './utils/logger.js';
import { crearDetectorPalabrasOfensivas } from './utils/detector-words.js';

const queue = new Queue({
    concurrent: 1,
    interval: 500
});
i18n.init();

const flowtest = addKeyword('testing2552')
    .addAction(async (ctx, { flowDynamic }) => {
        const fecha = new Date();
        return await flowDynamic(`La fecha es: ${fecha.toString()}`);
    })
//clearCache();

//registramos un MSG en una conversacion
const registerMsgConversation = addKeyword(EVENTS.ACTION)
    .addAction(async (ctx, { gotoFlow }) => start(ctx, gotoFlow))
    .addAnswer(showMSG('solicitar_nombre'), { capture: true }, async (ctx, { globalState, state, gotoFlow, fallBack }) => {
        reset(ctx, gotoFlow);
        await state.update({ name: ctx.body });
        let typeMSG = getMimeWB(ctx.message)
        if (typeMSG !== "senderKeyDistributionMessage") {
            return fallBack(showMSG('no_permitida'));
        }
        else {
            sendMessageChatwood(state.get('name'), 'incoming', globalState.get('conversation_id'));
        }
    })
    .addAnswer(showMSG('solicitar_cedula'), { capture: true }, async (ctx, { state, gotoFlow, globalState, fallBack }) => {
        reset(ctx, gotoFlow);
        await state.update({ cedula: ctx.body });
        //console.log(ctx.message)
        let typeMSG = getMimeWB(ctx.message)
        if (typeMSG !== "senderKeyDistributionMessage") {
            return fallBack(showMSG('no_permitida'));
        }
        else {
            sendMessageChatwood(state.get('cedula'), 'incoming', globalState.get('conversation_id'));
        }
    })
    .addAnswer([showMSG('solicitar_consulta'), showMSG('prima'), showMSG('vacaciones'), showMSG('salir')], { capture: true, delay: 500 }, async (ctx, { state, gotoFlow, fallBack }) => {
        reset(ctx, gotoFlow);
        await state.update({ consulta: ctx.body });
        let typeMSG = getMimeWB(ctx.message)
        //console.log(typeMSG);
        await state.update({ status: typeMSG });

        if (typeMSG !== "senderKeyDistributionMessage") {
            return fallBack(showMSG('solicitar_nombre'));
        }
    })
    .addAction(async (ctx, { fallBack, gotoFlow, globalState, state }) => {
        stop(ctx);
        //console.log(state.get('typeMSG'));
        sendMessageChatwood(`${showMSG('selected')} ${state.get('consulta')}`, 'incoming', globalState.get('conversation_id'));
        switch (parseInt(ctx.body)) {
            case 1:
                //console.log('prima menu');
                return gotoFlow(prima_menu);
            case 2:
                //console.log('vacaciones');
                return gotoFlow(freeFlow);
            case 3:
                return gotoFlow(flowMsgFinal);
            default:
                return fallBack(showMSG('opcion_invalida'));
        }
    })


//flujo que recupera los datos del usuario registrado
const userRegistered = addKeyword(EVENTS.ACTION)
    .addAnswer(showMSG('solicitar_datos'), { delay: 500 }, async (_, { gotoFlow, }) => {
        try {
            return gotoFlow(registerMsgConversation);
            // si existe una conversacion abierta, se registran los mensajes
        }
        catch (err) {
            catch_error(err)
        }
    });

//flujo si el usuario no esta registrado como contacto
const userNotRegistered = addKeyword(EVENTS.ACTION)
    .addAction(async (ctx, { flowDynamic, endFlow }) => {
        try {
            //console.log('Unregistered')
            const numero = ctx.from
            var FORMULARIO = process.env.FORM_URL
            var MSG = [
                `${showMSG('llenar_form')}: ${FORMULARIO}.`,
                `${showMSG('agente_comunicara')}: ${numero}.`
            ]
            await flowDynamic(MSG)
            return endFlow()
        }
        catch (err) {
            catch_error(err)
            return endFlow()
        }
    });


//flow principal
const welcomeFlow = addKeyword(EVENTS.WELCOME)
    .addAction(async (ctx, { endFlow, blacklist }) => {
        if (!esHorarioLaboral(ctx.from)) {
            return endFlow(`${showMSG('gracias')}\n${showMSG('fuera_laboral')}`)
        } else {
            if (blacklist.checkIf(ctx.from.replace('+', ''))) {
                //console.log('user blocked')
                return endFlow()
            }
        }
    })
    .addAnswer(showMSG('bienvenida'), async (ctx, { globalState, gotoFlow }) => {
        try {
            const user_data = await recover(ctx.from);
            if (user_data != null) {
                //set las variables con los datos del usuario como su: id y id de conversation
                await globalState.update({ conversation_id: user_data.conversation_id });
                await globalState.update({ contact_id: user_data.user_id });

                if (globalState.get('contact_id') > 0 && globalState.get('conversation_id') > 0) {
                    return gotoFlow(registerMsgConversation);
                } else {
                    logger.warn('not found.', { 'user': ctx.from })
                    //console.log('user or chat not found...');
                }
            }
            else {
                return gotoFlow(userNotRegistered);
            }

        }
        catch (err) {
            catch_error(err);
        }
    })



//flujo principal
const main = async () => {
    const adapterFlow = createFlow([welcomeFlow, userNotRegistered, userRegistered, registerMsgConversation, prima_menu, attach_forms, attach_forms_continuidad, flujoFinal, freeFlow, primera_vez, documentFlow2, mediaFlow, voiceNoteFlow, flowtest]);
    const adapterProvider = createProvider(Provider, {
        experimentalSyncMessage: 'Si desea comunicarse, escriba: hola.',
        experimentalStore: true,
        timeRelease: 10800000, // 3 hours in milliseconds
    });
    const adapterDB = new Database();

    const bot = await createBot({
        flow: adapterFlow,
        provider: adapterProvider,
        database: adapterDB,
    },
        {
            queue: {
                timeout: 20000, //👌
                concurrencyLimit: 50 //👌
            }
        }
    );
    const server = new ServerHttp(adapterProvider, bot);
    server.start();
    bot.httpServer(+PORT);
    //bot desactivado

    adapterProvider.on('message', async (payload) => {
        try {
            //verificamos si el usuario esta con el bot desactivado, es decir el modo libre esta activado
            //console.log(`payload: `, JSON.stringify(payload), '\n')
            let debounceSendMSG = debounce(sendMessageChatwood, 100);
            if (bot.dynamicBlacklist.checkIf(payload.from)) {
                //console.log(JSON.stringify('free mode'))
                queue.enqueue(async () => {
                    let [msg, attachment] = await saveMediaWB(payload);
                    const detector = await crearDetectorPalabrasOfensivas();
                    const result = await detector(msg);
                    const daata = await recover(payload.from);
                    const conversation_id = daata.conversation_id;

                    if (conversation_id > 0) {
                        //console.log('debounce')
                        msg = result.mensajeEtiquetado;
                        debounceSendMSG(msg, 'incoming', conversation_id, attachment);

                        if (result.puntajeTotal >= 2) {
                            logger.warn('msg inapropiado:', { text: 'Posible contenido inapropiado detectado. Revise su mensaje.', user: payload.from });
                            adapterProvider.vendor.sendMessage(payload.key.remoteJid, { text: 'Posible contenido inapropiado detectado. Revise su mensaje.' }, {});
                        }
                    }
                });
            }
        }
        catch (err) {
            catch_error(err);
            console.error('ERROR', err)
        }
    });

    bot.on('send_message', async ({ answer, from }) => {
        try {
            const daata = await recover(from);
            //console.log('2. soy el bot: ', daata)
            if (daata != null) {
                const conversation_id = daata.conversation_id;
                queue.enqueue(async () => {
                    //console.log('msg send to chatwoot...🚀')
                    sendMessageChatwood(answer, 'outgoing', conversation_id);
                    await bot.sendMessage(from, 'jjj', {});
                });
            }
        }
        catch (err) {
            catch_error(err);
            //console.error('ERROR', err)
        }
    });
}
main()
