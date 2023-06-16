import fs from 'fs';
const saveQtyUpdates = (sku, id, qty) => {
    const filePath = './data/inventory.json';
    console.log("SaveQTYUpdates Input: ");
    console.log({ sku, id, qty });
  
    // Read the existing data or initialize an empty array
    let data = [];
    if (fs.existsSync(filePath)) {
      const fileContent = fs.readFileSync(filePath, 'utf8');
      data = JSON.parse(fileContent);
    }
  
    // Check if ID already exists in data array
    const existingItemIndex = data.findIndex((item) => item.id === id);
    if (existingItemIndex !== -1) {
      // ID exists, update the quantity
      data[existingItemIndex].qty = qty;
    } else {
      // ID doesn't exist, add a new entry
      console.log('Saving QTY: ' + sku);
      data.push({ sku, id, qty });
    }
  
    // Write the updated data to the JSON file
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  
};

export { saveQtyUpdates };