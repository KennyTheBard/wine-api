import {ObjectId, WithId} from 'mongodb';
import {
    Producer,
    ProducerRepository,
    Product,
    ProductRepository,
} from '../models';
import axios from 'axios';
import * as csv from 'csv-parse';
import {
    Transform,
    TransformCallback,
    TransformOptions,
    Writable,
    WritableOptions,
    pipeline,
} from 'node:stream';
import { promisify } from 'node:util';

export class ProductService {
    constructor(
        private readonly producerRepo: ProducerRepository,
        private readonly productRepo: ProductRepository
    ) {}

    public async addProducer(producer: Producer): Promise<WithId<Producer>> {
        const result = await this.producerRepo.insertOne(producer, {});
        return this.requireProducerById(result.insertedId);
    }

    public async getProducerById(
        producerId: ObjectId
    ): Promise<WithId<Producer> | null> {
        return this.producerRepo.findOne({_id: producerId});
    }

    public async requireProducerById(
        producerId: ObjectId
    ): Promise<WithId<Producer>> {
        const producer = await this.getProducerById(producerId);
        if (!producer) {
            throw new Error(`Missing producer ${producerId.toHexString()}`);
        }
        return producer;
    }

    public async addProduct(product: Product): Promise<WithId<Product>> {
        const result = await this.productRepo.insertOne(product, {});
        return this.requireProductById(result.insertedId);
    }

    public async getProductById(
        productId: ObjectId
    ): Promise<WithId<Product> | null> {
        return this.productRepo.findOne({_id: productId});
    }

    public async requireProductById(
        productId: ObjectId
    ): Promise<WithId<Product>> {
        const product = await this.getProductById(productId);
        if (!product) {
            throw new Error(`Missing producer ${productId.toHexString()}`);
        }
        return product;
    }

    public async getProductsByProducerId(
        producerId: ObjectId
    ): Promise<WithId<Product>[]> {
        return this.productRepo.find({producerId: producerId}).toArray();
    }

    public async updateProductById(
        productId: ObjectId,
        name: string,
        vintage: string
    ): Promise<WithId<Product>> {
        const product = await this.productRepo.findOneAndUpdate(
            {_id: productId},
            {$set: {name, vintage}}
        );
        if (!product) {
            throw new Error(`Could not find product ${productId}`);
        }
        return product;
    }

    public async removeProduct(productId: ObjectId): Promise<void> {
        await this.productRepo.findOneAndDelete({id: productId});
    }

    public async importProducts(): Promise<void> {
        try {
            const response = await axios.get(
                'https://api.frw.co.uk/feeds/all_listings.csv',
                {
                    responseType: 'stream',
                }
            );
            const pipelineAsync = promisify(pipeline);
            await pipelineAsync(
                response.data,
                csv.parse({
                    delimiter: ',',
                    columns: [
                        'Vintage',
                        'Product Name',
                        'Producer',
                        'Country',
                        'Region',
                        'Colour',
                        'Quantity',
                        'Format',
                        'Price (GBP)',
                        'Duty',
                        'Availability',
                        'Conditions',
                        'ImageUrl',
                    ],
                }),
                new BatchTransform(),
                new AsyncTransform(this.importProduct),
            );
            console.log('Import completed!')
        } catch (err) {
            console.error(err);
        }
    }

    private importProduct = async (row: ProductRow): Promise<void> => {
        // TODO: check if producer exists
        const producer = await this.addProducer({
            name: row.Producer,
            country: row.Country.length > 0 ? row.Country : undefined,
            region: row.Region.length > 0 ? row.Region : undefined,
        });
        const product = await this.addProduct({
            name: row['Product Name'],
            vintage: row.Vintage,
            producerId: producer._id,
        });
    }
}

type ProductRow = {
    Vintage: string;
    'Product Name': string;
    Producer: string;
    Country: string;
    Region: string;
    Colour: string;
    Quantity: string;
    Format: string;
    'Price (GBP)': string;
    Duty: string;
    Availability: string;
    Conditions: string;
    ImageUrl: string;
};

class BatchTransform<T> extends Transform {
    private readonly batchSize = 100;
    private buffer: T[] = [];

    constructor(options?: TransformOptions) {
        super({...options, objectMode: true});
        this.batchSize = 100;
        this.buffer = [];
    }

    _transform(
        chunk: T,
        encoding: BufferEncoding,
        callback: TransformCallback
    ): void {
        this.buffer.push(chunk);

        if (this.buffer.length >= this.batchSize) {
            this.push([...this.buffer]);
            this.buffer = [];
        }

        callback();
    }

    _flush(callback: TransformCallback) {
        if (this.buffer.length > 0) {
            this.push([...this.buffer]);
        }
        callback();
    }
}

class AsyncTransform<T> extends Writable {
    constructor(
        private readonly asyncFn: (value: T) => Promise<void>,
        options?: WritableOptions
    ) {
        super({...options, objectMode: true});
    }

    async _write(
        chunk: T[],
        encoding: BufferEncoding,
        callback: TransformCallback
    ) {
        try {
            await Promise.all(chunk.map(row => this.asyncFn(row)));
            callback();
        } catch (error) {
            this.emit('error', error);
        }
    }
}
