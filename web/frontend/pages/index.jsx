import {
  Card,
  Page,
  Layout,
  TextContainer,
  Image,
  Stack,
  Link,
  Text,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { useTranslation, Trans } from "react-i18next";

import { trophyImage } from "../assets";

import { ProductsCard, UploadStock } from "../components";


export default function HomePage() {
  const { t } = useTranslation();
  return (
    <Page narrowWidth>
      <TitleBar title={"Cass Brothers Custom Stock Management App"} primaryAction={null} />
      <Layout>
        
        <Layout.Section>
          <UploadStock />
        </Layout.Section>
        
        
      </Layout>
    </Page>
  );
}
