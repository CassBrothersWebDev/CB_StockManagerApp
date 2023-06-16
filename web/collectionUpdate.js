import shopify from "./shopify.js";
import fs from 'fs';

// Function to move same-brand objects to non-adjacent positions
function moveSameBrandObjects(arr) {
  var result = [];
  var groupedObjects = {};

  // Group objects by brand
  arr.forEach(obj => {
    if (!groupedObjects[obj.brand]) {
      groupedObjects[obj.brand] = [];
    }
    groupedObjects[obj.brand].push(obj);
  });

  // Determine maximum count of same-brand objects
  var maxCount = 0;
  Object.keys(groupedObjects).forEach(brand => {
    var count = groupedObjects[brand].length;
    if (count > maxCount) {
      maxCount = count;
    }
  });

  // Iterate through each group and distribute objects to non-adjacent positions
  for (var i = 0; i < maxCount; i++) {
    Object.keys(groupedObjects).forEach(brand => {
      var group = groupedObjects[brand];
      if (group.length > i) {
        result.push(group[i]);
      }
    });
  }

  return result;
}


const updateCollectionSortOrder = async (res, collectionId, sortOrder) => {
  const client = new shopify.api.clients.Graphql({
    session: res.locals.shopify.session,
  });

  const mutation = `
    mutation updateCollectionSortOrder {
      collectionUpdate(input: {
        id: "gid://shopify/Collection/${collectionId}",
        sortOrder: ${sortOrder}
      }) {
        collection {
          id
          title
          sortOrder
          handle
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const response = await client.query({ data: mutation });

  return response.body.data;
};

const updateProductPosition = async (
  res,
  collectionId,
  productId,
  position
) => {
  const client = new shopify.api.clients.Graphql({
    session: res.locals.shopify.session,
  });

  const mutation = {
    "query": `mutation 
      collectionReorderProducts ($id : ID!, $moves: [MoveInput!]!) { 
        collectionReorderProducts(id: $id, moves: $moves) {
          job {
            id
          }
          userErrors {
            field
            message
          }
        }
      }`,
      "variables": {
        "id": `gid://shopify/Collection/${collectionId}`,
        "moves": {
          "id": `gid://shopify/Product/${productId}`,
          "newPosition": `${position}`
        }
      }
  };

  const response = await client.query({ data: mutation });

  return response.body.data;
};

async function collectionUpdate(req, res, collectionId) {
  try {
    // Read inventory.json file
    const inventoryData = await new Promise((resolve, reject) => {
      fs.readFile('./data/inventory.json', 'utf8', (err, data) => {
        if (err) {
          console.error('Error reading file:', err);
          reject(err);
          return;
        }
        try {
          const jsonData = JSON.parse(data);
          resolve(jsonData);
        } catch (error) {
          console.error('Error parsing JSON:', error);
          reject(error);
        }
      });
    });
    
    //const collID = 448281903403;
    const collID = collectionId;

    // Set collection to 'Best Selling' sort type
    let updatedCollection = await updateCollectionSortOrder(
      res,
      collID,
      "BEST_SELLING"
    );
    //console.log(updatedCollection);

    // Get collection products
    const collectionData = await shopify.api.rest.Collection.products({
      session: res.locals.shopify.session,
      id: collID,
    });

    //console.log("ORIGINAL ARRAY");
    //console.log(collectionData);

    // Sort the products to how we want
    let productArray = [];
    let productsWithQty = [];
    let createdRecentlyProducts = [];
    const recentDate = new Date();
    recentDate.setMonth(recentDate.getMonth() - 2);
    for (let i = 0; i < collectionData.products.length; i++) {
      const productId = collectionData.products[i].id;
      const product = inventoryData.find((item) => item.id == productId);
      const qty = product ? product.qty : 0;
      const createdAt = new Date(collectionData.products[i].created_at);
      if (qty > 0) {
        productsWithQty.push({
          id: productId,
          created_at: collectionData.products[i].created_at,
          qty,
          brand: collectionData.products[i].vendor,
        });
      } else if (createdAt > recentDate) {
        createdRecentlyProducts.push({
          id: productId,
          created_at: collectionData.products[i].created_at,
          qty,
          brand: collectionData.products[i].vendor,
        });
      } else {
        productArray.push({
          id: productId,
          created_at: collectionData.products[i].created_at,
          qty,
          brand: collectionData.products[i].vendor,
        });
      }
    }
    productArray.unshift(...productsWithQty);
    // Randomly insert createdRecentlyProducts every 2-4 places into productArray
    let j = 0;
    for (let i = 0; i < createdRecentlyProducts.length; i++) {
      let randomIndex = Math.floor(Math.random() * 3) + 1; // Generate a random index between 1 & 4
      randomIndex += j;
      productArray.splice(randomIndex, 0, createdRecentlyProducts[i]);
      j = randomIndex + 1;
    }
    //console.log("UPDATED ARRAY");
    //console.log(productArray);

    //Move products of the same brand
    // Move same-brand objects to non-adjacent positions while maintaining order
    var shuffledArray = moveSameBrandObjects(productArray);
    

    // Set collection to 'Manual' sort type
    updatedCollection = await updateCollectionSortOrder(res, collID, "MANUAL");
    //console.log(updatedCollection);

    // Update the order of the products
    for (let i=0; i<shuffledArray.length; i++) {
      await updateProductPosition(res, collID, shuffledArray[i].id, i);
    }

    // Send success response
    //res.json(id);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "An error occurred" });
  }
}

export default collectionUpdate;
