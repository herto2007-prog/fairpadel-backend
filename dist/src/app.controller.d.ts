export declare class AppController {
    getHello(): {
        message: string;
        version: string;
        status: string;
        endpoints: {
            tournaments: string;
            categories: string;
            rankings: string;
            auth: string;
        };
    };
    healthCheck(): {
        status: string;
        timestamp: string;
        database: string;
    };
}
