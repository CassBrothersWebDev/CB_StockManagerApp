import { useState, useCallback } from "react";
import {
  Card,
  Text,
  DropZone,
  VerticalStack,
  Thumbnail,
} from "@shopify/polaris";
import { Toast } from "@shopify/app-bridge-react";
import { useTranslation } from "react-i18next";
import { useAuthenticatedFetch, useAppPost } from "../hooks";
import { NoteMinor } from "@shopify/polaris-icons";
import { read, utils } from "xlsx";
import { LogCard } from "./LogCard";
import inventoryData from "./data/InventoryMap.json";

export function UploadStock() {
  const emptyToastProps = { content: null };
  const [isLoading, setIsLoading] = useState(false);
  const [toastProps, setToastProps] = useState(emptyToastProps);
  const fetch = useAuthenticatedFetch();
  const { t } = useTranslation();
  const [files, setFiles] = useState([]);
  const [titleText, setTitleText] = useState("");
  const [logText, setLogText] = useState([]);
  const [currentData, setCurrentData] = useState();

  const addLog = (newLog) => {
    setLogText((prevLog) =>
      prevLog.concat({ ...newLog, color: getColorByType(newLog.type) })
    );
  };

  function getColorByType(type) {
    switch (type) {
      case "error":
        return "red";
      case "info":
        return "black";
      case "success":
        return "green";
      default:
        return "inherit"; // Fallback color if type is not recognized
    }
  }

  const toastMarkup = toastProps.content && !isRefetchingCount && (
    <Toast {...toastProps} onDismiss={() => setToastProps(emptyToastProps)} />
  );

  const handleUpdate = async () => {
    try {
      setIsLoading(true);
      for (const file of files) {
        setTitleText("Processing Stock Sheet");
        const fileData = await file.arrayBuffer();
        const stockBook = read(fileData, { type: "array" });
        const sheetNames = stockBook.SheetNames;
        console.log("Processing all worksheets");
        addLog({ message: "Processing all worksheets", type: "success" });
        for (const sheetName of sheetNames) {
          console.log(sheetName);
          addLog({
            message: "Processing " + sheetName + " sheet",
            type: "info",
          });
          await processStockSheet(sheetName, stockBook, performUpdateRequest);
        }
      }
      setIsLoading(false);
    } catch (error) {
      console.log(error);
      // Handle the error
    }
  };

  async function processStockSheet(worksheetName, stockBook) {
    // Get Inventory Map data from file
    const productInfo = inventoryData.Products;

    const worksheet = stockBook.Sheets[worksheetName];
    if (!worksheet) {
      //logger.error(`Worksheet '${worksheetName}' not found`);
      console.log(`Worksheet '${worksheetName}' not found`);
      return;
    }
    //logger.info(`Processing worksheet: ${worksheetName}`);

    // **********
    // Sort data on this sheet
    // **********
    const stockData = utils.sheet_to_json(worksheet, {
      header: "A",
    });
    // Iterate over the header row (3) convert serial numbers to dates and store column that sku is located in
    let headerRow = stockData[2];
    let skuColumnKey = "C";
    for (const key in headerRow) {
      if (headerRow[key] === "Product No") {
        skuColumnKey = key;
      }
      if (typeof headerRow[key] === "number") {
        headerRow[key] = convertSerialToDate(headerRow[key]);
      }
    }

    //Iterate over rows on this sheet (ignore first 3 rows as headers)
    for (let i = 3; i < stockData.length; i++) {
      const sku = stockData[i][skuColumnKey];

      // **********
      // Find correct values in this row to update quantity & get correct ID's for Shopify API
      // **********
      const values = Object.values(stockData[i]);
      const keys = Object.keys(stockData[i]);
      let quantityToUpdate;
      let keyOfLastValue;
      // Check if final number in values is a string and take first digit from that, this occurs when count was in one cell for both counted and to be ordered values.
      if (typeof values[values.length - 1] === "string") {
        const lastCount = values[values.length - 1];
        keyOfLastValue = keys[values.length - 1];
        const firstInt = parseInt(lastCount, 10);
        if (!isNaN(firstInt)) {
          quantityToUpdate = firstInt;
        }
      } else {
        quantityToUpdate = values[values.length - 2];
        keyOfLastValue = keys[values.length - 2];
      }
      // If quantity in Sheet = "OK" set qty to 50
      if (quantityToUpdate === "OK") {
        quantityToUpdate = 50;
      }
      //Find the Inventory Item ID & Product ID for the current SKU
      const productIds =
        productInfo &&
        sku &&
        productInfo.find(
          (record) =>
            record["Variant SKU"] &&
            record["Variant SKU"].toString() === sku.toString() &&
            record["Variant SKU"].toString().trim() !== ""
        );

      // **********
      // Check how long since last updated date, only update product if within given time (90 days)
      // **********
      let dayDiff = 9999;
      if (headerRow[keyOfLastValue] !== undefined) {
        const givenDateParts = headerRow[keyOfLastValue].split("/");
        const lastCountDate = new Date(
          `${givenDateParts[1]}/${givenDateParts[0]}/${givenDateParts[2]}`
        );
        const currentDate = new Date();
        dayDiff = Math.floor(
          (currentDate - lastCountDate) / (1000 * 60 * 60 * 24)
        );
      }

      if (typeof dayDiff === "number" && dayDiff < 90) {
        // Ignore if no SKU found in SKU Column
        if (stockData[i][skuColumnKey] !== undefined) {
          if (productIds !== undefined && quantityToUpdate !== null) {
            // **********
            // Update the Inventory
            // **********
            const invItemID = productIds["Variant Inventory Item ID"];
            const productId = productIds["ID"];

            addLog({
              message: `Updating ${sku} (${quantityToUpdate})`,
              type: "info",
            });
            await performUpdateRequest(
              sku,
              invItemID,
              quantityToUpdate,
              productId
            );

            // **********
            // If product is flagged as discontinued and stock has ran out, set product to draft.
            // **********
            if (stockData[i].A === "Discontinued" && quantityToUpdate === 0) {
              //setToDraft(productIds);
            }
          } else {
            //logger.error(`Unable to Update ${sku}`);
          }
        }
      }
    }
  }

  // Function to convert serial number to date string
  function convertSerialToDate(serialNumber) {
    const date = new Date((serialNumber - 25569) * 86400 * 1000);
    return date.toLocaleDateString();
  }

  const { mutateAsync } = useAppPost({
    url: "/api/stock-update",
    data: currentData,
    fetchInit: {
      headers: {
        "Content-Type": "application/json",
      },
    },
    reactQueryOptions: {
      onSuccess: (response) => {
        console.log("Request:", response);
        if (response.success === false) {
          addLog({ message: response.error, type: "error" });
        }
      },
    },
  });

  async function performUpdateRequest(
    skuValue,
    invItemIDValue,
    quantityToUpdateValue,
    productIdValue
  ) {
    return new Promise((resolve) => {
      setTimeout(async () => {
        try {
          setCurrentData({
            sku: skuValue,
            invItemID: invItemIDValue,
            quantityToUpdate: quantityToUpdateValue,
            productId: productIdValue,
          });

          await mutateAsync();
          resolve();
        } catch (error) {
          console.log("Error occurred while making the API call:", error);
          resolve(); // Resolve even if an error occurs to proceed with the next request
        }
      }, 1000 / 2); // 2 requests per second
    });
  }

  const handleDropZoneDrop = useCallback(
    (dropFiles, acceptedFiles, rejectedFiles) =>
      setFiles((files) => [...files, ...acceptedFiles]),
    []
  );

  const fileUpload = !files.length && <DropZone.FileUpload />;
  const uploadedFiles = files.length > 0 && (
    <div style={{ padding: "0" }}>
      <VerticalStack vertical>
        {files.map((file, index) => (
          <VerticalStack alignment="center" key={index}>
            <Thumbnail size="small" alt={file.name} source={NoteMinor} />
            <div>
              {file.name}{" "}
              <Text variant="bodySm" as="p">
                {file.size} bytes
              </Text>
            </div>
          </VerticalStack>
        ))}
      </VerticalStack>
    </div>
  );

  return (
    <>
      {toastMarkup}
      <Card
        title={"Upload Stock Sheet"}
        sectioned
        primaryFooterAction={{
          content: "Update Stock",
          onAction: handleUpdate,
          loading: isLoading,
        }}
      >
        <Text variant="bodyMd" as="p" fontWeight="semibold">
          {
            "Upload 'Petersham Supplier Stock Count.xlsx' below to update inventory from all sheets"
          }
        </Text>

        <DropZone onDrop={handleDropZoneDrop}>
          {uploadedFiles}
          {fileUpload}
        </DropZone>
      </Card>
      <LogCard title={titleText} log={logText} />
    </>
  );
}
