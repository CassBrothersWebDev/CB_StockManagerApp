import { useState, useMemo, useCallback, useEffect } from "react";
import { Card, Listbox, Combobox, Icon } from "@shopify/polaris";
import { SearchMinor } from "@shopify/polaris-icons";
import { useAuthenticatedFetch } from "../hooks";

export function CollectionUpdate({ updateTitleText, appendToLogText, collectionList }) {
  const [isLoading, setIsLoading] = useState(false);
  const fetch = useAuthenticatedFetch();
  
console.log(collectionList);
  const deselectedOptions = useMemo(() => collectionList, [collectionList]);

  const [selectedOption, setSelectedOption] = useState();
  const [selectedCollection, setSelectedCollection] = useState();
  const [inputValue, setInputValue] = useState("");
  const [options, setOptions] = useState(deselectedOptions);
  const [inventoryData, setInventoryData] = useState();
  const [collectionData, setCollectionData] = useState();

  const updateText = useCallback(
    (value) => {
      setInputValue(value);

      if (value === "") {
        setOptions(deselectedOptions);
        return;
      }

      const filterRegex = new RegExp(value, "i");
      const resultOptions = deselectedOptions.filter((option) =>
        option.Title.match(filterRegex)
      );
      setOptions(resultOptions);
    },
    [deselectedOptions]
  );

  useEffect(() => {
    setOptions(deselectedOptions);
  }, [deselectedOptions]);

  const updateSelection = useCallback(
    (selected) => {
      //console.log(selected);
      let matchedOption;
      if (selected === "all") {
        matchedOption = { ID: "all", Handle: "all", Title: "All" };
      } else {
        matchedOption = options.find((option) => {
          return option.Handle.match(selected);
        });
      }
      setSelectedCollection(matchedOption);
      setSelectedOption(selected);
      setInputValue((matchedOption && matchedOption.Title) || "");
    },
    [options]
  );

  const optionsMarkup =
    options.length > 0 ? (
      <>
        <Listbox.Option
          key="all"
          value="all"
          selected={selectedOption === "all"}
          accessibilityLabel="All"
        >
          All
        </Listbox.Option>
        {options.map((option) => {
          const { Handle, Title } = option;

          return (
            <Listbox.Option
              key={`${Handle}`}
              value={Handle}
              selected={selectedOption === Handle}
              accessibilityLabel={Title}
            >
              {Title}
            </Listbox.Option>
          );
        })}
      </>
    ) : null;

  const handleUpdateCollections = async () => {
    try {
      setIsLoading(true);
      updateTitleText("Updating Collections");
      // If none selected or all loop over every collection
      if (selectedCollection === undefined || selectedCollection.ID === "all") {
        for (const option of options) {
          await new Promise((resolve) => setTimeout(resolve, 500));
          appendToLogText({
            message: "Updating " + option.Title,
            type: "info",
          });
          sortCollection(option);
        }
      } else {
        sortCollection(selectedCollection);
      }
      appendToLogText({
        message: "Completed Collection Updates",
        type: "success",
      });
      setIsLoading(false);
    } catch (error) {
      console.log(error);
      // Handle the error
      appendToLogText({
        message: `Error in handleUpdateCollection: ${error}`,
        type: "error",
      });
    }
  };

  const sortCollection = (collection) => {
    fetch(`/api/update-coll/${collection.ID}`)
      .then((response) => {
        console.log(response)  
        response.json()
      })
      .then((collData) => {
        setCollectionData(collData);
        console.log(collData);
        appendToLogText({
          message: `Updated Collection ${collection.Title}`,
          type: "success",
        });
      })
      .catch((error) => {
        console.error(error);
        appendToLogText({
          message: `Error updating ${collection.Title}: ${error}`,
          type: "error",
        });
      });
  };

  return (
    <>
      <Card
        title={"Update Collections"}
        sectioned
        primaryFooterAction={{
          content: "Update Collections",
          onAction: handleUpdateCollections,
          loading: isLoading,
        }}
      >
        <Combobox
          activator={
            <Combobox.TextField
              prefix={<Icon source={SearchMinor} />}
              onChange={updateText}
              label="Search Collections or Select 'All'"
              labelHidden
              value={inputValue}
              placeholder="Search Collections or Select 'All'"
              autoComplete="off"
            />
          }
        >
          {options.length > 0 ? (
            <Listbox onSelect={updateSelection}>{optionsMarkup}</Listbox>
          ) : null}
        </Combobox>
      </Card>
    </>
  );
}
