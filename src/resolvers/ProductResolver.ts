/* eslint-disable @typescript-eslint/no-unused-vars */
import {
    Arg,
    Ctx,
    Field,
    ID,
    Mutation,
    ObjectType,
    Resolver,
    Query,
    InputType,
} from 'type-graphql';
import {Product, Producer} from '../models';
import {AppContext} from '.';
import {ObjectId, WithId} from 'mongodb';
import {boolean} from 'zod';

@InputType()
export class ProducerInput {
    @Field()
    name!: string;

    @Field({nullable: true})
    country?: string;

    @Field({nullable: true})
    region?: string;
}

@InputType()
export class ProductInput {
    @Field()
    name!: string;

    @Field()
    vintage!: string;

    @Field()
    producerId!: string;
}

@ObjectType()
export class ProducerOutput {
    @Field(() => ID)
    _id!: string;

    @Field()
    name!: string;

    @Field({nullable: true})
    country?: string;

    @Field({nullable: true})
    region?: string;
}

@ObjectType()
export class ProductOutput {
    @Field(() => ID)
    _id!: string;

    @Field()
    name!: string;

    @Field()
    vintage!: string;

    @Field(() => ProducerOutput)
    producer!: ProducerOutput;
}

@Resolver()
export class ProductResolver {
    @Query(() => ProductOutput, {nullable: true})
    async productById(
        @Arg('id') id: string,
        @Ctx() {productService}: AppContext
    ): Promise<ProductOutput | null> {
        const productIdObj = ObjectId.createFromHexString(id);
        const product = await productService.getProductById(productIdObj);
        if (!product) {
            return null;
        }
        const producer = await productService.requireProducerById(
            product.producerId
        );
        return mapProductOutput(product, producer);
    }

    @Query(() => [ProductOutput], {nullable: true})
    async productsByProducerId(
        @Arg('producerId') producerId: string,
        @Ctx() {productService}: AppContext
    ): Promise<ProductOutput[]> {
        const producerIdObj = ObjectId.createFromHexString(producerId);
        const products = await productService.getProductsByProducerId(
            producerIdObj
        );
        if (products.length === 0) {
            return [];
        }
        const producer = await productService.requireProducerById(
            producerIdObj
        );
        return products.map(product => mapProductOutput(product, producer));
    }

    @Mutation(() => [ProducerOutput])
    async addProducers(
        @Arg('producerInputs', () => [ProducerInput]) producerInputs: ProducerInput[],
        @Ctx() {productService}: AppContext
    ): Promise<ProducerOutput[]> {
        const response: ProducerOutput[] = [];
        for (const producerInput of producerInputs) {
            const producer = await productService.addProducer(producerInput);
            response.push(mapProducerOutput(producer));
        }
        return response;
    }

    @Mutation(() => [ProductOutput])
    async addProducts(
        @Arg('productInputs', () => [ProductInput]) productInputs: ProductInput[],
        @Ctx() {productService}: AppContext
    ): Promise<ProductOutput[]> {
        const response: ProductOutput[] = [];
        for (const productInput of productInputs) {
            const producerIdObj = ObjectId.createFromHexString(
                productInput.producerId
            );
            const producer = await productService.requireProducerById(
                producerIdObj
            );
            const product = await productService.addProduct({
                ...productInput,
                producerId: producerIdObj,
            });
            response.push(mapProductOutput(product, producer));
        }
        return response;
    }

    @Mutation(() => ProductOutput)
    async updateProduct(
        @Arg('id') id: string,
        @Arg('name', {nullable: true}) name: string,
        @Arg('vintage', {nullable: true}) vintage: string,
        @Ctx() {productService}: AppContext
    ): Promise<ProductOutput> {
        const productIdObj = ObjectId.createFromHexString(id);
        const product = await productService.updateProductById(productIdObj, name, vintage);
        const producer = await productService.requireProducerById(product.producerId);
        return mapProductOutput(product, producer);
    }

    @Mutation(() => Boolean)
    async deleteProducts(
        @Arg('ids', () => [String]) ids: string[],
        @Ctx() {productService}: AppContext
    ): Promise<Boolean> {
        for (const id of ids) {
            const productIdObj = ObjectId.createFromHexString(id);
            await productService.removeProduct(productIdObj);
        }
        return true;
    }

    @Mutation(() => Boolean)
    async importProducts(
        @Ctx() {productService}: AppContext
    ): Promise<Boolean> {
        // don't wait on this promise
        productService.importProducts();
        return true;
    }
}

const mapProductOutput = (
    product: WithId<Product>,
    producer: WithId<Producer>
): ProductOutput => {
    return {
        _id: product._id.toHexString(),
        name: product.name,
        vintage: product.vintage,
        producer: mapProducerOutput(producer),
    };
};

const mapProducerOutput = (producer: WithId<Producer>): ProducerOutput => {
    return {
        _id: producer._id.toHexString(),
        name: producer.name,
        country: producer.country,
        region: producer.region,
    };
};
