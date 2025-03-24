import fs from "fs/promises"; // modern Promise-based fs
// No need to import fetch in Node.js 18+, but if on <18, you can use node-fetch

const trumpUrl = `https://www.federalregister.gov/api/v1/documents.json?conditions%5Bcorrection%5D=0&conditions%5Bpresident%5D=donald-trump&conditions%5Bpresidential_document_type%5D=executive_order&conditions%5Bsigning_date%5D%5Bgte%5D=01%2F20%2F2025&conditions%5Bsigning_date%5D%5Blte%5D=03%2F24%2F2025&conditions%5Btype%5D%5B%5D=PRESDOCU&fields%5B%5D=citation&fields%5B%5D=document_number&fields%5B%5D=end_page&fields%5B%5D=html_url&fields%5B%5D=pdf_url&fields%5B%5D=type&fields%5B%5D=subtype&fields%5B%5D=publication_date&fields%5B%5D=signing_date&fields%5B%5D=start_page&fields%5B%5D=title&fields%5B%5D=disposition_notes&fields%5B%5D=executive_order_number&fields%5B%5D=not_received_for_publication&fields%5B%5D=full_text_xml_url&fields%5B%5D=body_html_url&fields%5B%5D=json_url&include_pre_1994_docs=true&maximum_per_page=1000&order=executive_order&per_page=1000`;

async function fetchAndSaveTrumpOrders() {
  try {
    console.log(`Fetching data from Federal Register...`);

    const response = await fetch(trumpUrl);

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();

    console.log(`Fetched ${data.results.length} executive orders.`);

    const fileName = "trump_executive_orders.json";
    await fs.writeFile(fileName, JSON.stringify(data, null, 2));

    console.log(`✅ Data saved to ${fileName}`);
  } catch (error) {
    console.error("❌ Error fetching or saving data:", error);
  }
}

fetchAndSaveTrumpOrders();
