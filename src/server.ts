import 'reflect-metadata';
import express from 'express';
import cors from 'cors';
import {ErrorHandlerMiddleware} from './middleware';
import {graphqlHTTP} from 'express-graphql';
import {buildSchema} from 'type-graphql';
import {appConfig} from './config';
import {MongoClient} from 'mongodb';
import {AppContext, ProductResolver} from './resolvers';
import {ProductService} from './services';
import {Producer, Product} from './models';

(async () => {
    try {
        // init database connection
        const client = new MongoClient(
            `mongodb://${appConfig.mongo.username}:${appConfig.mongo.password}@${appConfig.mongo.host}:${appConfig.mongo.port}`
        );
        await client.connect();
        const db = client.db(appConfig.mongo.database);
        const producerCollection = db.collection<Producer>('producers');
        const productCollection = db.collection<Product>('products');

        // init services
        const productService = new ProductService(
            producerCollection,
            productCollection
        );
        const context: AppContext = {productService};

        // init app
        const app = express();

        // add middleware
        app.use(cors());
        app.use(express.json());
        app.use(new ErrorHandlerMiddleware().use);

        // config graphql middleware
        const schema = await buildSchema({
            resolvers: [ProductResolver],
            emitSchemaFile: {
                path: 'schema.graphql',
            },
            validate: false,
        });
        app.use(
            '/graphql',
            graphqlHTTP({
                schema: schema,
                context: context,
                graphiql: true,
            })
        );

        // start server
        app.listen(appConfig.port, () => {
            console.log(
                `Running a GraphQL API server at http://localhost:${appConfig.port}/graphql`
            );
        });
    } catch (err) {
        console.error(err);
    }
})();
