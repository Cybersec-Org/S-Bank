import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'sbank:is-public';

/** Marks a route as anonymous. Allowed only in the `/public` zone and for `/health`. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
