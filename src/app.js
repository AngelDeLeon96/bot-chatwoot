
import { createBot, createProvider, createFlow, addKeyword, EVENTS } from '@builderbot/bot'
import fs from 'fs/promises';
import { constants } from 'fs';
import path from 'path';

import { MemoryDB as Database } from '@builderbot/bot'
import { BaileysProvider as Provider } from '@builderbot/provider-baileys'
import { downloadMediaMessage } from '@whiskeysockets/baileys';
import ServerHttp from './http/server.js';
import { sendMessageChatwood, recover, createConversationChatwood, clearCache } from './services/chatwood.js'
import { flujoFinal, reset, start, stop, resumeBot, pauseBot } from './utils/timer.js'
import { flowTalkAgent, freeFlow, flowGoodBye, flowDefault, flowMsgFinal, documentFlow, mediaFlow, voiceNoteFlow, flowAddTime } from './flows/agents.js'
const PORT = process.env.PORT_WB ?? 1000
import Queue from 'queue-promise';

import { catch_error, verificarOCrearCarpeta, esHorarioLaboral, getExtensionFromMime, getMimeWB } from './utils/utils.js';
import { showMSG, i18n } from './i18n/i18n.js';
import debounce from './utils/debounce.js';
const queue = new Queue({
    concurrent: 1,
    interval: 500
});
i18n.init();
clearCache();
//registramos un MSG en una conversacion
const registerMsgConversation = addKeyword(EVENTS.ACTION)
    .addAction(async (ctx, { gotoFlow }) => start(ctx, gotoFlow))
    .addAnswer(showMSG('solicitar_nombre'), { capture: true }, async (ctx, { globalState, state, gotoFlow, fallBack }) => {
        reset(ctx, gotoFlow);
        await state.update({ name: ctx.body });
        let typeMSG = getMimeWB(ctx.message)
        console.log(typeMSG, JSON.stringify(ctx.message))
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
        console.log(ctx.message)
        let typeMSG = getMimeWB(ctx.message)
        if (typeMSG !== "senderKeyDistributionMessage") {
            return fallBack(showMSG('no_permitida'));
        }
        else {
            sendMessageChatwood(state.get('cedula'), 'incoming', globalState.get('conversation_id'));
        }
    })
    .addAnswer([showMSG('solicitar_consulta'), showMSG('prima'), showMSG('vacaciones'), showMSG('salir')], { capture: true, delay: 500 }, async (ctx, { state, gotoFlow, globalState, fallBack }) => {
        reset(ctx, gotoFlow);
        await state.update({ consulta: ctx.body });
        console.log(ctx.message)
        let typeMSG = getMimeWB(ctx.message)
        if (typeMSG !== "senderKeyDistributionMessage") {
            return fallBack(showMSG('no_permitida'));
        }
        else {
            switch (ctx.body) {
                case '1':
                    sendMessageChatwood(state.get('consulta'), 'incoming', globalState.get('conversation_id'));
                    console.log('case 1')
                    return;
                case '2':
                    sendMessageChatwood(state.get('consulta'), 'incoming', globalState.get('conversation_id'));
                    console.log('case 2')
                    return;
                case '3':
                    sendMessageChatwood(state.get('consulta'), 'incoming', globalState.get('conversation_id'));
                    return gotoFlow(flowMsgFinal);
                default:
                    return fallBack();
            }
        }



    });

//creamos la conversacion(ya debe ser contacto), si el user no tiene ninguna conversacion abierta.
const createConversation = addKeyword(EVENTS.ACTION)
    .addAction({ delay: 500 }, async (ctx, { gotoFlow, globalState }) => {
        try {
            createConversationChatwood('', 'outgoing', globalState.get('contact_id'))
            return gotoFlow(userRegistered)
        }
        catch (err) {
            console.error(err)
        }
    });

//flujo que recupera los datos del usuario registrado
const userRegistered = addKeyword(EVENTS.ACTION)
    .addAnswer(showMSG('solicitar_datos'), { delay: 500 }, async (ctx, { flowDynamic, gotoFlow, globalState }) => {
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
        console.log('<======>', blacklist.checkIf(ctx.from.replace('+', '')))
        const now = new Date();
        if (!esHorarioLaboral(now)) {
            return endFlow(showMSG('fuera_laboral'))
        } else {
            if (blacklist.checkIf(ctx.from.replace('+', ''))) {
                console.log('user blocked')
                return endFlow()
            }
        }
    })
    .addAnswer(showMSG('bienvenida'), async (ctx, { globalState, gotoFlow, endFlow }) => {
        try {
            const user_data = await recover(ctx.from);
            //set las variables con los datos del usuario como su: id y id de conversation
            await globalState.update({ conversation_id: user_data.conversation_id });
            await globalState.update({ contact_id: user_data.user_id });

            console.log('ejecuta 1ro.')
            //console.log('data user', globalState.get('contact_id'), typeof (globalState.get('conversation_id')));
            /*  puede ser contact id= 1, conversation id= 1 .
                contact id= 0, conversation id= 0
                contact id= 1, conversation id= 0
            */
            if (globalState.get('contact_id') > 0 && globalState.get('conversation_id') > 0) {
                return gotoFlow(registerMsgConversation);
            } else if (globalState.get('contact_id') == 0 && globalState.get('conversation_id') == 0) {
                //console.log('user not found...');
                return gotoFlow(userNotRegistered);
            }
            else if (globalState.get('contact_id') > 0 && globalState.get('conversation_id') == 0) {
                await createConversationChatwood('', 'outgoing', globalState.get('contact_id'));
                const user_data2 = await recover(ctx.from);
                await globalState.update({ conversation_id: user_data2.conversation_id });
                await globalState.update({ contact_id: user_data2.user_id });
                //console.log(globalState.get('contact_id'), globalState.get('conversation_id'));

                return gotoFlow(registerMsgConversation);
            } else {
                return endFlow(showMSG('error_generico'));
            }
        }
        catch (err) {
            catch_error(err);
        }
    })



//flujo principal
const main = async () => {
    const adapterFlow = createFlow([welcomeFlow, userNotRegistered, userRegistered, createConversation, registerMsgConversation, flowDefault, flujoFinal, flowTalkAgent, mediaFlow, documentFlow, freeFlow, flowGoodBye, flowMsgFinal, voiceNoteFlow, flowAddTime]);
    const adapterProvider = createProvider(Provider);
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
                //console.log(JSON.stringify(payload))
                queue.enqueue(async () => {
                    const attachment = [];
                    let caption = "";
                    let msg = "";
                    const mime = payload?.message?.imageMessage?.mimetype ??
                        payload?.message?.videoMessage?.mimetype ??
                        payload?.message?.documentWithCaptionMessage?.message?.documentMessage?.mimetype ??
                        payload?.message?.audioMessage?.mimetype;
                    console.log('mensaje capturado con el provider: ');
                    if (payload?.body.includes('_event_') || mime) {
                        const mimeType = mime.split("/")[0];

                        if (mimeType !== 'audio' && mimeType !== 'video') {
                            //console.log('Procesando archivo no audio/video', JSON.stringify(payload.body));
                            const extension = getExtensionFromMime(mime);

                            if (mimeType === 'image') {
                                caption = payload?.message?.imageMessage?.caption;
                            } else {
                                caption = payload?.message?.documentWithCaptionMessage?.message?.documentMessage?.caption;
                            }
                            try {
                                msg = caption || "Archivo adjunto sin mensaje";
                                let [nombre, extension2] = msg.includes('.')
                                    ? msg.split(/\.(?=[^.]+$)/)
                                    : [msg.replace(/ /g, '_'), null];
                                let filename = nombre.toLocaleLowerCase() || 'file';
                                const buffer = await downloadMediaMessage(payload, "buffer");
                                const fileName = `${filename}_${Date.now()}.${extension}`;
                                const docsDir = `${process.cwd()}/public/docs`;
                                await verificarOCrearCarpeta(docsDir);
                                const pathFile = `${docsDir}/${fileName}`;
                                //console.log(pathFile)
                                await fs.writeFile(pathFile, buffer);
                                attachment.push(pathFile);
                            } catch (error) {
                                console.error('Error al procesar el archivo:', error);
                                msg = "Hubo un error al procesar el archivo adjunto.";
                            }
                        } else {
                            console.log('Archivo de audio o video no permitido');
                            msg = "El usuario intento enviar de audios, notas de voz o videos.";
                        }
                    } else {
                        console.log('msg without attachments')
                        msg = payload?.body;
                    }

                    const daata = await recover(payload.from);
                    const conversation_id = daata.conversation_id;
                    if (conversation_id != 0) {
                        debounceSendMSG(msg, 'incoming', conversation_id, attachment);
                    }
                });
            }
        }
        catch (err) {
            catch_error(err);
            //console.error('ERROR', err)
        }
    });

    bot.on('send_message', async ({ answer, from }) => {
        try {
            const daata = await recover(from);
            const conversation_id = daata.conversation_id;
            queue.enqueue(async () => {
                sendMessageChatwood(answer, 'outgoing', conversation_id);
            });

            //console.log(queue)
        }
        catch (err) {
            catch_error(err);
            //console.error('ERROR', err)
        }
    });
}
main()
