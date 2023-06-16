// @ts-check
import { join } from "path";
import { readFileSync } from "fs";
import express from "express";
import serveStatic from "serve-static";
import shopify from "./shopify.js";
import productCreator from "./product-creator.js";
import GDPRWebhookHandlers from "./gdpr.js";
import updateStock from "./updateStock.js";
import { saveQtyUpdates } from "./saveQtyUpdates.js";
import path from "path";
import fs from "fs";
import collectionUpdate from "./collectionUpdate.js";
import axios from "axios";

const PORT = parseInt(
  process.env.BACKEND_PORT || process.env.PORT || "3000",
  10
);

const STATIC_PATH =
  process.env.NODE_ENV === "production"
    ? `${process.cwd()}/frontend/dist`
    : `${process.cwd()}/frontend/`;

const app = express();
app.use(express.json({ limit: "20mb" }));

// Set up Shopify authentication and webhook handling
app.get(shopify.config.auth.path, shopify.auth.begin());
app.get(
  shopify.config.auth.callbackPath,
  shopify.auth.callback(),
  shopify.redirectToShopifyOrAppRoot()
);
app.post(
  shopify.config.webhooks.path,
  shopify.processWebhooks({ webhookHandlers: GDPRWebhookHandlers })
);

// If you are adding routes outside of the /api path, remember to
// also add a proxy rule for them in web/frontend/vite.config.js

app.use("/api/*", shopify.validateAuthenticatedSession());


app.use(express.json());

app.get("/api/products/count", async (_req, res) => {
  const countData = await shopify.api.rest.Product.count({
    session: res.locals.shopify.session,
  });
  res.status(200).send(countData);
});

app.get("/api/products/create", async (_req, res) => {
  let status = 200;
  let error = null;

  try {
    await productCreator(res.locals.shopify.session);
  } catch (e) {
    console.log(`Failed to process products/create: ${e.message}`);
    status = 500;
    error = e.message;
  }
  res.status(status).send({ success: status === 200, error });
});

app.post("/api/stock-update", async (req, res) => {
  const maxRetries = 5;
  let retries = 0;
  let status = 200;
  let error = null;
  const sku = req.body.sku;
  const id = req.body.invItemID;
  const qty = req.body.quantityToUpdate;
  const productId = req.body.productId;
  try {
    const updateStock = async () => {
      const inventory_level = new shopify.api.rest.InventoryLevel({
        session: res.locals.shopify.session,
      });
      const inventoryUpdate = await inventory_level.set({
        body: {
          inventory_item_id: id,
          location_id: 61292740652,
          available: qty,
        },
      });
      console.log(sku + " " + productId);
      console.log(inventoryUpdate);
      saveQtyUpdates(sku, productId, qty);
    };

    // Retry logic
    while (retries < maxRetries) {
      try {
        await updateStock();
        break; // Break out of the retry loop if successful
      } catch (e) {
        if (e.response && e.response.status === 429) {
          // Too Many Requests error (429)
          retries++;
          const backoffTime = Math.pow(2, retries) * 1000; // Exponential backoff formula
          console.log(`Retrying after ${backoffTime}ms`);
          await new Promise((resolve) => setTimeout(resolve, backoffTime));
        } else {
          throw e; // Re-throw other errors
        }
      }
    }

    // If all retries failed, throw an error
    if (retries === maxRetries) {
      throw new Error("Max retries exceeded");
    }

    //saveQtyUpdates(sku, productId, qty);
  } catch (e) {
    console.log(`Failed to process update stock: ${e.message}`);
    status = 500;
    error = e.message;
  }

  res.status(status).send({ success: status === 200, error });
});

app.put("/api/draft-product", async (req, res) => {
  const maxRetries = 5;
  let retries = 0;
  let status = 200;
  let error = null;

  const id = req.body.id;
  console.log("DRAFTING PRODUCT!!!!!!!!!!");
  console.log(req.body);
  try {
    const draftProduct = async () => {
      const product = new shopify.api.rest.Product({
        session: res.locals.shopify.session,
      });
      product.id = id;
      product.status = "draft";
      const prodUpdate = await product.save({
        update: true,
      });
      console.log(id);
      console.log(prodUpdate);
    };

    // Retry logic
    while (retries < maxRetries) {
      try {
        await draftProduct();
        break; // Break out of the retry loop if successful
      } catch (e) {
        if (e.response && e.response.status === 429) {
          // Too Many Requests error (429)
          retries++;
          const backoffTime = Math.pow(2, retries) * 1000; // Exponential backoff formula
          console.log(`Retrying after ${backoffTime}ms`);
          await new Promise((resolve) => setTimeout(resolve, backoffTime));
        } else {
          throw e; // Re-throw other errors
        }
      }
    }

    // If all retries failed, throw an error
    if (retries === maxRetries) {
      throw new Error("Max retries exceeded");
    }

    //saveQtyUpdates(sku, productId, qty);
  } catch (e) {
    console.log(`Failed to process update stock: ${e.message}`);
    status = 500;
    error = e.message;
  }

  res.status(status).send({ success: status === 200, error });
});

app.get("/api/collection/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Fetch collection data
    const collectionData = await shopify.api.rest.Collection.products({
      session: res.locals.shopify.session,
      id: id,
    });

    res.status(200).send(collectionData);
  } catch (error) {
    console.error("Error fetching collection data:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/api/update-coll/:id", async (req, res) => {
  try {
    const { id } = req.params;
    console.log("ID: " + id);
    const response = await collectionUpdate(req, res, id);

    res.status(200).send(response);
  } catch (error) {
    console.log("Error in update-coll: " + error);
    res.status(500).send("Internal Server Error");
  }
});

app.post("/api/product-data", (req, res) => {
  try {
    const jsonData = JSON.stringify(req.body);
    const filePath = "./data/products.json";

    fs.writeFile(filePath, jsonData, (err) => {
      if (err) {
        console.log("Error writing to file: " + err);
        res.status(500).send("Error writing to file");
      } else {
        console.log("Data written to file successfully");
        res.status(200).send("Data written to file");
      }
    });
  } catch (error) {
    console.log("Error in inventory-data: " + error);
  }
});

app.get("/api/product-data", (req, res) => {
  try {
    const filePath = "./data/products.json";

    fs.readFile(filePath, "utf8", (err, data) => {
      if (err) {
        console.log("Error reading file: " + err);
        res.status(500).send("Error reading file");
      } else {
        const jsonData = JSON.parse(data);
        res.status(200).json(jsonData);
      }
    });
  } catch (error) {
    console.log("Error in product-data: " + error);
    res.status(500).send("Error processing data");
  }
});

app.post("/api/collection-data", (req, res) => {
  try {
    const jsonData = JSON.stringify(req.body);
    const filePath = "./data/collections.json";

    fs.writeFile(filePath, jsonData, (err) => {
      if (err) {
        console.log("Error writing to file: " + err);
        res.status(500).send("Error writing to file");
      } else {
        console.log("Data written to file successfully");
        res.status(200).send("Data written to file");
      }
    });
  } catch (error) {
    console.log("Error in inventory-data: " + error);
  }
});

app.get("/api/collection-data", (req, res) => {
  try {
    const filePath = "./data/collections.json";

    fs.readFile(filePath, "utf8", (err, data) => {
      if (err) {
        console.log("Error reading file: " + err);
        res.status(500).send("Error reading file");
      } else {
        if (data) {
          const jsonData = JSON.parse(data);
          res.status(200).json(jsonData);
        } else {
          res.status(200).json([{}]);
        }
      }
    });
  } catch (error) {
    console.log("Error in product-data: " + error);
    res.status(500).send("Error processing data");
  }
});

app.use(shopify.cspHeaders());
app.use(serveStatic(STATIC_PATH, { index: false }));

app.use("/*", shopify.ensureInstalledOnShop(), async (_req, res, _next) => {
  return res
    .status(200)
    .set("Content-Type", "text/html")
    .send(readFileSync(join(STATIC_PATH, "index.html")));
});

app.listen(PORT);
console.log(`Listening on port: ${PORT}`);
