import express from 'express';
import routes from '../routes/chatwood-hook.js';

class ServerHttp {
    app;
    port = process.env.PORT_BOT ?? 3030;
    providerWS;

    constructor(_providerWS, _bot) {
        this.providerWS = _providerWS;
        this.bot = _bot
    }

    buildApp = () => {
        this.app = express()
            .use(express.json())
            .use((req, _, next) => {
                req.providerWS = this.providerWS;
                req.bot = this.bot
                next();
            })
            .use(routes)
            .listen(this.port, () => console.log(`📡 BOT IS RUNNING IN PORT: ${this.port}`));
    };

    /** iniciamos el app */
    start() {
        this.buildApp();
    }
}

export default ServerHttp;
