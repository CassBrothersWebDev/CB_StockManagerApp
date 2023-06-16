import { useState, useCallback, useEffect } from "react";
import {
  Button,
  Icon,
  Modal,
  Tabs,
  DropZone,
  Text,
  VerticalStack,
  Thumbnail,
} from "@shopify/polaris";
import { read, utils } from "xlsx";
import { ToolsMajor, NoteMinor } from "@shopify/polaris-icons";
import { useAuthenticatedFetch, useAppPost } from "../hooks";

export function ToolBar({ appendToLogText, handleFetchCollectionList }) {
  const [modalActive, isModalActive] = useState(false);
  const [selectedTab, setSelectedTab] = useState(0);
  const [invFiles, setInvFiles] = useState([]);
  const [collFiles, setCollFiles] = useState([]);
  const [data, setData] = useState({
    url: '',
    jsonData: {}
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = useCallback(
    () => isModalActive(!modalActive),
    [modalActive]
  );

  const handleTabChange = useCallback(
    (selectedTabIndex) => setSelectedTab(selectedTabIndex),
    []
  );

  const activator = (
    <div style={{ position: "absolute", top: "1.25rem", right: "5rem" }}>
      <Button onClick={handleChange}>
        <Icon source={ToolsMajor} />
      </Button>
    </div>
  );

  const tabs = [
    {
      id: "inventory-id-map",
      content: "Inventory Data",
      accessibilityLabel: "Inventory IDs",
      panelID: "inventory-id-map-1",
    },
    {
      id: "collection-list",
      content: "Collection Data",
      panelID: "collection-list-1",
    },
    {
      id: "more-info",
      content: "More Info",
      panelID: "more-info-1",
    },
  ];

  const fileUpload = !invFiles.length && <DropZone.FileUpload />;
  const uploadedFiles = invFiles.length > 0 && (
    <div style={{ padding: "1.25rem" }}>
      <VerticalStack vertical>
        {invFiles.map((file, index) => (
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
  const fileUpload_1 = !collFiles.length && <DropZone.FileUpload />;
  const uploadedFiles_1 = collFiles.length > 0 && (
    <div style={{ padding: "1.25rem" }}>
      <VerticalStack vertical>
        {collFiles.map((file, index) => (
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

  

  const handleDropZoneDrop = useCallback(
    (dropFiles, acceptedFiles, rejectedFiles) => {
      setInvFiles(acceptedFiles);
    },
    []
  );
  const handleDropZoneDrop_1 = useCallback(
    (dropFiles, acceptedFiles, rejectedFiles) => {
      setCollFiles(acceptedFiles);
    },
    []
  );

  const handleSubmit = useCallback(async () => {
    setIsLoading(true);
    if (invFiles.length > 0) {
      const fileData = await invFiles[0].arrayBuffer();
      const workBook = read(fileData, { type: "array" });
      const sheetName = workBook.SheetNames[0];
      const sheet = workBook.Sheets[sheetName];
      const jsonData = utils.sheet_to_json(sheet);    
      //console.log(jsonData);
      await performPostRequest('/api/product-data', jsonData);  
      appendToLogText({message: "Updated Inventory Data", type: "success"});

    }

    if (collFiles.length > 0) {
      const fileData = await collFiles[0].arrayBuffer();
      const workBook = read(fileData, { type: "array" });
      const sheetName = workBook.SheetNames[0];
      const sheet = workBook.Sheets[sheetName];
      const jsonData = utils.sheet_to_json(sheet);
      //console.log(jsonData);

      await performPostRequest('/api/collection-data', jsonData);
      appendToLogText({message: "Updated Collection Data", type: "success"});
      handleFetchCollectionList();
      
    }

    setCollFiles([]);
    setInvFiles([]);
    isModalActive(false);
    setIsLoading(false);
  }, [invFiles, collFiles]);

  async function performPostRequest(
    url, jsonData
  ) {
    return new Promise((resolve) => {
      setTimeout(async () => {
        try {
          setData({
            url: url,
            jsonData: jsonData,
          });

          await mutateAsync();
          resolve();
        } catch (error) {
          console.log("Error occurred while making the API call:", error, url);
          resolve(); // Resolve even if an error occurs to proceed with the next request
        }
      }, 1000 / 2); // 2 requests per second
    });
  }


  const { mutateAsync } = useAppPost({
    url: data.url,
    data: data.jsonData,
    fetchInit: {
      headers: {
        "Content-Type": "application/json",
      },
    },
    reactQueryOptions: {
      onSuccess: (response) => {
        console.log("Request:", response);
        if (response.success === false) {
          console.log(response.error);
        }
      },
    },
  });

  return (
    <>
      <div>
        <Modal
          large
          activator={activator}
          open={modalActive}
          onClose={handleChange}
          title="Tools"
          primaryAction={{
            content: "Submit",
            onAction: handleSubmit,
            loading: isLoading,
          }}
        >
          <Modal.Section>
            <Tabs tabs={tabs} selected={selectedTab} onSelect={handleTabChange}>
              <Modal.Section title={tabs[selectedTab].content}>
                {selectedTab === 0 && (
                  <>
                    <Modal.Section>
                      <Text variant="headingMd" as="h6">
                        Upload Excel file to map SKU's to Shopify ID's
                      </Text>
                      <p>
                        Drop an xlsx file of Products with columns "ID", "Variant Inventory
                        Item ID", "Variant ID" & "Variant SKU" exported from
                        Matrixify
                      </p>
                    </Modal.Section>
                    <DropZone onDrop={handleDropZoneDrop}>
                      {uploadedFiles}
                      {fileUpload}
                    </DropZone>
                  </>
                )}
                {selectedTab === 1 && (
                  <>
                    <Modal.Section>
                      <Text variant="headingMd" as="h6">
                        Upload Excel file to hold relevant Collection Data
                      </Text>
                      <p>
                        Drop an xlsx file of Custom Collections with columns "ID", "Handle", "Title" & "Published" exported from
                        Matrixify
                      </p>
                    </Modal.Section>
                    <DropZone onDrop={handleDropZoneDrop_1}>
                      {uploadedFiles_1}
                      {fileUpload_1}
                    </DropZone>
                    <Modal.Section>
                      <p>Note: Need to combine both 'Smart Collections' & 'Custom Collections' sheets from Matrixify export</p>
                    </Modal.Section>
                  </>
                )}
                {selectedTab == 2 && (
                  <>
                  <Modal.Section>
                    <Text variant="bodyMd" as="p">
                      <ul>
                        <li>Upload Stock sheet as is found in "P:\" drive to set product data on site to match.</li>
                        <li>You may update all collections or choose to update single collections. Some of the newest products will be randomised to top of collection. If unhappy select that collection to re-order those products</li>  
                        <li>Full Logs can be found at './web/logs' with time-stamps</li>
                        <li>If app is not running correctly try restarting & uploading recently exported Inventory Data & Collection Data</li>                          
                      </ul>
                    </Text>
                  </Modal.Section>
                  </>
                )}
              </Modal.Section>
            </Tabs>
          </Modal.Section>
        </Modal>
      </div>
    </>
  );
}
