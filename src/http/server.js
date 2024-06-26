import express from 'express';
import routes from '../routes/chatwood-hook.js';

class ServerHttp {
    app;
    port = 3030
    providerWS;

    constructor(_providerWS) {
        this.providerWS = _providerWS;
    }

    buildApp = () => {
        this.app = express()
            .use(express.json())
            .use((req, _, next) => {
                req.providerWS = this.providerWS;
                next();
            })
            .use(routes)
            .listen(this.port, () => console.log(`🚀 Saliendo por el puerto ${this.port}`));
    };

    /** iniciamos el app */
    start() {
        this.buildApp();
    }
}

export default ServerHttp;
