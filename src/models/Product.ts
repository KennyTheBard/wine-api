import { Collection, ObjectId } from 'mongodb';

export type Product = {
    name: string;
    vintage: string;
    producerId: ObjectId;
}

export type ProductRepository = Collection<Product>;

