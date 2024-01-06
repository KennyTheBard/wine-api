import { ProductService } from '../services';

export * from './ProductResolver';

export type AppContext = {
    productService: ProductService;
};
