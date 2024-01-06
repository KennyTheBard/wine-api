import { Collection } from "mongodb";

export type Producer = {
    name: string;
    country?: string;
    region?: string;
}

export type ProducerRepository = Collection<Producer>;
