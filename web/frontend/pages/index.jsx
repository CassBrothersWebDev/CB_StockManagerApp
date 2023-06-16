import React, { useState, useEffect } from "react";
import {
  Card,
  Page,
  Layout,
  TextContainer,
  Image,
  Stack,
  Link,
  Text,
  HorizontalGrid,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { useTranslation, Trans } from "react-i18next";
import {
  ProductsCard,
  CollectionUpdate,
  UploadStock,
  ToolBar,
  LogCard,
} from "../components";
import { useAuthenticatedFetch } from "../hooks";

export default function HomePage() {
  const fetch = useAuthenticatedFetch();

  const [titleText, setTitleText] = useState(""); // State to hold title text
  const [logText, setLogText] = useState([]);
  const { t } = useTranslation();
  const [collectionList, setCollectionList] = useState([]);
  //let titleText='test';
  //let logText = [{ message: "TESTY", color: 'red' }];

  // Callback function to update title text
  const updateTitleText = (newTitleText) => {
    setTitleText(newTitleText);
  };

  // Callback function to append to log text
  const appendToLogText = (newLog) => {
    setLogText((prevLog) =>
      prevLog.concat({ ...newLog, color: getColorByType(newLog.type) })
    );
  };

  const fetchCollectionList = async () => {
    try {
      const response = await fetch("/api/collection-data");
      if (!response.ok) {
        //console.log(response);
        throw new Error("Error fetching CollectionList");
      }
      const jsonData = await response.json();
      setCollectionList(jsonData);
    } catch (error) {
      console.error("Error fetching CollectionList:", error);
      // Handle error state or display an error message
    }
  };

  // Load latest inventory from backend
  useEffect(() => {
    fetchCollectionList();
  }, []);

  const handleFetchCollectionList = () => {
    fetchCollectionList();
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

  return (
    <Page>
      <TitleBar
        title={"Cass Brothers Custom Stock Management App"}
        primaryAction={null}
      />
      <UploadStock
        updateTitleText={updateTitleText}
        appendToLogText={appendToLogText}
      />
      <CollectionUpdate
        updateTitleText={updateTitleText}
        appendToLogText={appendToLogText}
        collectionList={collectionList}
      />
      <LogCard title={titleText} log={logText} />
      <ToolBar
        appendToLogText={appendToLogText}
        handleFetchCollectionList={handleFetchCollectionList}
      />
    </Page>
  );
}
