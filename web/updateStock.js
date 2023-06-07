import { GraphqlQueryError } from "@shopify/shopify-api";
import shopify from "./shopify.js";




export const DEFAULT_PRODUCTS_COUNT = 5;
const CREATE_PRODUCTS_MUTATION = `
  mutation populateProduct($input: ProductInput!) {
    productCreate(input: $input) {
      product {
        id
      }
    }
  }
`;

export default async function updateStock(
  workbook
) {
  const client = new shopify.api.clients.Graphql({ session });

  try {
    console.log(workbook);
  } catch (error) {
    console.log(error);
  }
}
