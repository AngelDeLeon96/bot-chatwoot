import { addKeyword } from '@builderbot/bot'
const ADMIN_NUMBER = process.env.ADMIN_NUMBER

const catch_error = (error) => {
    if (error.response) {
        // El servidor respondió con un código de estado fuera del rango 2xx
        if (error.response.status === 404) {
            console.log('Recurso no encontrado (Error 404).');
        } else {
            console.log(`Error en la respuesta del servidor: ${error.response.status}`);
        }
    } else if (error.request) {
        // La solicitud fue hecha pero no se recibió respuesta
        console.log('No se recibió respuesta del servidor.');
    } else {
        // Algo pasó al configurar la solicitud que lanzó un error
        console.log('Error en la configuración de la solicitud:', error.message);
    }

}
const numberClean = (raw) => {
    //Mute +3400000 
    const number = raw.toLowerCase().replace('mute', '').replace(/\s/g, '').replace('+', '')
    // 3400000
    return number
}
const blackListFlow = addKeyword('mute')
    .addAction(async (ctx, { blacklist, flowDynamic }) => {
        if (ctx.from === ADMIN_NUMBER) {
            const toMute = numberClean(ctx.body) //Mute +34000000 message incoming
            const check = blacklist.checkIf(toMute)
            if (!check) {
                blacklist.add(toMute)
                await flowDynamic(`❌ ${toMute} muted`)
                return
            }
            blacklist.remove(toMute)
            await flowDynamic(`🆗 ${toMute} unmuted`)
            return
        }
    })


export { catch_error, numberClean, blackListFlow };